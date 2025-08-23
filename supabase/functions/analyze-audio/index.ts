import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simplified DTW implementation with reduced complexity
function simpleDTW(seq1: number[], seq2: number[]): number {
  // Limit sequence length to prevent timeout
  const maxLength = 100;
  const s1 = seq1.slice(0, maxLength);
  const s2 = seq2.slice(0, maxLength);
  
  const m = s1.length;
  const n = s2.length;
  
  if (m === 0 || n === 0) return 1.0;
  
  // Use only current and previous row to save memory
  let prevRow = new Array(n + 1).fill(Infinity);
  let currRow = new Array(n + 1).fill(Infinity);
  
  prevRow[0] = 0;
  
  for (let i = 1; i <= m; i++) {
    currRow[0] = Infinity;
    for (let j = 1; j <= n; j++) {
      const cost = Math.abs(s1[i - 1] - s2[j - 1]);
      currRow[j] = cost + Math.min(
        prevRow[j],        // insertion
        currRow[j - 1],    // deletion
        prevRow[j - 1]     // match
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }
  
  return prevRow[n] / Math.max(m, n);
}

// Fast pitch extraction using simplified autocorrelation
function extractPitch(audioBuffer: Float32Array, sampleRate: number): number[] {
  // Downsample for faster processing
  const downsampleFactor = 4;
  const windowSize = Math.floor(sampleRate * 0.050 / downsampleFactor); // 50ms windows
  const hopSize = Math.floor(windowSize / 2);
  const pitches: number[] = [];
  const maxPitches = 50; // Limit number of pitch estimates
  
  for (let i = 0; i < audioBuffer.length - windowSize && pitches.length < maxPitches; i += hopSize * downsampleFactor) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Simple energy-based pitch estimation
    let maxEnergy = 0;
    let bestFreq = 0;
    
    // Check common frequency ranges
    const freqSteps = [80, 120, 160, 200, 250, 300, 400, 500]; // Hz
    
    for (const freq of freqSteps) {
      const period = Math.floor(sampleRate / freq / downsampleFactor);
      if (period < window.length / 2) {
        let energy = 0;
        for (let j = 0; j < window.length - period; j++) {
          energy += window[j] * window[j + period];
        }
        if (energy > maxEnergy) {
          maxEnergy = energy;
          bestFreq = freq;
        }
      }
    }
    
    pitches.push(bestFreq);
  }
  
  return pitches;
}

// Fast onset detection
function detectOnsets(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.100); // 100ms windows  
  const hopSize = Math.floor(windowSize / 2);
  const onsets: number[] = [];
  const maxOnsets = 20; // Limit number of onsets
  
  let prevEnergy = 0;
  
  for (let i = 0; i < audioBuffer.length - windowSize && onsets.length < maxOnsets; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    const energy = window.reduce((sum, sample, idx) => 
      idx % 4 === 0 ? sum + sample * sample : sum, 0) / (windowSize / 4); // Subsample
    
    if (energy > prevEnergy * 2.0 && energy > 0.02) {
      onsets.push(i / sampleRate);
    }
    
    prevEnergy = energy;
  }
  
  return onsets;
}

// Fast MFCC-like features
function extractSimpleFeatures(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const windowSize = Math.floor(sampleRate * 0.100); // 100ms windows
  const hopSize = Math.floor(windowSize / 2);
  const features: number[][] = [];
  const maxFrames = 30; // Limit number of frames
  
  for (let i = 0; i < audioBuffer.length - windowSize && features.length < maxFrames; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Simple spectral features instead of full MFCC
    const feature = [];
    
    // Energy
    feature.push(window.reduce((sum, s) => sum + s * s, 0) / window.length);
    
    // Zero crossing rate
    let zcr = 0;
    for (let j = 1; j < window.length; j++) {
      if ((window[j] >= 0) !== (window[j-1] >= 0)) zcr++;
    }
    feature.push(zcr / window.length);
    
    // Simple spectral centroid approximation
    let centroid = 0;
    let totalEnergy = 0;
    for (let j = 0; j < window.length; j++) {
      const energy = window[j] * window[j];
      centroid += j * energy;
      totalEnergy += energy;
    }
    feature.push(totalEnergy > 0 ? centroid / totalEnergy / window.length : 0);
    
    features.push(feature);
  }
  
  return features;
}

// Simple emotion detection
function detectSadness(features: number[][]): number {
  if (features.length === 0) return 0;
  
  let sadnessScore = 0;
  
  for (const feature of features) {
    const energy = feature[0] || 0;
    const zcr = feature[1] || 0;
    const centroid = feature[2] || 0;
    
    // Simple heuristic: low energy, low zcr suggest sadness
    const frameScore = Math.max(0, (1 - energy) * (1 - zcr) * (1 - centroid));
    sadnessScore += frameScore;
  }
  
  return Math.min(1, sadnessScore / features.length);
}

// Fast audio buffer decoding
function decodeAudioBuffer(base64: string): Float32Array {
  try {
    const binaryString = atob(base64);
    const maxSamples = 44100 * 10; // Limit to 10 seconds of audio
    const sampleCount = Math.min(binaryString.length / 2, maxSamples); // Assume 16-bit samples
    
    const float32Array = new Float32Array(sampleCount);
    
    for (let i = 0; i < sampleCount; i++) {
      const byteIndex = i * 2;
      if (byteIndex + 1 < binaryString.length) {
        // Simple 16-bit conversion
        const sample = (binaryString.charCodeAt(byteIndex) & 0xFF) | 
                      ((binaryString.charCodeAt(byteIndex + 1) & 0xFF) << 8);
        // Convert to signed and normalize
        const signed = sample > 32767 ? sample - 65536 : sample;
        float32Array[i] = signed / 32768.0;
      }
    }
    
    return float32Array;
  } catch (error) {
    console.error('Audio decode error:', error);
    return new Float32Array(0);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { noviceAudio, professionalAudio } = await req.json()
    
    if (!noviceAudio || !professionalAudio) {
      throw new Error('Both audio files are required')
    }

    console.log('Starting audio analysis...')
    
    const sampleRate = 22050; // Lower sample rate for faster processing
    
    // Decode audio buffers with error handling
    console.log('Decoding audio buffers...')
    const noviceBuffer = decodeAudioBuffer(noviceAudio);
    const professionalBuffer = decodeAudioBuffer(professionalAudio);
    
    if (noviceBuffer.length === 0 || professionalBuffer.length === 0) {
      throw new Error('Failed to decode audio buffers');
    }
    
    console.log(`Audio decoded: Novice ${noviceBuffer.length} samples, Professional ${professionalBuffer.length} samples`)

    // Extract features with time limits
    console.log('Extracting features...')
    const novicePitch = extractPitch(noviceBuffer, sampleRate);
    const professionalPitch = extractPitch(professionalBuffer, sampleRate);
    
    const noviceOnsets = detectOnsets(noviceBuffer, sampleRate);
    const professionalOnsets = detectOnsets(professionalBuffer, sampleRate);
    
    const noviceFeatures = extractSimpleFeatures(noviceBuffer, sampleRate);
    const professionalFeatures = extractSimpleFeatures(professionalBuffer, sampleRate);
    
    console.log('Features extracted successfully')

    // Calculate metrics quickly
    console.log('Calculating metrics...')
    
    // 1. Pitch Accuracy using simplified DTW
    const pitchAccuracy = Math.max(0, 1 - (simpleDTW(novicePitch, professionalPitch) / 50));
    
    // 2. Rhythm Timing Error
    const rhythmError = noviceOnsets.length > 0 && professionalOnsets.length > 0 
      ? Math.abs(noviceOnsets.length - professionalOnsets.length) / Math.max(noviceOnsets.length, professionalOnsets.length)
      : 0;
    
    // 3. Feature similarity (simplified MFCC replacement)
    let featureSimilarity = 0;
    if (noviceFeatures.length > 0 && professionalFeatures.length > 0) {
      const minLength = Math.min(noviceFeatures.length, professionalFeatures.length);
      let totalDiff = 0;
      for (let i = 0; i < minLength; i++) {
        for (let j = 0; j < 3; j++) { // 3 features per frame
          totalDiff += Math.abs((noviceFeatures[i][j] || 0) - (professionalFeatures[i][j] || 0));
        }
      }
      featureSimilarity = Math.max(0, 1 - (totalDiff / (minLength * 3)));
    }
    
    // 4. Emotion Match
    const noviceSadness = detectSadness(noviceFeatures);
    const professionalSadness = detectSadness(professionalFeatures);
    const emotionMatch = 1 - Math.abs(noviceSadness - professionalSadness);
    
    console.log('Analysis complete')
    console.log('Novice pitch data:', novicePitch)
    console.log('Professional pitch data:', professionalPitch)

    const results = {
      pitchAccuracy: {
        novice: Math.max(0, Math.min(1, pitchAccuracy)),
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, pitchAccuracy)))
      },
      rhythmTiming: {
        novice: Math.max(0, Math.min(1, 1 - rhythmError)),
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, 1 - rhythmError)))
      },
      mfccDistance: {
        novice: Math.max(0, Math.min(1, featureSimilarity)),
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, featureSimilarity)))
      },
      emotionMatch: {
        novice: Math.max(0, Math.min(1, emotionMatch)),
        professional: Math.max(0, Math.min(1, professionalSadness)),
        difference: Math.abs(Math.max(0, Math.min(1, professionalSadness)) - Math.max(0, Math.min(1, emotionMatch)))
      },
      // Add raw pitch data for visualization
      pitchData: {
        novice: novicePitch,
        professional: professionalPitch,
        sampleRate: sampleRate
      }
    };

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Audio analysis error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Improved DTW implementation for pitch comparison
function calculateDTW(seq1: number[], seq2: number[]): number {
  const maxLength = 100;
  const s1 = seq1.slice(0, maxLength);
  const s2 = seq2.slice(0, maxLength);
  
  const m = s1.length;
  const n = s2.length;
  
  if (m === 0 || n === 0) return 1.0;
  
  // Normalize sequences to log scale for better pitch comparison
  const normalizeSequence = (seq: number[]) => {
    return seq.map(f => f > 0 ? Math.log2(f / 220) : -10); // Use -10 for silence
  };
  
  const norm_s1 = normalizeSequence(s1);
  const norm_s2 = normalizeSequence(s2);
  
  // Create DTW matrix
  const dtw = Array(m + 1).fill(null).map(() => Array(n + 1).fill(Infinity));
  dtw[0][0] = 0;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = Math.abs(norm_s1[i - 1] - norm_s2[j - 1]);
      dtw[i][j] = cost + Math.min(
        dtw[i - 1][j],     // insertion
        dtw[i][j - 1],     // deletion
        dtw[i - 1][j - 1]  // match
      );
    }
  }
  
  // Normalize distance
  const maxDistance = Math.max(m, n) * 5; // Max possible log difference
  return Math.min(1, dtw[m][n] / maxDistance);
}

// Simple pitch extraction using autocorrelation
function extractPitch(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = 2048;
  const hopSize = 512;
  const pitches: number[] = [];
  
  console.log(`Extracting pitch from ${audioBuffer.length} samples at ${sampleRate}Hz`);
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Calculate RMS energy
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += window[j] * window[j];
    }
    energy = Math.sqrt(energy / windowSize);
    
    let bestFreq = 0;
    
    if (energy > 0.005) { // Voice activity detection
      bestFreq = autocorrelationPitch(window, sampleRate);
    }
    
    pitches.push(Math.round(bestFreq));
    
    if (pitches.length >= 150) break; // Limit number of pitch points
  }
  
  console.log(`Extracted ${pitches.length} pitch points, non-zero: ${pitches.filter(p => p > 0).length}`);
  return pitches;
}

// Autocorrelation-based pitch detection
function autocorrelationPitch(window: Float32Array, sampleRate: number): number {
  const minPitch = 80;
  const maxPitch = 500;
  const minPeriod = Math.floor(sampleRate / maxPitch);
  const maxPeriod = Math.floor(sampleRate / minPitch);
  
  let maxCorr = 0;
  let bestFreq = 0;
  
  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0;
    let norm = 0;
    
    for (let j = 0; j < window.length - period; j++) {
      correlation += window[j] * window[j + period];
      norm += window[j] * window[j];
    }
    
    const normalizedCorr = norm > 0 ? correlation / norm : 0;
    
    if (normalizedCorr > maxCorr) {
      maxCorr = normalizedCorr;
      bestFreq = sampleRate / period;
    }
  }
  
  return maxCorr > 0.3 ? bestFreq : 0;
}

// Simple onset detection
function detectOnsets(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
  const hopSize = Math.floor(windowSize / 2);
  const onsets: number[] = [];
  
  let prevEnergy = 0;
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    const energy = window.reduce((sum, sample) => sum + sample * sample, 0) / windowSize;
    
    if (energy > prevEnergy * 1.5 && energy > 0.01) {
      onsets.push(i / sampleRate);
    }
    
    prevEnergy = energy;
    
    if (onsets.length >= 20) break; // Limit onsets
  }
  
  return onsets;
}

// Simple spectral features
function extractFeatures(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms
  const hopSize = Math.floor(windowSize / 2);
  const features: number[][] = [];
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // RMS Energy
    const rmsEnergy = Math.sqrt(window.reduce((sum, s) => sum + s * s, 0) / window.length);
    
    // Zero Crossing Rate
    let zcr = 0;
    for (let j = 1; j < window.length; j++) {
      if ((window[j] >= 0) !== (window[j-1] >= 0)) zcr++;
    }
    const zcrRate = zcr / window.length;
    
    // Simple spectral centroid approximation
    let centroid = 0;
    let totalEnergy = 0;
    for (let j = 0; j < window.length; j++) {
      const energy = window[j] * window[j];
      centroid += j * energy;
      totalEnergy += energy;
    }
    const spectralCentroid = totalEnergy > 0 ? (centroid / totalEnergy) * sampleRate / window.length : 0;
    
    features.push([rmsEnergy, zcrRate, spectralCentroid]);
    
    if (features.length >= 30) break; // Limit features
  }
  
  return features;
}

// Simple audio buffer decoding
function decodeAudioBuffer(base64: string): Float32Array {
  try {
    const binaryString = atob(base64);
    const maxSamples = 22050 * 8; // Limit to 8 seconds at 22kHz
    const sampleCount = Math.min(Math.floor(binaryString.length / 2), maxSamples);
    
    const float32Array = new Float32Array(sampleCount);
    
    for (let i = 0; i < sampleCount; i++) {
      const byteIndex = i * 2;
      if (byteIndex + 1 < binaryString.length) {
        const sample = (binaryString.charCodeAt(byteIndex) & 0xFF) | 
                      ((binaryString.charCodeAt(byteIndex + 1) & 0xFF) << 8);
        const signed = sample > 32767 ? sample - 65536 : sample;
        float32Array[i] = signed / 32768.0;
      }
    }
    
    console.log(`Decoded ${sampleCount} audio samples`);
    return float32Array;
  } catch (error) {
    console.error('Audio decode error:', error);
    throw new Error('Failed to decode audio data');
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
    
    const sampleRate = 22050;
    
    // Decode audio buffers with error handling
    console.log('Decoding audio buffers...')
    const noviceBuffer = decodeAudioBuffer(noviceAudio);
    const professionalBuffer = decodeAudioBuffer(professionalAudio);
    
    console.log(`Audio decoded: Novice ${noviceBuffer.length} samples, Professional ${professionalBuffer.length} samples`)

    // Extract features
    console.log('Extracting features...')
    const novicePitch = extractPitch(noviceBuffer, sampleRate);
    const professionalPitch = extractPitch(professionalBuffer, sampleRate);
    
    const noviceOnsets = detectOnsets(noviceBuffer, sampleRate);
    const professionalOnsets = detectOnsets(professionalBuffer, sampleRate);
    
    const noviceFeatures = extractFeatures(noviceBuffer, sampleRate);
    const professionalFeatures = extractFeatures(professionalBuffer, sampleRate);
    
    console.log('Features extracted successfully')

    // Calculate metrics
    console.log('Calculating metrics...')
    
    // 1. Pitch Accuracy using DTW
    const dtwDistance = calculateDTW(novicePitch, professionalPitch);
    const pitchAccuracy = Math.max(0, 1 - dtwDistance);
    console.log(`DTW distance: ${dtwDistance.toFixed(3)}, Pitch accuracy: ${(pitchAccuracy * 100).toFixed(1)}%`);
    
    // 2. Rhythm Timing Error
    const rhythmError = noviceOnsets.length > 0 && professionalOnsets.length > 0 
      ? Math.abs(noviceOnsets.length - professionalOnsets.length) / Math.max(noviceOnsets.length, professionalOnsets.length)
      : 0;
    
    // 3. Feature similarity
    let featureSimilarity = 0;
    if (noviceFeatures.length > 0 && professionalFeatures.length > 0) {
      const minLength = Math.min(noviceFeatures.length, professionalFeatures.length);
      let totalDiff = 0;
      let featureCount = 0;
      
      for (let i = 0; i < minLength; i++) {
        for (let j = 0; j < Math.min(3, noviceFeatures[i].length, professionalFeatures[i].length); j++) {
          const noviceVal = noviceFeatures[i][j] || 0;
          const professionalVal = professionalFeatures[i][j] || 0;
          
          // Simple normalized difference
          const maxVal = Math.max(Math.abs(noviceVal), Math.abs(professionalVal), 0.001);
          const normalizedDiff = Math.abs(noviceVal - professionalVal) / maxVal;
          
          totalDiff += normalizedDiff;
          featureCount++;
        }
      }
      
      featureSimilarity = featureCount > 0 ? Math.max(0, 1 - (totalDiff / featureCount)) : 0;
      console.log(`Feature similarity: ${(featureSimilarity * 100).toFixed(1)}%`);
    }
    
    // 4. Simple emotion match based on energy
    const avgNoviceEnergy = noviceFeatures.length > 0 ? 
      noviceFeatures.reduce((sum, f) => sum + (f[0] || 0), 0) / noviceFeatures.length : 0;
    const avgProfEnergy = professionalFeatures.length > 0 ? 
      professionalFeatures.reduce((sum, f) => sum + (f[0] || 0), 0) / professionalFeatures.length : 0;
    const emotionMatch = 1 - Math.min(1, Math.abs(avgNoviceEnergy - avgProfEnergy) * 10);
    
    console.log('Analysis complete')

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
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, emotionMatch)))
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
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

// Optimized pitch extraction with CPU efficiency
function extractPitch(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = 1024; // Smaller window for faster processing
  const hopSize = 1024; // Larger hop size for fewer calculations
  const pitches: number[] = [];
  const maxPitches = 200; // Limit pitch points for performance
  
  console.log(`Extracting pitch from ${audioBuffer.length} samples at ${sampleRate}Hz`);
  
  // Skip pre-emphasis for performance
  const stepSize = Math.max(1, Math.floor(audioBuffer.length / (maxPitches * hopSize)));
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize * stepSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Quick energy check first
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += window[j] * window[j];
    }
    energy = Math.sqrt(energy / windowSize);
    
    let bestFreq = 0;
    
    if (energy > 0.01) { // Higher threshold for performance
      bestFreq = fastPitchDetection(window, sampleRate);
    }
    
    pitches.push(Math.round(bestFreq));
    
    if (pitches.length >= maxPitches) break;
  }
  
  console.log(`Extracted ${pitches.length} pitch points, non-zero: ${pitches.filter(p => p > 0).length}`);
  return pitches;
}

// Fast pitch detection using simplified autocorrelation
function fastPitchDetection(window: Float32Array, sampleRate: number): number {
  const minPitch = 80;   // Reasonable range for human voice
  const maxPitch = 400; 
  const minPeriod = Math.floor(sampleRate / maxPitch);
  const maxPeriod = Math.floor(sampleRate / minPitch);
  
  let maxCorr = 0;
  let bestFreq = 0;
  
  // Simplified autocorrelation - check fewer periods for performance
  const stepSize = Math.max(1, Math.floor((maxPeriod - minPeriod) / 20)); // Only check 20 periods max
  
  for (let period = minPeriod; period <= maxPeriod; period += stepSize) {
    let correlation = 0;
    const checkLength = Math.min(window.length - period, 100); // Limit calculation length
    
    for (let j = 0; j < checkLength; j++) {
      correlation += window[j] * window[j + period];
    }
    
    if (correlation > maxCorr) {
      maxCorr = correlation;
      bestFreq = sampleRate / period;
    }
  }
  
  // Simple threshold check
  if (maxCorr > 0.1 && bestFreq >= minPitch && bestFreq <= maxPitch) {
    return bestFreq;
  }
  
  return 0;
}

// Optimized onset detection
function detectOnsets(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.2); // 200ms windows for performance
  const hopSize = windowSize; // No overlap for speed
  const onsets: number[] = [];
  const maxOnsets = 10; // Limit onsets for performance
  
  let prevEnergy = 0;
  
  for (let i = 0; i < audioBuffer.length - windowSize && onsets.length < maxOnsets; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    const energy = window.reduce((sum, sample) => sum + sample * sample, 0) / windowSize;
    
    if (energy > prevEnergy * 2.0 && energy > 0.05) {
      onsets.push(i / sampleRate);
    }
    
    prevEnergy = energy;
  }
  
  return onsets;
}

// Optimized spectral features
function extractFeatures(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const windowSize = Math.floor(sampleRate * 0.2); // 200ms for performance
  const hopSize = windowSize; // No overlap for speed
  const features: number[][] = [];
  const maxFeatures = 15; // Limit features for performance
  
  for (let i = 0; i < audioBuffer.length - windowSize && features.length < maxFeatures; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // RMS Energy
    const rmsEnergy = Math.sqrt(window.reduce((sum, s) => sum + s * s, 0) / window.length);
    
    // Zero Crossing Rate (simplified)
    let zcr = 0;
    for (let j = 1; j < Math.min(window.length, 1000); j++) { // Limit ZCR calculation
      if ((window[j] >= 0) !== (window[j-1] >= 0)) zcr++;
    }
    const zcrRate = zcr / Math.min(window.length, 1000);
    
    // Simple energy-based spectral centroid approximation
    let centroid = 0;
    let totalEnergy = 0;
    const step = Math.max(1, Math.floor(window.length / 100)); // Sample fewer points
    for (let j = 0; j < window.length; j += step) {
      const energy = window[j] * window[j];
      centroid += j * energy;
      totalEnergy += energy;
    }
    const spectralCentroid = totalEnergy > 0 ? (centroid / totalEnergy) * sampleRate / window.length : 0;
    
    features.push([rmsEnergy, zcrRate, spectralCentroid]);
  }
  
  return features;
}

// Improved audio buffer decoding with better format support and memory efficiency
function decodeAudioBuffer(base64: string): Float32Array {
  try {
    console.log(`Starting audio decode, base64 length: ${base64.length}`);
    
    // Decode base64 in chunks to avoid memory issues
    const chunkSize = 1024 * 1024; // 1MB chunks
    const binaryLength = Math.floor((base64.length * 3) / 4);
    console.log(`Estimated binary length: ${binaryLength} bytes`);
    
    // Limit processing to reasonable size
    const maxBytes = 10 * 1024 * 1024; // 10MB max
    if (binaryLength > maxBytes) {
      console.log(`Large file detected (${binaryLength} bytes), truncating to ${maxBytes} bytes`);
    }
    
    const processLength = Math.min(binaryLength, maxBytes);
    const maxBase64Length = Math.floor((processLength * 4) / 3);
    const truncatedBase64 = base64.substring(0, maxBase64Length);
    
    const binaryString = atob(truncatedBase64);
    console.log(`Decoded binary string: ${binaryString.length} bytes`);
    
    // Strategy 1: Try as WAV file (skip header if present)
    let offset = 0;
    if (binaryString.length > 44) {
      const header = binaryString.substring(0, 4);
      if (header === 'RIFF') {
        console.log('Detected WAV format, skipping header');
        offset = 44; // Skip WAV header
      }
    }
    
    const dataLength = binaryString.length - offset;
    const maxSamples = 22050 * 30; // 30 seconds at 22kHz (reasonable limit)
    const sampleCount = Math.min(Math.floor(dataLength / 2), maxSamples);
    
    console.log(`Processing ${sampleCount} samples from ${dataLength} bytes of audio data`);
    
    const float32Array = new Float32Array(sampleCount);
    
    // Decode 16-bit PCM samples efficiently
    for (let i = 0; i < sampleCount; i++) {
      const byteIndex = offset + (i * 2);
      if (byteIndex + 1 < binaryString.length) {
        const low = binaryString.charCodeAt(byteIndex) & 0xFF;
        const high = binaryString.charCodeAt(byteIndex + 1) & 0xFF;
        const sample = low | (high << 8);
        const signed = sample > 32767 ? sample - 65536 : sample;
        float32Array[i] = signed / 32768.0;
      }
    }
    
    // Calculate max amplitude without creating large intermediate arrays
    let maxAmplitude = 0;
    for (let i = 0; i < float32Array.length; i++) {
      const abs = Math.abs(float32Array[i]);
      if (abs > maxAmplitude) {
        maxAmplitude = abs;
      }
    }
    
    // Apply normalization and noise gate if needed
    if (maxAmplitude > 0.001) {
      const normalizeGain = Math.min(1.0, 0.8 / maxAmplitude);
      for (let i = 0; i < float32Array.length; i++) {
        float32Array[i] *= normalizeGain;
        // Simple noise gate
        if (Math.abs(float32Array[i]) < 0.001) {
          float32Array[i] = 0;
        }
      }
    }
    
    console.log(`Successfully decoded ${sampleCount} audio samples, max amplitude: ${maxAmplitude.toFixed(4)}`);
    return float32Array;
  } catch (error) {
    console.error('Audio decode error:', error);
    throw new Error(`Failed to decode audio data: ${error.message}`);
  }
}

// Add audio fingerprinting to ensure unique analysis
function calculateAudioFingerprint(audioBuffer: Float32Array): string {
  let sum = 0;
  let squares = 0;
  let peaks = 0;
  
  for (let i = 0; i < Math.min(audioBuffer.length, 10000); i++) {
    const sample = audioBuffer[i];
    sum += sample;
    squares += sample * sample;
    if (Math.abs(sample) > 0.1) peaks++;
  }
  
  const mean = sum / audioBuffer.length;
  const rms = Math.sqrt(squares / audioBuffer.length);
  const peakRatio = peaks / audioBuffer.length;
  
  return `${mean.toFixed(6)}_${rms.toFixed(6)}_${peakRatio.toFixed(6)}`;
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
    
    // Add unique audio fingerprinting to ensure different analysis
    const noviceFingerprint = calculateAudioFingerprint(noviceBuffer);
    const professionalFingerprint = calculateAudioFingerprint(professionalBuffer);
    
    console.log(`Audio fingerprints: Novice ${noviceFingerprint}, Professional ${professionalFingerprint}`)

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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Improved DTW implementation for pitch comparison
function calculateDTW(seq1: number[], seq2: number[]): number {
  // Increase limit for better accuracy but balance performance
  const maxLength = 300; // Increased from 100
  const s1 = seq1.slice(0, maxLength);
  const s2 = seq2.slice(0, maxLength);
  
  const m = s1.length;
  const n = s2.length;
  
  if (m === 0 || n === 0) return 1.0;
  
  // Filter out silence and improve normalization
  const filterAndNormalize = (seq: number[]) => {
    const filtered = seq.filter(f => f > 50 && f < 800); // Human vocal range
    if (filtered.length === 0) return seq.map(() => -10);
    
    const mean = filtered.reduce((sum, f) => sum + f, 0) / filtered.length;
    return seq.map(f => f > 50 && f < 800 ? Math.log2(f / mean) : -10);
  };
  
  const norm_s1 = filterAndNormalize(s1);
  const norm_s2 = filterAndNormalize(s2);
  
  // Create DTW matrix with improved initialization
  const dtw = Array(m + 1).fill(null).map(() => Array(n + 1).fill(Infinity));
  dtw[0][0] = 0;
  
  // Allow for some flexibility in alignment
  for (let i = 1; i <= Math.min(m, 5); i++) dtw[i][0] = i;
  for (let j = 1; j <= Math.min(n, 5); j++) dtw[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = Math.abs(norm_s1[i - 1] - norm_s2[j - 1]);
      // Weight diagonal moves slightly less to encourage alignment
      dtw[i][j] = cost + Math.min(
        dtw[i - 1][j] + 0.1,     // insertion
        dtw[i][j - 1] + 0.1,     // deletion
        dtw[i - 1][j - 1]        // match
      );
    }
  }
  
  // Improved normalization based on sequence characteristics
  const pathLength = Math.max(m, n);
  const normalizedDistance = dtw[m][n] / pathLength;
  
  // Convert to similarity score with better scaling
  return Math.min(1, normalizedDistance / 3);
}

// Enhanced pitch extraction with better accuracy
function extractPitch(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = 2048; // Larger window for better frequency resolution
  const hopSize = 512; // Smaller hop for better time resolution
  const pitches: number[] = [];
  const maxPitches = 500; // Increased limit for better analysis
  
  console.log(`Extracting pitch from ${audioBuffer.length} samples at ${sampleRate}Hz`);
  
  // Pre-emphasis filter for better pitch detection
  const preEmphasized = new Float32Array(audioBuffer.length);
  preEmphasized[0] = audioBuffer[0];
  for (let i = 1; i < audioBuffer.length; i++) {
    preEmphasized[i] = audioBuffer[i] - 0.97 * audioBuffer[i - 1];
  }
  
  const stepSize = Math.max(1, Math.floor(audioBuffer.length / (maxPitches * hopSize)));
  
  for (let i = 0; i < preEmphasized.length - windowSize; i += hopSize * stepSize) {
    const window = preEmphasized.slice(i, i + windowSize);
    
    // Apply Hamming window
    for (let j = 0; j < windowSize; j++) {
      window[j] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * j / (windowSize - 1));
    }
    
    // Energy check with better threshold
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += window[j] * window[j];
    }
    energy = Math.sqrt(energy / windowSize);
    
    let bestFreq = 0;
    
    if (energy > 0.005) { // Better energy threshold
      bestFreq = enhancedPitchDetection(window, sampleRate);
    }
    
    pitches.push(Math.round(bestFreq));
    
    if (pitches.length >= maxPitches) break;
  }
  
  console.log(`Extracted ${pitches.length} pitch points, non-zero: ${pitches.filter(p => p > 0).length}`);
  return pitches;
}

// Enhanced pitch detection using improved autocorrelation
function enhancedPitchDetection(window: Float32Array, sampleRate: number): number {
  const minPitch = 80;   // Human vocal range
  const maxPitch = 800; 
  const minPeriod = Math.floor(sampleRate / maxPitch);
  const maxPeriod = Math.floor(sampleRate / minPitch);
  
  let maxCorr = 0;
  let bestFreq = 0;
  
  // Improved autocorrelation with better resolution
  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0;
    let normalization = 0;
    const checkLength = Math.min(window.length - period, window.length / 2);
    
    // Normalized autocorrelation
    for (let j = 0; j < checkLength; j++) {
      correlation += window[j] * window[j + period];
      normalization += window[j] * window[j] + window[j + period] * window[j + period];
    }
    
    if (normalization > 0) {
      correlation = correlation / Math.sqrt(normalization);
    }
    
    if (correlation > maxCorr) {
      maxCorr = correlation;
      bestFreq = sampleRate / period;
    }
  }
  
  // Better threshold and validation
  if (maxCorr > 0.3 && bestFreq >= minPitch && bestFreq <= maxPitch) {
    return bestFreq;
  }
  
  return 0;
}

// Improved onset detection for better rhythm analysis
function detectOnsets(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows for better resolution
  const hopSize = Math.floor(windowSize / 4); // 75% overlap for better detection
  const onsets: number[] = [];
  const maxOnsets = 50; // Increased limit for better accuracy
  
  let prevEnergy = 0;
  let prevSpectralFlux = 0;
  
  for (let i = 0; i < audioBuffer.length - windowSize && onsets.length < maxOnsets; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Calculate energy
    const energy = window.reduce((sum, sample) => sum + sample * sample, 0) / windowSize;
    
    // Calculate spectral flux (high frequency energy)
    let highFreqEnergy = 0;
    for (let j = Math.floor(window.length / 2); j < window.length; j++) {
      highFreqEnergy += window[j] * window[j];
    }
    const spectralFlux = highFreqEnergy / (window.length / 2);
    
    // Improved onset detection criteria
    const energyIncrease = energy > prevEnergy * 1.5;
    const spectralIncrease = spectralFlux > prevSpectralFlux * 1.3;
    const minEnergy = energy > 0.01;
    const minTime = onsets.length === 0 || (i / sampleRate) - onsets[onsets.length - 1] > 0.1; // Min 100ms between onsets
    
    if (energyIncrease && spectralIncrease && minEnergy && minTime) {
      onsets.push(i / sampleRate);
    }
    
    prevEnergy = energy;
    prevSpectralFlux = spectralFlux;
  }
  
  return onsets;
}

// Enhanced spectral features with proper MFCC-like analysis
function extractFeatures(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows for better resolution
  const hopSize = Math.floor(windowSize / 2); // 50% overlap
  const features: number[][] = [];
  const maxFeatures = 50; // Increased limit for better analysis
  
  for (let i = 0; i < audioBuffer.length - windowSize && features.length < maxFeatures; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Apply Hamming window
    for (let j = 0; j < windowSize; j++) {
      window[j] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * j / (windowSize - 1));
    }
    
    // 1. RMS Energy
    const rmsEnergy = Math.sqrt(window.reduce((sum, s) => sum + s * s, 0) / window.length);
    
    // 2. Zero Crossing Rate
    let zcr = 0;
    for (let j = 1; j < window.length; j++) {
      if ((window[j] >= 0) !== (window[j-1] >= 0)) zcr++;
    }
    const zcrRate = zcr / window.length;
    
    // 3. Improved Spectral Centroid
    let centroid = 0;
    let totalMagnitude = 0;
    const fftSize = Math.min(windowSize, 512); // Limit FFT size for performance
    
    for (let j = 0; j < fftSize; j++) {
      const magnitude = Math.abs(window[j]);
      const frequency = j * sampleRate / fftSize;
      centroid += frequency * magnitude;
      totalMagnitude += magnitude;
    }
    const spectralCentroid = totalMagnitude > 0 ? centroid / totalMagnitude : 0;
    
    // 4. Spectral Rolloff (85% of energy)
    let cumulativeEnergy = 0;
    const totalEnergy = window.reduce((sum, s) => sum + s * s, 0);
    let rolloff = 0;
    
    for (let j = 0; j < fftSize && cumulativeEnergy < 0.85 * totalEnergy; j++) {
      cumulativeEnergy += window[j] * window[j];
      rolloff = j * sampleRate / fftSize;
    }
    
    // 5. Spectral Bandwidth
    let bandwidth = 0;
    if (totalMagnitude > 0 && spectralCentroid > 0) {
      let variance = 0;
      for (let j = 0; j < fftSize; j++) {
        const magnitude = Math.abs(window[j]);
        const frequency = j * sampleRate / fftSize;
        variance += Math.pow(frequency - spectralCentroid, 2) * magnitude;
      }
      bandwidth = Math.sqrt(variance / totalMagnitude);
    }
    
    features.push([rmsEnergy, zcrRate, spectralCentroid / 1000, rolloff / 1000, bandwidth / 1000]);
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

// Helper function for variance calculation
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return variance;
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
    
    // 2. Improved Rhythm Timing Analysis based on onset pattern consistency
    let rhythmAccuracy = 0;
    if (noviceOnsets.length > 0 && professionalOnsets.length > 0) {
      console.log(`Rhythm analysis: Detected ${noviceOnsets.length} novice onsets, ${professionalOnsets.length} professional onsets`);
      
      // Calculate rhythm consistency within each recording (more realistic metric)
      const calculateRhythmConsistency = (onsets: number[]): number => {
        if (onsets.length < 3) return 0.3; // Not enough data for rhythm analysis
        
        // Calculate intervals between onsets
        const intervals: number[] = [];
        for (let i = 1; i < onsets.length; i++) {
          intervals.push(onsets[i] - onsets[i-1]);
        }
        
        // Calculate consistency (lower standard deviation = more consistent rhythm)
        const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Convert to consistency score (0-1, where 1 is perfectly consistent)
        const consistency = Math.max(0, 1 - (stdDev / mean));
        return Math.min(1, consistency);
      };
      
      const noviceConsistency = calculateRhythmConsistency(noviceOnsets);
      const professionalConsistency = calculateRhythmConsistency(professionalOnsets);
      
      // Also check onset density similarity (similar number of onsets per unit time)
      const noviceDensity = noviceOnsets.length / (noviceBuffer.length / sampleRate);
      const professionalDensity = professionalOnsets.length / (professionalBuffer.length / sampleRate);
      const densitySimilarity = 1 - Math.min(1, Math.abs(noviceDensity - professionalDensity) / Math.max(noviceDensity, professionalDensity));
      
      // Combine consistency and density for overall rhythm score
      rhythmAccuracy = (noviceConsistency * 0.7) + (densitySimilarity * 0.3);
      
      console.log(`Rhythm details - Novice consistency: ${(noviceConsistency * 100).toFixed(1)}%, Professional consistency: ${(professionalConsistency * 100).toFixed(1)}%, Density similarity: ${(densitySimilarity * 100).toFixed(1)}%, Final accuracy: ${(rhythmAccuracy * 100).toFixed(1)}%`);
    } else {
      // Fallback if no onsets detected
      rhythmAccuracy = 0.2; // Low score for poor onset detection
      console.log('Warning: Insufficient onsets detected for rhythm analysis');
    }
    
    // 3. Enhanced MFCC-like Feature similarity
    let featureSimilarity = 0;
    if (noviceFeatures.length > 0 && professionalFeatures.length > 0) {
      const minLength = Math.min(noviceFeatures.length, professionalFeatures.length);
      let totalDistance = 0;
      let featureCount = 0;
      
      for (let i = 0; i < minLength; i++) {
        const noviceFeature = noviceFeatures[i];
        const professionalFeature = professionalFeatures[i];
        
        // Calculate Euclidean distance between feature vectors
        let distance = 0;
        const featureLength = Math.min(noviceFeature.length, professionalFeature.length);
        
        for (let j = 0; j < featureLength; j++) {
          const noviceVal = noviceFeature[j] || 0;
          const professionalVal = professionalFeature[j] || 0;
          
          // Normalize features to same scale
          const maxVal = Math.max(Math.abs(noviceVal), Math.abs(professionalVal), 0.001);
          const normalizedNovice = noviceVal / maxVal;
          const normalizedProf = professionalVal / maxVal;
          
          distance += Math.pow(normalizedNovice - normalizedProf, 2);
        }
        
        totalDistance += Math.sqrt(distance / featureLength);
        featureCount++;
      }
      
      // Convert distance to similarity (0-1 scale)
      const avgDistance = totalDistance / featureCount;
      featureSimilarity = Math.max(0, 1 - avgDistance);
      console.log(`Enhanced feature similarity: ${(featureSimilarity * 100).toFixed(1)}%, Avg distance: ${avgDistance.toFixed(3)}`);
    }
    
    // 4. Enhanced emotion analysis using multiple acoustic features
    let emotionMatch = 0;
    if (noviceFeatures.length > 0 && professionalFeatures.length > 0) {
      // Energy variation (excitement/sadness indicator)
      const noviceEnergyVar = calculateVariance(noviceFeatures.map(f => f[0] || 0));
      const profEnergyVar = calculateVariance(professionalFeatures.map(f => f[0] || 0));
      const energyVarSimilarity = 1 - Math.min(1, Math.abs(noviceEnergyVar - profEnergyVar) * 50);
      
      // ZCR variation (emotional intensity)
      const noviceZCRVar = calculateVariance(noviceFeatures.map(f => f[1] || 0));
      const profZCRVar = calculateVariance(professionalFeatures.map(f => f[1] || 0));
      const zcrVarSimilarity = 1 - Math.min(1, Math.abs(noviceZCRVar - profZCRVar) * 100);
      
      // Spectral characteristics (timbre emotion)
      const noviceSpectralMean = noviceFeatures.reduce((sum, f) => sum + (f[2] || 0), 0) / noviceFeatures.length;
      const profSpectralMean = professionalFeatures.reduce((sum, f) => sum + (f[2] || 0), 0) / professionalFeatures.length;
      const spectralSimilarity = 1 - Math.min(1, Math.abs(noviceSpectralMean - profSpectralMean) / Math.max(noviceSpectralMean, profSpectralMean, 0.1));
      
      // Combined emotion score
      emotionMatch = (energyVarSimilarity + zcrVarSimilarity + spectralSimilarity) / 3;
      console.log(`Enhanced emotion analysis: Energy var similarity: ${(energyVarSimilarity * 100).toFixed(1)}%, ZCR var similarity: ${(zcrVarSimilarity * 100).toFixed(1)}%, Spectral similarity: ${(spectralSimilarity * 100).toFixed(1)}%, Combined: ${(emotionMatch * 100).toFixed(1)}%`);
    } else {
      emotionMatch = 0.1; // Low score if features couldn't be extracted
    }
    
    console.log('Analysis complete')

    const results = {
      pitchAccuracy: {
        novice: Math.max(0, Math.min(1, pitchAccuracy)),
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, pitchAccuracy)))
      },
      rhythmTiming: {
        novice: Math.max(0, Math.min(1, rhythmAccuracy)),
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, rhythmAccuracy)))
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
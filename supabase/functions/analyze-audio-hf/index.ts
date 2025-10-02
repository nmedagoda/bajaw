import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decode PCM audio buffer from base64 (already decoded by Web Audio API on client)
function decodeAudioBuffer(base64: string): Float32Array {
  try {
    console.log(`Decoding PCM audio, base64 length: ${base64.length}`);
    
    const binaryString = atob(base64);
    console.log(`Binary data: ${binaryString.length} bytes`);
    
    // Convert binary string to Float32Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const float32Array = new Float32Array(bytes.buffer);
    console.log(`Decoded ${float32Array.length} PCM samples`);
    
    return float32Array;
  } catch (error) {
    console.error('Audio decode error:', error);
    throw new Error(`Failed to decode: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Extract pitch using improved autocorrelation with parabolic interpolation
function extractPitch(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const hopSize = Math.floor(windowSize / 2);
  const pitches: number[] = [];
  const maxPitches = 200;
  
  for (let i = 0; i < audioBuffer.length - windowSize && pitches.length < maxPitches; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Calculate RMS to check if window has significant energy
    const rms = Math.sqrt(window.reduce((sum, s) => sum + s * s, 0) / window.length);
    if (rms < 0.01) {
      pitches.push(0);
      continue;
    }
    
    // Apply Hamming window
    for (let j = 0; j < windowSize; j++) {
      window[j] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * j / (windowSize - 1));
    }
    
    // Autocorrelation with normalization
    const minLag = Math.floor(sampleRate / 500); // 500 Hz max
    const maxLag = Math.floor(sampleRate / 80);  // 80 Hz min
    let maxCorr = -1;
    let bestLag = minLag;
    
    for (let lag = minLag; lag < maxLag && lag < window.length / 2; lag++) {
      let corr = 0;
      let energy = 0;
      for (let j = 0; j < window.length - lag; j++) {
        corr += window[j] * window[j + lag];
        energy += window[j + lag] * window[j + lag];
      }
      // Normalize by energy
      const normalizedCorr = energy > 0 ? corr / Math.sqrt(energy) : 0;
      if (normalizedCorr > maxCorr) {
        maxCorr = normalizedCorr;
        bestLag = lag;
      }
    }
    
    // Use threshold and parabolic interpolation for better accuracy
    if (maxCorr > 0.5 && bestLag > minLag && bestLag < maxLag - 1) {
      // Parabolic interpolation for sub-sample accuracy
      let prevCorr = 0, nextCorr = 0;
      for (let j = 0; j < window.length - bestLag - 1; j++) {
        prevCorr += window[j] * window[j + bestLag - 1];
        nextCorr += window[j] * window[j + bestLag + 1];
      }
      const offset = 0.5 * (prevCorr - nextCorr) / (prevCorr - 2 * maxCorr + nextCorr);
      const refinedLag = bestLag + offset;
      pitches.push(sampleRate / refinedLag);
    } else {
      pitches.push(0);
    }
  }
  
  return pitches;
}

// Extract spectral features for timbre analysis
function extractSpectralFeatures(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const windowSize = Math.floor(sampleRate * 0.05);
  const hopSize = Math.floor(windowSize / 2);
  const features: number[][] = [];
  const maxFeatures = 100;
  
  for (let i = 0; i < audioBuffer.length - windowSize && features.length < maxFeatures; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Apply Hamming window
    for (let j = 0; j < windowSize; j++) {
      window[j] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * j / (windowSize - 1));
    }
    
    // RMS Energy
    const rms = Math.sqrt(window.reduce((sum, s) => sum + s * s, 0) / window.length);
    
    // Zero Crossing Rate
    let zcr = 0;
    for (let j = 1; j < window.length; j++) {
      if ((window[j] >= 0) !== (window[j-1] >= 0)) zcr++;
    }
    const zcrRate = zcr / window.length;
    
    // Spectral Centroid
    let centroid = 0;
    let totalMag = 0;
    for (let j = 0; j < window.length; j++) {
      const magnitude = Math.abs(window[j]);
      centroid += j * magnitude;
      totalMag += magnitude;
    }
    const spectralCentroid = totalMag > 0 ? centroid / totalMag : 0;
    
    features.push([rms, zcrRate, spectralCentroid]);
  }
  
  return features;
}

// Detect note onsets for rhythm analysis
function detectOnsets(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.02); // 20ms
  const hopSize = Math.floor(windowSize / 2);
  const energies: number[] = [];
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    const energy = window.reduce((sum, s) => sum + s * s, 0) / window.length;
    energies.push(energy);
  }
  
  // Find peaks in energy
  const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 2;
  const onsets: number[] = [];
  
  for (let i = 2; i < energies.length - 2; i++) {
    if (energies[i] > threshold &&
        energies[i] > energies[i-1] &&
        energies[i] > energies[i-2] &&
        energies[i] >= energies[i+1]) {
      onsets.push(i * hopSize / sampleRate);
    }
  }
  
  return onsets;
}

// Calculate DTW distance between two sequences
function calculateDTW(seq1: number[], seq2: number[]): number {
  const n = seq1.length;
  const m = seq2.length;
  
  // Initialize DTW matrix with large values
  const dtw: number[][] = Array(n + 1).fill(0).map(() => Array(m + 1).fill(Infinity));
  dtw[0][0] = 0;
  
  // Fill DTW matrix
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      // Skip if either value is 0 (silence)
      if (seq1[i-1] === 0 || seq2[j-1] === 0) {
        dtw[i][j] = dtw[i-1][j-1];
        continue;
      }
      
      // Calculate distance in cents (log frequency space)
      const cost = Math.abs(1200 * Math.log2(seq1[i-1] / seq2[j-1]));
      dtw[i][j] = cost + Math.min(
        dtw[i-1][j],    // insertion
        dtw[i][j-1],    // deletion
        dtw[i-1][j-1]   // match
      );
    }
  }
  
  return dtw[n][m];
}

// Calculate pitch accuracy using Dynamic Time Warping
function calculatePitchAccuracy(novicePitch: number[], professionalPitch: number[]): number {
  if (novicePitch.length === 0 || professionalPitch.length === 0) return 0;
  
  // Filter out zeros for voiced segments
  const noviceVoiced = novicePitch.filter(p => p > 0);
  const profVoiced = professionalPitch.filter(p => p > 0);
  
  if (noviceVoiced.length === 0 || profVoiced.length === 0) return 0;
  
  // Use DTW for alignment-invariant comparison
  const dtwDistance = calculateDTW(noviceVoiced, profVoiced);
  const avgDistance = dtwDistance / Math.max(noviceVoiced.length, profVoiced.length);
  
  // Convert DTW distance to accuracy score
  // 0 cents avg = 100%, 25 cents = 88%, 50 cents = 78%, 100 cents = 61%, 200 cents = 37%
  const accuracy = Math.exp(-avgDistance / 150);
  
  console.log(`Pitch DTW: distance ${dtwDistance.toFixed(1)}, avg ${avgDistance.toFixed(1)} cents, accuracy ${(accuracy*100).toFixed(1)}%`);
  return accuracy;
}

// Calculate rhythm timing accuracy with DTW
function calculateRhythmAccuracy(noviceOnsets: number[], profOnsets: number[]): number {
  if (noviceOnsets.length < 2 || profOnsets.length < 2) return 0;
  
  // Calculate inter-onset intervals (IOI)
  const noviceIOI: number[] = [];
  const profIOI: number[] = [];
  
  for (let i = 1; i < noviceOnsets.length; i++) {
    noviceIOI.push(noviceOnsets[i] - noviceOnsets[i-1]);
  }
  for (let i = 1; i < profOnsets.length; i++) {
    profIOI.push(profOnsets[i] - profOnsets[i-1]);
  }
  
  if (noviceIOI.length === 0 || profIOI.length === 0) return 0;
  
  // Normalize IOIs to tempo-independent ratios
  const noviceMean = noviceIOI.reduce((a, b) => a + b, 0) / noviceIOI.length;
  const profMean = profIOI.reduce((a, b) => a + b, 0) / profIOI.length;
  
  const noviceNorm = noviceIOI.map(x => x / noviceMean);
  const profNorm = profIOI.map(x => x / profMean);
  
  // Calculate DTW distance for rhythm patterns
  const n = noviceNorm.length;
  const m = profNorm.length;
  const dtw: number[][] = Array(n + 1).fill(0).map(() => Array(m + 1).fill(Infinity));
  dtw[0][0] = 0;
  
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(noviceNorm[i-1] - profNorm[j-1]);
      dtw[i][j] = cost + Math.min(dtw[i-1][j], dtw[i][j-1], dtw[i-1][j-1]);
    }
  }
  
  const dtwDistance = dtw[n][m];
  const avgDistance = dtwDistance / Math.max(n, m);
  
  // Convert to accuracy: 0 = 100%, 0.1 = 90%, 0.2 = 82%, 0.5 = 61%, 1.0 = 37%
  const accuracy = Math.exp(-avgDistance * 2);
  
  console.log(`Rhythm DTW: ${n} vs ${m} intervals, distance ${dtwDistance.toFixed(2)}, avg ${avgDistance.toFixed(2)}, accuracy ${(accuracy*100).toFixed(1)}%`);
  return accuracy;
}

// Calculate spectral stability (measure of vocal control)
function calculateSpectralStability(features: number[][]): number {
  if (features.length < 2) return 0;
  
  const rmsValues = features.map(f => f[0]);
  const centroidValues = features.map(f => f[2]);
  
  // Calculate variance (lower variance = more stable/controlled)
  const rmsVariance = calculateVariance(rmsValues);
  const centroidVariance = calculateVariance(centroidValues);
  
  // Normalize variances (lower is better)
  const rmsStability = 1 / (1 + rmsVariance * 100);
  const centroidStability = 1 / (1 + centroidVariance * 0.0001);
  
  return (rmsStability + centroidStability) / 2;
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting real audio analysis...');
    
    const { noviceAudio, professionalAudio, sampleRate: clientSampleRate, isPCM } = await req.json();
    
    if (!noviceAudio || !professionalAudio) {
      throw new Error('Both audio files required');
    }

    const sampleRate = clientSampleRate || 22050;
    console.log(`Using sample rate: ${sampleRate}Hz, isPCM: ${isPCM}`);
    
    console.log('Decoding audio buffers...');
    const noviceBuffer = decodeAudioBuffer(noviceAudio);
    const professionalBuffer = decodeAudioBuffer(professionalAudio);
    
    console.log(`Novice: ${noviceBuffer.length} samples, Professional: ${professionalBuffer.length} samples`);
    
    // Extract pitch contours
    console.log('Extracting pitch...');
    const novicePitch = extractPitch(noviceBuffer, sampleRate);
    const professionalPitch = extractPitch(professionalBuffer, sampleRate);
    console.log(`Extracted ${novicePitch.length} novice and ${professionalPitch.length} professional pitch points`);
    
    // Extract spectral features for timbre
    console.log('Extracting spectral features...');
    const noviceFeatures = extractSpectralFeatures(noviceBuffer, sampleRate);
    const professionalFeatures = extractSpectralFeatures(professionalBuffer, sampleRate);
    
    // Detect onsets for rhythm
    console.log('Detecting onsets...');
    const noviceOnsets = detectOnsets(noviceBuffer, sampleRate);
    const profOnsets = detectOnsets(professionalBuffer, sampleRate);
    console.log(`Detected ${noviceOnsets.length} novice and ${profOnsets.length} professional onsets`);
    
    // Calculate accuracy metrics
    const pitchAccuracy = calculatePitchAccuracy(novicePitch, professionalPitch);
    const rhythmAccuracy = calculateRhythmAccuracy(noviceOnsets, profOnsets);
    
    // Calculate timbre similarity using correlation and normalized distance
    const minFeatureLength = Math.min(noviceFeatures.length, professionalFeatures.length);
    
    // Extract feature vectors
    const noviceRMS = noviceFeatures.slice(0, minFeatureLength).map(f => f[0]);
    const profRMS = professionalFeatures.slice(0, minFeatureLength).map(f => f[0]);
    const noviceZCR = noviceFeatures.slice(0, minFeatureLength).map(f => f[1]);
    const profZCR = professionalFeatures.slice(0, minFeatureLength).map(f => f[1]);
    const noviceCentroid = noviceFeatures.slice(0, minFeatureLength).map(f => f[2]);
    const profCentroid = professionalFeatures.slice(0, minFeatureLength).map(f => f[2]);
    
    // Normalize features
    const normalize = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const std = Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
      return arr.map(x => std > 0 ? (x - mean) / std : 0);
    };
    
    const noviceRMSNorm = normalize(noviceRMS);
    const profRMSNorm = normalize(profRMS);
    const noviceZCRNorm = normalize(noviceZCR);
    const profZCRNorm = normalize(profZCR);
    const noviceCentroidNorm = normalize(noviceCentroid);
    const profCentroidNorm = normalize(profCentroid);
    
    // Calculate correlation coefficients
    const correlation = (a: number[], b: number[]) => {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
      return sum / a.length;
    };
    
    const rmsCorr = correlation(noviceRMSNorm, profRMSNorm);
    const zcrCorr = correlation(noviceZCRNorm, profZCRNorm);
    const centroidCorr = correlation(noviceCentroidNorm, profCentroidNorm);
    
    // Combine correlations (higher is better, range -1 to 1)
    const avgCorr = (rmsCorr * 0.4 + zcrCorr * 0.3 + centroidCorr * 0.3);
    // Convert to 0-1 similarity score
    const timbreScore = (avgCorr + 1) / 2;
    
    // Calculate emotion match using multiple factors
    // 1. Dynamic range similarity
    const noviceDynamicRange = Math.max(...noviceRMS) - Math.min(...noviceRMS);
    const profDynamicRange = Math.max(...profRMS) - Math.min(...profRMS);
    const dynamicRatio = Math.min(noviceDynamicRange, profDynamicRange) / (Math.max(noviceDynamicRange, profDynamicRange) + 0.001);
    
    // 2. Energy contour correlation
    const energyCorr = Math.abs(correlation(noviceRMSNorm, profRMSNorm));
    
    // 3. Spectral variability similarity
    const variance = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    };
    const noviceVar = variance(noviceCentroid);
    const profVar = variance(profCentroid);
    const varRatio = Math.min(noviceVar, profVar) / (Math.max(noviceVar, profVar) + 0.001);
    
    // Combine emotion factors
    const emotionScore = dynamicRatio * 0.4 + energyCorr * 0.4 + varRatio * 0.2;
    
    console.log(`Accuracy - Pitch: ${(pitchAccuracy*100).toFixed(1)}%, Rhythm: ${(rhythmAccuracy*100).toFixed(1)}%, Timbre: ${(timbreScore*100).toFixed(1)}%, Emotion: ${(emotionScore*100).toFixed(1)}%`);
    
    const results = {
      pitchAccuracy: {
        novice: pitchAccuracy,
        professional: 1.0,
        difference: Math.abs(1.0 - pitchAccuracy)
      },
      rhythmTiming: {
        novice: rhythmAccuracy,
        professional: 1.0,
        difference: Math.abs(1.0 - rhythmAccuracy)
      },
      mfccDistance: {
        novice: timbreScore,
        professional: 1.0,
        difference: Math.abs(1.0 - timbreScore)
      },
      emotionMatch: {
        novice: emotionScore,
        professional: 1.0,
        difference: Math.abs(1.0 - emotionScore)
      },
      pitchData: {
        novice: novicePitch.filter(p => p > 0),
        professional: professionalPitch.filter(p => p > 0),
        sampleRate: sampleRate
      }
    };
    
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Audio analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
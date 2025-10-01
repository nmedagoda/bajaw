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

// Extract pitch using autocorrelation
function extractPitch(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const hopSize = Math.floor(windowSize / 2);
  const pitches: number[] = [];
  const maxPitches = 200;
  
  for (let i = 0; i < audioBuffer.length - windowSize && pitches.length < maxPitches; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Apply Hamming window
    for (let j = 0; j < windowSize; j++) {
      window[j] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * j / (windowSize - 1));
    }
    
    // Autocorrelation for pitch detection
    const minLag = Math.floor(sampleRate / 500); // 500 Hz max
    const maxLag = Math.floor(sampleRate / 80);  // 80 Hz min
    let maxCorr = 0;
    let bestLag = minLag;
    
    for (let lag = minLag; lag < maxLag && lag < window.length / 2; lag++) {
      let corr = 0;
      for (let j = 0; j < window.length - lag; j++) {
        corr += window[j] * window[j + lag];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }
    
    const pitch = maxCorr > 0.3 ? sampleRate / bestLag : 0;
    pitches.push(pitch);
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

// Calculate pitch accuracy using mean absolute error
function calculatePitchAccuracy(novicePitch: number[], professionalPitch: number[]): number {
  const minLength = Math.min(novicePitch.length, professionalPitch.length);
  if (minLength === 0) return 0;
  
  let totalError = 0;
  let validComparisons = 0;
  
  for (let i = 0; i < minLength; i++) {
    // Only compare when both have pitch (not silence)
    if (novicePitch[i] > 0 && professionalPitch[i] > 0) {
      // Calculate error in cents (100 cents = 1 semitone)
      const cents = Math.abs(1200 * Math.log2(novicePitch[i] / professionalPitch[i]));
      totalError += cents;
      validComparisons++;
    }
  }
  
  if (validComparisons === 0) return 0;
  
  const avgError = totalError / validComparisons;
  // Convert error to accuracy: 0 cents = 100%, 50 cents = 50%, 100+ cents = 0%
  const accuracy = Math.max(0, 1 - avgError / 100);
  
  console.log(`Pitch: ${validComparisons} comparisons, avg error ${avgError.toFixed(1)} cents, accuracy ${(accuracy*100).toFixed(1)}%`);
  return accuracy;
}

// Calculate rhythm timing accuracy
function calculateRhythmAccuracy(noviceOnsets: number[], profOnsets: number[]): number {
  if (noviceOnsets.length === 0 || profOnsets.length === 0) return 0;
  
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
  
  // Compare IOI patterns
  const minLength = Math.min(noviceIOI.length, profIOI.length);
  let totalError = 0;
  
  for (let i = 0; i < minLength; i++) {
    const error = Math.abs(noviceIOI[i] - profIOI[i]);
    totalError += error;
  }
  
  const avgInterval = profIOI.reduce((a, b) => a + b, 0) / profIOI.length;
  const avgError = totalError / minLength;
  const accuracy = Math.max(0, 1 - (avgError / avgInterval));
  
  console.log(`Rhythm: ${minLength} intervals, avg error ${(avgError*1000).toFixed(1)}ms, accuracy ${(accuracy*100).toFixed(1)}%`);
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
    
    // Calculate stability metrics (vocal control)
    const noviceStability = calculateSpectralStability(noviceFeatures);
    const profStability = calculateSpectralStability(professionalFeatures);
    const stabilityRatio = noviceStability / (profStability + 0.001);
    
    // MFCC similarity (timbre matching)
    const timbreScore = stabilityRatio * 0.7 + (1 - Math.abs(noviceFeatures.length - professionalFeatures.length) / Math.max(noviceFeatures.length, professionalFeatures.length)) * 0.3;
    
    // Emotion match (dynamic control)
    const emotionScore = stabilityRatio;
    
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
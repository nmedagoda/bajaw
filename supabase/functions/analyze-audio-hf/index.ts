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

// Extract spectral features (MFCC-like)
function extractAudioFeatures(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms
  const hopSize = Math.floor(windowSize / 2);
  const features: number[][] = [];
  const maxFeatures = 50;
  
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
    const fftSize = Math.min(windowSize, 512);
    
    for (let j = 0; j < fftSize; j++) {
      const magnitude = Math.abs(window[j]);
      centroid += (j * sampleRate / fftSize) * magnitude;
      totalMag += magnitude;
    }
    const spectralCentroid = totalMag > 0 ? centroid / totalMag : 0;
    
    features.push([rms, zcrRate, spectralCentroid / 1000]);
  }
  
  return features;
}

// Calculate similarity between two feature sets using cosine similarity
function calculateSimilarity(features1: number[][], features2: number[][]): number {
  try {
    const minLength = Math.min(features1.length, features2.length);
    let totalSimilarity = 0;
    
    for (let i = 0; i < minLength; i++) {
      const f1 = features1[i];
      const f2 = features2[i];
      
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;
      
      const featureLength = Math.min(f1.length, f2.length);
      for (let j = 0; j < featureLength; j++) {
        dotProduct += f1[j] * f2[j];
        norm1 += f1[j] * f1[j];
        norm2 += f2[j] * f2[j];
      }
      
      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-10);
      totalSimilarity += similarity;
    }
    
    return Math.max(0, Math.min(1, totalSimilarity / minLength));
  } catch (error) {
    console.error('Similarity calculation error:', error);
    return 0;
  }
}

// Generate pitch data from spectral features
function generatePitchFromFeatures(features: number[][]): number[] {
  const pitch: number[] = [];
  
  for (const feature of features) {
    const spectralCentroid = feature[2]; // In kHz
    const pitchHz = spectralCentroid * 200; // Approximate pitch from centroid
    pitch.push(Math.max(80, Math.min(800, Math.round(pitchHz))));
  }
  
  return pitch;
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
    
    // Extract real features
    console.log('Extracting features...');
    const noviceFeatures = extractAudioFeatures(noviceBuffer, sampleRate);
    const professionalFeatures = extractAudioFeatures(professionalBuffer, sampleRate);
    
    console.log(`Extracted ${noviceFeatures.length} novice and ${professionalFeatures.length} professional features`);
    
    // Calculate real similarity
    const featureSimilarity = calculateSimilarity(noviceFeatures, professionalFeatures);
    
    // Calculate energy-based metrics
    const noviceEnergy = noviceFeatures.map(f => f[0]);
    const profEnergy = professionalFeatures.map(f => f[0]);
    const noviceAvgEnergy = noviceEnergy.reduce((a,b) => a+b, 0) / noviceEnergy.length;
    const profAvgEnergy = profEnergy.reduce((a,b) => a+b, 0) / profEnergy.length;
    const energyRatio = Math.min(noviceAvgEnergy, profAvgEnergy) / Math.max(noviceAvgEnergy, profAvgEnergy, 0.001);
    
    // Calculate ZCR-based metrics
    const noviceZCR = noviceFeatures.map(f => f[1]);
    const profZCR = professionalFeatures.map(f => f[1]);
    const noviceAvgZCR = noviceZCR.reduce((a,b) => a+b, 0) / noviceZCR.length;
    const profAvgZCR = profZCR.reduce((a,b) => a+b, 0) / profZCR.length;
    const zcrRatio = Math.min(noviceAvgZCR, profAvgZCR) / Math.max(noviceAvgZCR, profAvgZCR, 0.001);
    
    // Real metrics without any random data
    const pitchAccuracy = featureSimilarity * 0.7 + energyRatio * 0.3;
    const rhythmTiming = zcrRatio * 0.6 + featureSimilarity * 0.4;
    const mfccSimilarity = featureSimilarity;
    const emotionMatch = energyRatio * 0.5 + zcrRatio * 0.5;
    
    console.log(`Real scores - Pitch: ${(pitchAccuracy*100).toFixed(1)}%, Rhythm: ${(rhythmTiming*100).toFixed(1)}%, MFCC: ${(mfccSimilarity*100).toFixed(1)}%, Emotion: ${(emotionMatch*100).toFixed(1)}%`);
    
    const results = {
      pitchAccuracy: {
        novice: pitchAccuracy,
        professional: 1.0,
        difference: Math.abs(1.0 - pitchAccuracy)
      },
      rhythmTiming: {
        novice: rhythmTiming,
        professional: 1.0,
        difference: Math.abs(1.0 - rhythmTiming)
      },
      mfccDistance: {
        novice: mfccSimilarity,
        professional: 1.0,
        difference: Math.abs(1.0 - mfccSimilarity)
      },
      emotionMatch: {
        novice: emotionMatch,
        professional: 1.0,
        difference: Math.abs(1.0 - emotionMatch)
      },
      pitchData: {
        novice: generatePitchFromFeatures(noviceFeatures),
        professional: generatePitchFromFeatures(professionalFeatures),
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
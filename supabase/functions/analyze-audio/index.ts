import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple DTW implementation
function dtw(seq1: number[], seq2: number[]): number {
  const m = seq1.length;
  const n = seq2.length;
  const dtw = Array(m + 1).fill(null).map(() => Array(n + 1).fill(Infinity));
  
  dtw[0][0] = 0;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = Math.abs(seq1[i - 1] - seq2[j - 1]);
      dtw[i][j] = cost + Math.min(
        dtw[i - 1][j],     // insertion
        dtw[i][j - 1],     // deletion
        dtw[i - 1][j - 1]  // match
      );
    }
  }
  
  return dtw[m][n] / Math.max(m, n); // normalized
}

// Simulate pitch extraction (in reality would use FFT)
function extractPitch(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.025); // 25ms windows
  const hopSize = Math.floor(windowSize / 2);
  const pitches: number[] = [];
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Simple autocorrelation-based pitch detection
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    for (let period = Math.floor(sampleRate / 800); period < Math.floor(sampleRate / 80); period++) {
      let correlation = 0;
      for (let j = 0; j < windowSize - period; j++) {
        correlation += window[j] * window[j + period];
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    const pitch = bestPeriod > 0 ? sampleRate / bestPeriod : 0;
    pitches.push(pitch);
  }
  
  return pitches;
}

// Simulate onset detection
function detectOnsets(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.046); // ~46ms
  const hopSize = Math.floor(windowSize / 4);
  const onsets: number[] = [];
  
  let prevEnergy = 0;
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    const energy = window.reduce((sum, sample) => sum + sample * sample, 0);
    
    // Simple onset detection based on energy increase
    if (energy > prevEnergy * 1.5 && energy > 0.01) {
      onsets.push(i / sampleRate);
    }
    
    prevEnergy = energy;
  }
  
  return onsets;
}

// Simulate MFCC extraction
function extractMFCC(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const windowSize = Math.floor(sampleRate * 0.025);
  const hopSize = Math.floor(windowSize / 2);
  const mfccs: number[][] = [];
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Simplified MFCC: just use spectral features
    const mfcc = [];
    for (let j = 0; j < 13; j++) {
      let coeff = 0;
      for (let k = 0; k < window.length; k++) {
        coeff += window[k] * Math.cos((Math.PI * j * k) / window.length);
      }
      mfcc.push(coeff / window.length);
    }
    
    mfccs.push(mfcc);
  }
  
  return mfccs;
}

// Simulate emotion detection (sadness)
function detectSadness(mfccs: number[][]): number {
  // Simplified emotion detection based on spectral features
  let sadnessScore = 0;
  
  for (const mfcc of mfccs) {
    // Lower spectral centroid and energy often indicate sadness
    const spectralCentroid = mfcc[1];
    const energy = mfcc[0];
    
    // Simple heuristic: lower values suggest sadness
    const frameScore = Math.max(0, 1 - (Math.abs(spectralCentroid) + Math.abs(energy)) / 2);
    sadnessScore += frameScore;
  }
  
  return Math.min(1, sadnessScore / mfccs.length);
}

// Convert audio buffer from base64
function decodeAudioBuffer(base64: string): Float32Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Convert to Float32Array (simplified - in reality would decode MP3)
  const float32Array = new Float32Array(bytes.length / 4);
  const dataView = new DataView(bytes.buffer);
  
  for (let i = 0; i < float32Array.length; i++) {
    float32Array[i] = dataView.getFloat32(i * 4, true) / 32768; // normalize to [-1, 1]
  }
  
  return float32Array;
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
    
    const sampleRate = 44100; // Assume standard sample rate
    
    // Decode audio buffers
    const noviceBuffer = decodeAudioBuffer(noviceAudio);
    const professionalBuffer = decodeAudioBuffer(professionalAudio);
    
    console.log('Audio buffers decoded')

    // Extract features
    const novicePitch = extractPitch(noviceBuffer, sampleRate);
    const professionalPitch = extractPitch(professionalBuffer, sampleRate);
    
    const noviceOnsets = detectOnsets(noviceBuffer, sampleRate);
    const professionalOnsets = detectOnsets(professionalBuffer, sampleRate);
    
    const noviceMFCC = extractMFCC(noviceBuffer, sampleRate);
    const professionalMFCC = extractMFCC(professionalBuffer, sampleRate);
    
    console.log('Features extracted')

    // Calculate metrics
    
    // 1. Pitch Accuracy using DTW
    const pitchAccuracy = 1 - (dtw(novicePitch, professionalPitch) / 100); // normalized
    
    // 2. Rhythm Timing Error
    const rhythmError = Math.abs(noviceOnsets.length - professionalOnsets.length) / 
                       Math.max(noviceOnsets.length, professionalOnsets.length);
    
    // 3. MFCC Distance with DTW
    let mfccDistance = 0;
    for (let i = 0; i < 13; i++) {
      const noviceCoeffs = noviceMFCC.map(frame => frame[i]);
      const professionalCoeffs = professionalMFCC.map(frame => frame[i]);
      mfccDistance += dtw(noviceCoeffs, professionalCoeffs);
    }
    mfccDistance /= 13; // average across coefficients
    
    // 4. Emotion Match (Sadness)
    const noviceSadness = detectSadness(noviceMFCC);
    const professionalSadness = detectSadness(professionalMFCC);
    const emotionMatch = 1 - Math.abs(noviceSadness - professionalSadness);
    
    console.log('Analysis complete')

    const results = {
      pitchAccuracy: {
        novice: Math.max(0, Math.min(1, pitchAccuracy)),
        professional: 1.0, // reference
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, pitchAccuracy)))
      },
      rhythmTiming: {
        novice: Math.max(0, Math.min(1, 1 - rhythmError)),
        professional: 1.0, // reference
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, 1 - rhythmError)))
      },
      mfccDistance: {
        novice: Math.max(0, Math.min(1, 1 - (mfccDistance / 10))),
        professional: 1.0, // reference
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, 1 - (mfccDistance / 10))))
      },
      emotionMatch: {
        novice: Math.max(0, Math.min(1, emotionMatch)),
        professional: Math.max(0, Math.min(1, professionalSadness)),
        difference: Math.abs(Math.max(0, Math.min(1, professionalSadness)) - Math.max(0, Math.min(1, emotionMatch)))
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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { noviceAudio, professionalAudio } = await req.json();
    console.log('Starting spectrogram audio analysis...');

    // Decode and process audio buffers
    console.log('Decoding audio buffers...');
    
    let noviceBuffer: Float32Array | null = null;
    let professionalBuffer: Float32Array | null = null;

    if (noviceAudio) {
      console.log('Starting spectrogram audio decode, base64 length:', noviceAudio.length);
      const noviceBinary = atob(noviceAudio);
      console.log('Decoded binary string:', noviceBinary.length, 'bytes');
      
      // Process as raw audio samples
      console.log('Processing', Math.floor(noviceBinary.length / 4), 'samples from', noviceBinary.length, 'bytes of audio data');
      const noviceSamples = new Float32Array(Math.floor(noviceBinary.length / 4));
      
      for (let i = 0; i < noviceSamples.length; i++) {
        const bytes = new Uint8Array(4);
        for (let j = 0; j < 4 && (i * 4 + j) < noviceBinary.length; j++) {
          bytes[j] = noviceBinary.charCodeAt(i * 4 + j);
        }
        const view = new DataView(bytes.buffer);
        noviceSamples[i] = view.getFloat32(0, true); // true for little endian
      }
      
      noviceBuffer = noviceSamples;
      const maxAmp = noviceBuffer.length > 0 ? Math.max(...Array.from(noviceBuffer.slice(0, Math.min(1000, noviceBuffer.length)))) : 0;
      console.log('Successfully decoded', noviceBuffer.length, 'spectrogram audio samples, max amplitude:', maxAmp.toFixed(4));
    }

    if (professionalAudio) {
      console.log('Starting spectrogram audio decode, base64 length:', professionalAudio.length);
      const professionalBinary = atob(professionalAudio);
      console.log('Decoded binary string:', professionalBinary.length, 'bytes');
      
      console.log('Processing', Math.floor(professionalBinary.length / 4), 'samples from', professionalBinary.length, 'bytes of audio data');
      const professionalSamples = new Float32Array(Math.floor(professionalBinary.length / 4));
      
      for (let i = 0; i < professionalSamples.length; i++) {
        const bytes = new Uint8Array(4);
        for (let j = 0; j < 4 && (i * 4 + j) < professionalBinary.length; j++) {
          bytes[j] = professionalBinary.charCodeAt(i * 4 + j);
        }
        const view = new DataView(bytes.buffer);
        professionalSamples[i] = view.getFloat32(0, true);
      }
      
      professionalBuffer = professionalSamples;
      const maxAmp2 = professionalBuffer.length > 0 ? Math.max(...Array.from(professionalBuffer.slice(0, Math.min(1000, professionalBuffer.length)))) : 0;
      console.log('Successfully decoded', professionalBuffer.length, 'spectrogram audio samples, max amplitude:', maxAmp2.toFixed(4));
    }

    console.log('Audio decoded: Novice', noviceBuffer?.length || 0, 'samples, Professional', professionalBuffer?.length || 0, 'samples');

    // Extract spectral centroid features
    console.log('Extracting spectral centroid features...');
    
    const noviceSpectralCentroids = noviceBuffer ? extractSpectralCentroid(noviceBuffer) : [];
    const professionalSpectralCentroids = professionalBuffer ? extractSpectralCentroid(professionalBuffer) : [];

    console.log('Extracted spectrogram data:', noviceSpectralCentroids.length, 'novice points,', professionalSpectralCentroids.length, 'professional points');

    const spectrogramData = {
      novice: noviceSpectralCentroids,
      professional: professionalSpectralCentroids
    };

    console.log('Spectrogram analysis complete');

    return new Response(JSON.stringify({ spectrogramData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-audio-spectrogram function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractSpectralCentroid(audioBuffer: Float32Array): number[] {
  const frameSize = 2048; // Frame size for FFT
  const hopSize = 1024; // Hop size between frames
  const sampleRate = 22050; // Assumed sample rate
  const spectralCentroids: number[] = [];

  for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
    // Extract frame
    const frame = audioBuffer.slice(i, i + frameSize);
    
    // Apply window function (Hanning)
    const windowedFrame = applyHanningWindow(frame);
    
    // Compute FFT (simplified magnitude spectrum)
    const spectrum = computeMagnitudeSpectrum(windowedFrame);
    
    // Calculate spectral centroid
    const centroid = calculateSpectralCentroid(spectrum, sampleRate);
    spectralCentroids.push(centroid);
  }

  console.log('Extracted', spectralCentroids.length, 'spectral centroid values, avg centroid:', (spectralCentroids.reduce((a, b) => a + b, 0) / spectralCentroids.length).toFixed(2), 'Hz');
  return spectralCentroids;
}

function applyHanningWindow(frame: Float32Array): Float32Array {
  const windowed = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frame.length - 1)));
    windowed[i] = frame[i] * window;
  }
  return windowed;
}

function computeMagnitudeSpectrum(frame: Float32Array): Float32Array {
  // Simplified DFT for magnitude spectrum
  const N = frame.length;
  const spectrum = new Float32Array(N / 2);
  
  for (let k = 0; k < N / 2; k++) {
    let real = 0;
    let imag = 0;
    
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      real += frame[n] * Math.cos(angle);
      imag += frame[n] * Math.sin(angle);
    }
    
    spectrum[k] = Math.sqrt(real * real + imag * imag);
  }
  
  return spectrum;
}

function calculateSpectralCentroid(spectrum: Float32Array, sampleRate: number): number {
  let weightedSum = 0;
  let totalMagnitude = 0;
  
  for (let i = 0; i < spectrum.length; i++) {
    const frequency = (i * sampleRate) / (2 * spectrum.length);
    const magnitude = spectrum[i];
    
    weightedSum += frequency * magnitude;
    totalMagnitude += magnitude;
  }
  
  return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
}
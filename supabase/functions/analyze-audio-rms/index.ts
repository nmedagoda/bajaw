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
    console.log('Starting RMS audio analysis...');

    // Decode and process audio buffers
    console.log('Decoding audio buffers...');
    
    let noviceBuffer: Float32Array | null = null;
    let professionalBuffer: Float32Array | null = null;

    if (noviceAudio) {
      console.log('Starting RMS audio decode, base64 length:', noviceAudio.length);
      const noviceBinary = atob(noviceAudio);
      console.log('Decoded binary string:', noviceBinary.length, 'bytes');
      
      // Process as raw audio samples (assuming MP3 has been converted to raw samples)
      console.log('Processing', Math.floor(noviceBinary.length / 4), 'samples from', noviceBinary.length, 'bytes of audio data');
      const noviceSamples = new Float32Array(Math.floor(noviceBinary.length / 4));
      
      for (let i = 0; i < noviceSamples.length; i++) {
        // Convert 4 bytes to float32 (little endian)
        const bytes = new Uint8Array(4);
        for (let j = 0; j < 4 && (i * 4 + j) < noviceBinary.length; j++) {
          bytes[j] = noviceBinary.charCodeAt(i * 4 + j);
        }
        const view = new DataView(bytes.buffer);
        noviceSamples[i] = view.getFloat32(0, true); // true for little endian
      }
      
      noviceBuffer = noviceSamples;
      const maxAmp = noviceBuffer.length > 0 ? Math.max(...Array.from(noviceBuffer.slice(0, Math.min(1000, noviceBuffer.length)))) : 0;
      console.log('Successfully decoded', noviceBuffer.length, 'RMS audio samples, max amplitude:', maxAmp.toFixed(4));
    }

    if (professionalAudio) {
      console.log('Starting RMS audio decode, base64 length:', professionalAudio.length);
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
      console.log('Successfully decoded', professionalBuffer.length, 'RMS audio samples, max amplitude:', maxAmp2.toFixed(4));
    }

    console.log('Audio decoded: Novice', noviceBuffer?.length || 0, 'samples, Professional', professionalBuffer?.length || 0, 'samples');

    // Extract RMS features
    console.log('Extracting RMS features...');
    
    const noviceRMS = noviceBuffer ? extractRMS(noviceBuffer) : [];
    const professionalRMS = professionalBuffer ? extractRMS(professionalBuffer) : [];

    console.log('Extracted RMS data:', noviceRMS.length, 'novice points,', professionalRMS.length, 'professional points');

    const rmsData = {
      novice: noviceRMS,
      professional: professionalRMS
    };

    console.log('RMS analysis complete');

    return new Response(JSON.stringify({ rmsData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-audio-rms function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractRMS(audioBuffer: Float32Array): number[] {
  const frameSize = 1024; // Frame size for RMS calculation
  const hopSize = 512; // Hop size between frames
  const rmsValues: number[] = [];

  for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
    let sumSquares = 0;
    let validSamples = 0;
    
    // Calculate RMS for current frame
    for (let j = 0; j < frameSize && i + j < audioBuffer.length; j++) {
      const sample = audioBuffer[i + j];
      if (!isNaN(sample) && isFinite(sample)) {
        sumSquares += sample * sample;
        validSamples++;
      }
    }
    
    if (validSamples > 0) {
      const rms = Math.sqrt(sumSquares / validSamples);
      rmsValues.push(rms);
    } else {
      rmsValues.push(0);
    }
  }

    const maxRMS = rmsValues.length > 0 ? Math.max(...rmsValues) : 0;
    console.log('Extracted', rmsValues.length, 'RMS values, max RMS:', maxRMS.toFixed(4));
  return rmsValues;
}
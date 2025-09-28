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
          bytes[j] = noviceBinary.charCodeAt(i * 4 + j) & 0xFF;
        }
        const view = new DataView(bytes.buffer);
        let floatValue = view.getFloat32(0, true); // true for little endian
        
        // Validate and normalize the value
        if (!isFinite(floatValue) || isNaN(floatValue) || Math.abs(floatValue) > 1e10) {
          floatValue = 0;
        }
        
        noviceSamples[i] = floatValue;
      }
      
      // Find max amplitude and normalize if needed
      let maxAmp = 0;
      let validSamples = 0;
      for (let i = 0; i < noviceSamples.length; i++) {
        if (isFinite(noviceSamples[i]) && !isNaN(noviceSamples[i])) {
          maxAmp = Math.max(maxAmp, Math.abs(noviceSamples[i]));
          validSamples++;
        } else {
          noviceSamples[i] = 0;
        }
      }
      
      // Normalize to [-1, 1] range if values are too large
      if (maxAmp > 1) {
        console.log('Normalizing novice audio from max amplitude', maxAmp, 'to [-1, 1]');
        for (let i = 0; i < noviceSamples.length; i++) {
          noviceSamples[i] = noviceSamples[i] / maxAmp;
        }
        maxAmp = 1;
      }
      
      noviceBuffer = noviceSamples;
      console.log('Successfully decoded', noviceBuffer.length, 'RMS audio samples, max amplitude:', maxAmp.toFixed(4), 'valid samples:', validSamples);
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
          bytes[j] = professionalBinary.charCodeAt(i * 4 + j) & 0xFF;
        }
        const view = new DataView(bytes.buffer);
        let floatValue = view.getFloat32(0, true);
        
        // Validate and normalize the value
        if (!isFinite(floatValue) || isNaN(floatValue) || Math.abs(floatValue) > 1e10) {
          floatValue = 0;
        }
        
        professionalSamples[i] = floatValue;
      }
      
      // Find max amplitude and normalize if needed
      let maxAmp2 = 0;
      let validSamples2 = 0;
      for (let i = 0; i < professionalSamples.length; i++) {
        if (isFinite(professionalSamples[i]) && !isNaN(professionalSamples[i])) {
          maxAmp2 = Math.max(maxAmp2, Math.abs(professionalSamples[i]));
          validSamples2++;
        } else {
          professionalSamples[i] = 0;
        }
      }
      
      // Normalize to [-1, 1] range if values are too large
      if (maxAmp2 > 1) {
        console.log('Normalizing professional audio from max amplitude', maxAmp2, 'to [-1, 1]');
        for (let i = 0; i < professionalSamples.length; i++) {
          professionalSamples[i] = professionalSamples[i] / maxAmp2;
        }
        maxAmp2 = 1;
      }
      
      professionalBuffer = professionalSamples;
      console.log('Successfully decoded', professionalBuffer.length, 'RMS audio samples, max amplitude:', maxAmp2.toFixed(4), 'valid samples:', validSamples2);
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
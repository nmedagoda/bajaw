import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpectrogramDataPoint {
  time: number;
  novice: number | null;
  professional: number | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spectrogramData } = await req.json();
    
    if (!spectrogramData || !Array.isArray(spectrogramData)) {
      throw new Error('Invalid spectrogram data provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    console.log('Using Lovable AI with Gemini for spectrogram analysis...');

    // Analyze the spectrogram data
    const analysis = analyzeSpectrogramData(spectrogramData);
    
    // Create prompt for LLM analysis
    const prompt = createAnalysisPrompt(analysis);
    
    let llmResponse = null;
    
    try {
      console.log('Calling Lovable AI Gateway with Gemini model...');
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert vocal coach providing detailed performance analysis. Keep responses under 500 tokens.'
            },
            { role: 'user', content: prompt }
          ],
        })
      });

      if (response.status === 429) {
        console.log('Rate limit exceeded, using fallback');
        llmResponse = generateFallbackAnalysis(analysis);
      } else if (response.status === 402) {
        console.log('Payment required, using fallback');
        llmResponse = generateFallbackAnalysis(analysis);
      } else if (response.ok) {
        const result = await response.json();
        console.log('Success with Gemini model');
        llmResponse = result.choices[0].message.content;
      } else {
        const errorText = await response.text();
        console.log(`Lovable AI failed: ${response.status} ${errorText}`);
        llmResponse = generateFallbackAnalysis(analysis);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Error calling Lovable AI: ${errorMessage}`);
      llmResponse = generateFallbackAnalysis(analysis);
    }

    // Fallback analysis if response is empty
    if (!llmResponse) {
      llmResponse = generateFallbackAnalysis(analysis);
    }

    return new Response(JSON.stringify({
      analysis: llmResponse,
      metrics: analysis
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-spectrogram function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzeSpectrogramData(spectrogramData: SpectrogramDataPoint[]) {
  const noviceValues = spectrogramData.filter(d => d.novice !== null).map(d => d.novice!);
  const professionalValues = spectrogramData.filter(d => d.professional !== null).map(d => d.professional!);
  
  // Calculate brightness (average spectral centroid values)
  const noviceBrightness = calculateAverage(noviceValues);
  const professionalBrightness = calculateAverage(professionalValues);
  
  // Calculate consistency (standard deviation)
  const noviceConsistency = calculateStandardDeviation(noviceValues);
  const professionalConsistency = calculateStandardDeviation(professionalValues);
  
  // Calculate energy distribution (variance and range)
  const noviceEnergyDistribution = calculateEnergyDistribution(noviceValues);
  const professionalEnergyDistribution = calculateEnergyDistribution(professionalValues);
  
  // Calculate expressive modulation (variation over time)
  const noviceModulation = calculateExpressiveModulation(spectrogramData, 'novice');
  const professionalModulation = calculateExpressiveModulation(spectrogramData, 'professional');
  
  return {
    brightness: {
      novice: noviceBrightness,
      professional: professionalBrightness,
      comparison: professionalBrightness > 0 ? noviceBrightness / professionalBrightness : 0
    },
    consistency: {
      novice: noviceConsistency,
      professional: professionalConsistency,
      comparison: professionalConsistency > 0 ? noviceConsistency / professionalConsistency : 0
    },
    energyDistribution: {
      novice: noviceEnergyDistribution,
      professional: professionalEnergyDistribution,
      comparison: professionalEnergyDistribution > 0 ? noviceEnergyDistribution / professionalEnergyDistribution : 0
    },
    expressiveModulation: {
      novice: noviceModulation,
      professional: professionalModulation,
      comparison: professionalModulation > 0 ? noviceModulation / professionalModulation : 0
    }
  };
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateAverage(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateEnergyDistribution(values: number[]): number {
  if (values.length === 0) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const variance = calculateStandardDeviation(values);
  
  // Return a combined metric representing energy distribution spread
  return range * variance;
}

function calculateExpressiveModulation(spectrogramData: SpectrogramDataPoint[], type: 'novice' | 'professional'): number {
  // Calculate modulation by analyzing changes over time segments
  const segmentSize = Math.floor(spectrogramData.length / 10); // Divide into 10 segments
  let segmentVariations = [];
  
  for (let i = 0; i < 10; i++) {
    const start = i * segmentSize;
    const end = Math.min(start + segmentSize, spectrogramData.length);
    const segment = spectrogramData.slice(start, end);
    const values = segment.filter(d => d[type] !== null).map(d => d[type]!);
    
    if (values.length > 1) {
      // Calculate variation within segment
      let totalVariation = 0;
      for (let j = 1; j < values.length; j++) {
        totalVariation += Math.abs(values[j] - values[j - 1]);
      }
      segmentVariations.push(totalVariation / (values.length - 1));
    }
  }
  
  if (segmentVariations.length === 0) return 0;
  
  // Return average modulation across segments
  return calculateAverage(segmentVariations);
}

function createAnalysisPrompt(analysis: any): string {
  return `Analyze this vocal spectrogram performance data and provide insights on Brightness, Consistency, Energy Distribution, and Expressive Modulation:

Brightness (spectral centroid): Novice avg: ${analysis.brightness.novice.toFixed(2)} Hz, Professional: ${analysis.brightness.professional.toFixed(2)} Hz
Consistency (spectral stability): Novice std dev: ${analysis.consistency.novice.toFixed(2)}, Professional: ${analysis.consistency.professional.toFixed(2)}
Energy Distribution (spectral spread): Novice: ${analysis.energyDistribution.novice.toFixed(2)}, Professional: ${analysis.energyDistribution.professional.toFixed(2)}
Expressive Modulation (dynamic variation): Novice: ${analysis.expressiveModulation.novice.toFixed(2)}, Professional: ${analysis.expressiveModulation.professional.toFixed(2)}

Please provide a detailed analysis covering these four spectral aspects, followed by a 3-line conclusion. Focus on actionable insights for vocal improvement in terms of timbre and expression.`;
}

function generateFallbackAnalysis(analysis: any): string {
  let brightnessText = "";
  if (analysis.brightness.comparison < 0.8) {
    brightnessText = "**Brightness**: The novice performance shows lower spectral brightness compared to the professional, indicating a darker or more muffled vocal tone. Work on forward vocal placement and breath support for clearer, brighter resonance.";
  } else if (analysis.brightness.comparison > 1.2) {
    brightnessText = "**Brightness**: Higher spectral brightness than the professional standard, which may indicate tension or strain. Focus on relaxed throat position and balanced resonance.";
  } else {
    brightnessText = "**Brightness**: Good spectral balance, approaching professional levels of vocal brightness and clarity.";
  }

  let consistencyText = "";
  if (analysis.consistency.comparison > 1.5) {
    consistencyText = "**Consistency**: Significant variation in spectral characteristics throughout the performance. Practice maintaining consistent vocal placement and breath support across the entire song.";
  } else if (analysis.consistency.comparison > 1.2) {
    consistencyText = "**Consistency**: Moderate spectral consistency with some fluctuations. Focus on steady airflow and consistent vocal technique.";
  } else {
    consistencyText = "**Consistency**: Strong spectral consistency maintained throughout the performance, demonstrating good vocal control.";
  }

  let energyText = "";
  if (analysis.energyDistribution.comparison < 0.7) {
    energyText = "**Energy Distribution**: More limited spectral energy distribution compared to professional standard. Work on vocal exercises that expand harmonic richness and overtone production.";
  } else if (analysis.energyDistribution.comparison > 1.3) {
    energyText = "**Energy Distribution**: Broader spectral energy distribution, which may indicate good harmonic richness or potential vocal tension. Ensure technique supports this range.";
  } else {
    energyText = "**Energy Distribution**: Well-balanced spectral energy distribution approaching professional levels.";
  }

  let modulationText = "";
  if (analysis.expressiveModulation.comparison < 0.8) {
    modulationText = "**Expressive Modulation**: Less dynamic spectral variation than professional standard. Practice adding more expressive color and emotional nuance to your vocal delivery.";
  } else if (analysis.expressiveModulation.comparison > 1.3) {
    modulationText = "**Expressive Modulation**: High level of spectral modulation, showing good expressive range. Ensure control is maintained while expressing emotion.";
  } else {
    modulationText = "**Expressive Modulation**: Appropriate level of spectral variation demonstrating good expressive control.";
  }

  const conclusion = `
**Conclusion**: The spectral analysis reveals key areas for vocal development focusing on ${analysis.brightness.comparison < 0.9 ? 'brightness enhancement and ' : ''}${analysis.consistency.comparison > 1.3 ? 'spectral consistency' : 'fine-tuning expression'}. Regular practice with vowel modification exercises and resonance work will improve tonal quality and spectral characteristics. Continue developing dynamic control while maintaining consistent vocal technique across all expressive ranges.`;

  return `${brightnessText}\n\n${consistencyText}\n\n${energyText}\n\n${modulationText}\n\n${conclusion}`;
}
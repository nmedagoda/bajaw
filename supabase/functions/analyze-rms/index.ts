import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RMSDataPoint {
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
    const { rmsData } = await req.json();
    
    if (!rmsData || !Array.isArray(rmsData)) {
      throw new Error('Invalid RMS data provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    console.log('Using Lovable AI with Gemini for RMS loudness analysis...');

    // Analyze the RMS data
    const analysis = analyzeRMSData(rmsData);
    
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
      console.log('Using fallback analysis');
      llmResponse = generateFallbackAnalysis(analysis);
    }

    return new Response(JSON.stringify({
      analysis: llmResponse,
      metrics: analysis
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-rms function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzeRMSData(rmsData: RMSDataPoint[]) {
  const noviceValues = rmsData.filter(d => d.novice !== null).map(d => d.novice!);
  const professionalValues = rmsData.filter(d => d.professional !== null).map(d => d.professional!);
  
  // Calculate overall loudness levels (average RMS values)
  const noviceLoudness = calculateAverage(noviceValues);
  const professionalLoudness = calculateAverage(professionalValues);
  
  // Calculate consistency (standard deviation)
  const noviceConsistency = calculateStandardDeviation(noviceValues);
  const professionalConsistency = calculateStandardDeviation(professionalValues);
  
  // Calculate dynamic range (difference between max and min, plus variation)
  const noviceDynamicRange = calculateDynamicRange(noviceValues);
  const professionalDynamicRange = calculateDynamicRange(professionalValues);
  
  // Calculate sustain & endurance (consistency over time segments)
  const noviceEndurance = calculateEndurance(rmsData, 'novice');
  const professionalEndurance = calculateEndurance(rmsData, 'professional');
  
  return {
    loudness: {
      novice: noviceLoudness,
      professional: professionalLoudness,
      comparison: professionalLoudness > 0 ? noviceLoudness / professionalLoudness : 0
    },
    consistency: {
      novice: noviceConsistency,
      professional: professionalConsistency,
      comparison: professionalConsistency > 0 ? noviceConsistency / professionalConsistency : 0
    },
    dynamicRange: {
      novice: noviceDynamicRange,
      professional: professionalDynamicRange,
      comparison: professionalDynamicRange > 0 ? noviceDynamicRange / professionalDynamicRange : 0
    },
    endurance: {
      novice: noviceEndurance,
      professional: professionalEndurance,
      comparison: professionalEndurance > 0 ? noviceEndurance / professionalEndurance : 0
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

function calculateDynamicRange(values: number[]): number {
  if (values.length === 0) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  // Also consider the variation across the performance
  const stdDev = calculateStandardDeviation(values);
  
  // Combine range and variation for dynamic range metric
  return range + (stdDev * 2);
}

function calculateEndurance(rmsData: RMSDataPoint[], type: 'novice' | 'professional'): number {
  // Calculate endurance by analyzing consistency over time segments
  const segmentSize = Math.floor(rmsData.length / 8); // Divide into 8 segments
  let segmentAverages = [];
  
  for (let i = 0; i < 8; i++) {
    const start = i * segmentSize;
    const end = Math.min(start + segmentSize, rmsData.length);
    const segment = rmsData.slice(start, end);
    const values = segment.filter(d => d[type] !== null).map(d => d[type]!);
    
    if (values.length > 0) {
      segmentAverages.push(calculateAverage(values));
    }
  }
  
  if (segmentAverages.length === 0) return 0;
  
  // Calculate consistency across segments (lower variation = better endurance)
  const segmentVariation = calculateStandardDeviation(segmentAverages);
  const averageLevel = calculateAverage(segmentAverages);
  
  // Return endurance score (higher is better)
  return averageLevel > 0 ? Math.max(0, 100 - (segmentVariation / averageLevel) * 100) : 0;
}

function createAnalysisPrompt(analysis: any): string {
  return `Analyze this vocal RMS loudness performance data and provide insights on Overall Loudness Levels, Consistency, Dynamic Range, and Sustain & Endurance:

Overall Loudness Levels: Novice avg: ${analysis.loudness.novice.toFixed(3)}, Professional: ${analysis.loudness.professional.toFixed(3)}
Consistency (RMS stability): Novice std dev: ${analysis.consistency.novice.toFixed(3)}, Professional: ${analysis.consistency.professional.toFixed(3)}
Dynamic Range: Novice: ${analysis.dynamicRange.novice.toFixed(3)}, Professional: ${analysis.dynamicRange.professional.toFixed(3)}
Sustain & Endurance: Novice: ${analysis.endurance.novice.toFixed(1)}%, Professional: ${analysis.endurance.professional.toFixed(1)}%

Please provide a detailed analysis covering these four loudness aspects, followed by a 3-line conclusion. Focus on actionable insights for vocal improvement in terms of breath support and volume control.`;
}

function generateFallbackAnalysis(analysis: any): string {
  let loudnessText = "";
  if (analysis.loudness.comparison < 0.8) {
    loudnessText = "**Overall Loudness Levels**: The novice performance shows lower overall loudness compared to the professional standard. Focus on breath support and diaphragmatic breathing to achieve more consistent vocal power without strain.";
  } else if (analysis.loudness.comparison > 1.2) {
    loudnessText = "**Overall Loudness Levels**: Higher loudness levels than professional standard, which may indicate over-projection or tension. Work on controlled volume with proper breath management.";
  } else {
    loudnessText = "**Overall Loudness Levels**: Good loudness balance, approaching professional levels of vocal projection.";
  }

  let consistencyText = "";
  if (analysis.consistency.comparison > 1.5) {
    consistencyText = "**Consistency**: Significant variation in loudness levels throughout the performance. Practice maintaining steady breath support and consistent vocal placement across the entire song.";
  } else if (analysis.consistency.comparison > 1.2) {
    consistencyText = "**Consistency**: Moderate loudness consistency with some fluctuations. Focus on steady airflow and consistent diaphragmatic support.";
  } else {
    consistencyText = "**Consistency**: Strong loudness consistency maintained throughout the performance, demonstrating good breath control.";
  }

  let dynamicText = "";
  if (analysis.dynamicRange.comparison < 0.7) {
    dynamicText = "**Dynamic Range**: More limited dynamic range compared to professional standard. Practice exercises that develop both soft and powerful vocal delivery while maintaining control.";
  } else if (analysis.dynamicRange.comparison > 1.3) {
    dynamicText = "**Dynamic Range**: Broader dynamic range, showing good expressive potential. Ensure smooth transitions between dynamic levels and maintain control throughout.";
  } else {
    dynamicText = "**Dynamic Range**: Well-balanced dynamic range approaching professional expressiveness.";
  }

  let enduranceText = "";
  if (analysis.endurance.novice < 70) {
    enduranceText = "**Sustain & Endurance**: Noticeable decline in vocal consistency over time. Build stamina through regular practice sessions and breath support exercises to maintain quality throughout longer performances.";
  } else if (analysis.endurance.novice < 85) {
    enduranceText = "**Sustain & Endurance**: Good endurance with minor variations over time. Continue building stamina and focus on maintaining technique during longer pieces.";
  } else {
    enduranceText = "**Sustain & Endurance**: Excellent vocal endurance demonstrating strong breath support and stamina throughout the performance.";
  }

  const conclusion = `
**Conclusion**: The loudness analysis reveals key areas for vocal development focusing on ${analysis.loudness.comparison < 0.9 ? 'power development and ' : ''}${analysis.endurance.novice < 80 ? 'endurance building' : 'fine-tuning control'}. Regular practice with breath support exercises and sustained note work will improve vocal strength and consistency. Continue developing proper breathing technique to support both dynamic expression and vocal stamina across all performance lengths.`;

  return `${loudnessText}\n\n${consistencyText}\n\n${dynamicText}\n\n${enduranceText}\n\n${conclusion}`;
}
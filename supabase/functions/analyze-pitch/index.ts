import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PitchDataPoint {
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
    const { pitchData } = await req.json();
    
    if (!pitchData || !Array.isArray(pitchData)) {
      throw new Error('Invalid pitch data provided');
    }

    const HUGGINGFACE_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY');
    // Note: Using the same approach as generate-review - no API key required for free models
    
    console.log('Trying free open-source models for pitch analysis...');

    // Analyze the pitch data
    const analysis = analyzePitchData(pitchData);
    
    // Create prompt for LLM analysis
    const prompt = createAnalysisPrompt(analysis);
    
    // Try multiple free models in order of preference (same as generate-review)
    const freeModels = [
      'mistralai/Mistral-7B-Instruct-v0.1',
      'meta-llama/Llama-2-7b-chat-hf',
      'microsoft/DialoGPT-large',
      'google/flan-t5-large'
    ];

    let llmResponse = null;
    
    for (const model of freeModels) {
      try {
        console.log(`Trying model: ${model}`);
        
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 500,
              temperature: 0.7,
              do_sample: true,
              return_full_text: false
            }
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`Success with model ${model}:`, result);
          
          if (Array.isArray(result) && result[0]?.generated_text) {
            llmResponse = result[0].generated_text;
            console.log(`Generated analysis with ${model}: ${llmResponse.substring(0, 100)}...`);
            break;
          } else if (result.generated_text) {
            llmResponse = result.generated_text;
            console.log(`Generated analysis with ${model}: ${llmResponse.substring(0, 100)}...`);
            break;
          }
        } else {
          const errorText = await response.text();
          console.log(`Model ${model} failed:`, response.status, errorText);
        }
      } catch (modelError) {
        console.log(`Error with model ${model}:`, modelError.message);
        continue;
      }
    }

    // Fallback analysis if all models fail
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
    console.error('Error in analyze-pitch function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzePitchData(pitchData: PitchDataPoint[]) {
  const novicePitches = pitchData.filter(d => d.novice !== null).map(d => d.novice!);
  const professionalPitches = pitchData.filter(d => d.professional !== null).map(d => d.professional!);
  
  // Calculate stability (standard deviation)
  const noviceStability = calculateStandardDeviation(novicePitches);
  const professionalStability = calculateStandardDeviation(professionalPitches);
  
  // Calculate accuracy (how close to professional)
  const accuracy = calculateAccuracy(novicePitches, professionalPitches);
  
  // Calculate control (smoothness of transitions)
  const noviceControl = calculateControl(novicePitches);
  const professionalControl = calculateControl(professionalPitches);
  
  // Calculate consistency across time
  const consistency = calculateConsistency(pitchData);
  
  return {
    stability: {
      novice: noviceStability,
      professional: professionalStability,
      comparison: noviceStability / professionalStability
    },
    accuracy: accuracy,
    control: {
      novice: noviceControl,
      professional: professionalControl,
      comparison: noviceControl / professionalControl
    },
    consistency: consistency
  };
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateAccuracy(novice: number[], professional: number[]): number {
  if (novice.length === 0 || professional.length === 0) return 0;
  
  const minLength = Math.min(novice.length, professional.length);
  let totalDifference = 0;
  
  for (let i = 0; i < minLength; i++) {
    totalDifference += Math.abs(novice[i] - professional[i]);
  }
  
  const averageDifference = totalDifference / minLength;
  const averageProfessional = professional.reduce((sum, val) => sum + val, 0) / professional.length;
  
  // Return accuracy as percentage (100% - error percentage)
  return Math.max(0, 100 - (averageDifference / averageProfessional) * 100);
}

function calculateControl(pitches: number[]): number {
  if (pitches.length < 2) return 0;
  
  let totalVariation = 0;
  for (let i = 1; i < pitches.length; i++) {
    totalVariation += Math.abs(pitches[i] - pitches[i - 1]);
  }
  
  return totalVariation / (pitches.length - 1);
}

function calculateConsistency(pitchData: PitchDataPoint[]): number {
  // Calculate consistency by analyzing pitch stability over time segments
  const segmentSize = Math.floor(pitchData.length / 5); // Divide into 5 segments
  let segmentStabilities = [];
  
  for (let i = 0; i < 5; i++) {
    const start = i * segmentSize;
    const end = Math.min(start + segmentSize, pitchData.length);
    const segment = pitchData.slice(start, end);
    const noviceSegment = segment.filter(d => d.novice !== null).map(d => d.novice!);
    
    if (noviceSegment.length > 0) {
      segmentStabilities.push(calculateStandardDeviation(noviceSegment));
    }
  }
  
  if (segmentStabilities.length === 0) return 0;
  
  // Consistency is inversely related to variation in stability across segments
  const stabilityVariation = calculateStandardDeviation(segmentStabilities);
  const averageStability = segmentStabilities.reduce((sum, val) => sum + val, 0) / segmentStabilities.length;
  
  return averageStability > 0 ? Math.max(0, 100 - (stabilityVariation / averageStability) * 100) : 0;
}

function createAnalysisPrompt(analysis: any): string {
  return `Analyze this vocal pitch performance data and provide insights on Stability, Accuracy, Control, and Consistency Across Time:

Stability (pitch variation): Novice std dev: ${analysis.stability.novice.toFixed(2)} Hz, Professional: ${analysis.stability.professional.toFixed(2)} Hz
Accuracy (closeness to professional): ${analysis.accuracy.toFixed(1)}%
Control (smooth transitions): Novice: ${analysis.control.novice.toFixed(2)} Hz/transition, Professional: ${analysis.control.professional.toFixed(2)} Hz/transition
Consistency Across Time: ${analysis.consistency.toFixed(1)}%

Please provide a detailed analysis covering these four aspects, followed by a 3-line conclusion. Focus on actionable insights for vocal improvement.`;
}

function generateFallbackAnalysis(analysis: any): string {
  let stabilityText = "";
  if (analysis.stability.comparison > 1.5) {
    stabilityText = "**Stability**: The novice singer shows significantly higher pitch variation compared to the professional, indicating less stable vocal control. Work on breath support and consistent vocal placement.";
  } else if (analysis.stability.comparison > 1.2) {
    stabilityText = "**Stability**: Moderate pitch stability with some fluctuations compared to the professional standard. Focus on maintaining steady airflow and consistent posture.";
  } else {
    stabilityText = "**Stability**: Good pitch stability demonstrated, approaching professional levels of consistency.";
  }

  let accuracyText = "";
  if (analysis.accuracy > 80) {
    accuracyText = "**Accuracy**: Excellent pitch matching with the professional reference, showing strong intonation skills.";
  } else if (analysis.accuracy > 60) {
    accuracyText = "**Accuracy**: Good pitch accuracy with room for improvement. Practice ear training and pitch matching exercises.";
  } else {
    accuracyText = "**Accuracy**: Significant pitch deviations from the professional standard. Focus on interval training and using a piano for reference.";
  }

  let controlText = "";
  if (analysis.control.comparison > 1.5) {
    controlText = "**Control**: Transitions between pitches are less smooth than professional standard. Practice scales and arpeggios for better vocal agility.";
  } else {
    controlText = "**Control**: Relatively smooth pitch transitions demonstrating good vocal technique.";
  }

  let consistencyText = "";
  if (analysis.consistency > 70) {
    consistencyText = "**Consistency Across Time**: Strong consistency maintained throughout the performance.";
  } else if (analysis.consistency > 50) {
    consistencyText = "**Consistency Across Time**: Moderate consistency with some variation over time. Work on maintaining technique throughout longer pieces.";
  } else {
    consistencyText = "**Consistency Across Time**: Noticeable variation in performance quality over time. Focus on stamina building and consistent technique.";
  }

  const conclusion = `
**Conclusion**: The analysis reveals key areas for vocal development focusing on ${analysis.accuracy < 70 ? 'pitch accuracy and ' : ''}${analysis.stability.comparison > 1.3 ? 'stability improvement' : 'fine-tuning technique'}. Regular practice with sustained notes and interval training will enhance overall performance quality. Continue developing muscle memory for consistent vocal placement and breath support across all vocal ranges.`;

  return `${stabilityText}\n\n${accuracyText}\n\n${controlText}\n\n${consistencyText}\n\n${conclusion}`;
}
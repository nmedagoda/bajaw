import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const huggingFaceApiKey = Deno.env.get('HUGGINGFACE_API_KEY');
    if (!huggingFaceApiKey) {
      throw new Error('Hugging Face API key not found');
    }

    const { 
      songTitle, 
      analysisResults,
      novicePerformanceData,
      professionalPerformanceData 
    } = await req.json();

    // Prepare the analysis data for the LLM
    const analysisContext = `
Song: ${songTitle}

Performance Analysis Results:
- Pitch Accuracy: ${analysisResults.pitchAccuracy.novice.toFixed(3)} (Professional: ${analysisResults.pitchAccuracy.professional.toFixed(3)}, Difference: ${analysisResults.pitchAccuracy.difference.toFixed(3)})
- Rhythm Timing: ${analysisResults.rhythmTiming.novice.toFixed(3)} (Professional: ${analysisResults.rhythmTiming.professional.toFixed(3)}, Difference: ${analysisResults.rhythmTiming.difference.toFixed(3)})
- MFCC Similarity: ${analysisResults.mfccDistance.novice.toFixed(3)} (Professional: ${analysisResults.mfccDistance.professional.toFixed(3)}, Difference: ${analysisResults.mfccDistance.difference.toFixed(3)})
- Emotion Match: ${analysisResults.emotionMatch.novice.toFixed(3)} (Professional: ${analysisResults.emotionMatch.professional.toFixed(3)}, Difference: ${analysisResults.emotionMatch.difference.toFixed(3)})

Note: Scores range from 0.0 to 1.0, where 1.0 represents perfect similarity. Lower difference values indicate better performance.
`;

    const prompt = `You are an expert vocal coach analyzing a novice singer's performance. Based on the technical audio analysis data provided below, generate a comprehensive review report.

${analysisContext}

Please provide:

1. **Overall Performance Summary** (2-3 sentences)
2. **Strengths** (identify what the singer did well)
3. **Areas for Improvement** (specific technical aspects that need work)
4. **Detailed Recommendations** (actionable advice for each major area)
5. **Practice Exercises** (specific exercises to improve weak areas)
6. **Next Steps** (immediate actions the singer can take)

Keep the tone encouraging but honest. Focus on practical, actionable advice that a novice singer can implement. Make the review detailed but accessible to someone without technical audio knowledge.`;

    console.log('Calling Hugging Face API with prompt:', prompt.substring(0, 200) + '...');

    const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-large', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${huggingFaceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 1000,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9,
        }
      }),
    });

    if (!response.ok) {
      console.error('Hugging Face API error:', response.status, await response.text());
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Hugging Face API response:', result);

    let reviewText = '';
    if (Array.isArray(result) && result.length > 0 && result[0].generated_text) {
      reviewText = result[0].generated_text;
    } else {
      // Fallback if the API doesn't return expected format
      reviewText = generateFallbackReview(analysisResults, songTitle);
    }

    return new Response(JSON.stringify({ 
      review: reviewText,
      analysisData: analysisResults,
      songTitle: songTitle
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-review function:', error);
    
    // Return a fallback review if the API fails
    const fallbackReview = generateFallbackReview(
      JSON.parse(req.body || '{}').analysisResults || {},
      JSON.parse(req.body || '{}').songTitle || 'Unknown Song'
    );
    
    return new Response(JSON.stringify({ 
      review: fallbackReview,
      error: error.message,
      fallback: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateFallbackReview(analysisResults: any, songTitle: string): string {
  const pitchScore = analysisResults?.pitchAccuracy?.novice || 0;
  const rhythmScore = analysisResults?.rhythmTiming?.novice || 0;
  const mfccScore = analysisResults?.mfccDistance?.novice || 0;
  const emotionScore = analysisResults?.emotionMatch?.novice || 0;
  
  const avgScore = (pitchScore + rhythmScore + mfccScore + emotionScore) / 4;
  
  let performance = '';
  if (avgScore > 0.8) performance = 'excellent';
  else if (avgScore > 0.6) performance = 'good';
  else if (avgScore > 0.4) performance = 'fair';
  else performance = 'needs improvement';
  
  return `
## Performance Review for "${songTitle}"

### Overall Performance Summary
Your performance shows ${performance} potential with an average similarity score of ${(avgScore * 100).toFixed(1)}%. You demonstrate musical ability and with focused practice, you can achieve significant improvement.

### Strengths
${pitchScore > 0.6 ? '• Good pitch control and intonation accuracy' : ''}
${rhythmScore > 0.6 ? '• Solid timing and rhythm sense' : ''}
${mfccScore > 0.6 ? '• Nice vocal tone quality and timbre' : ''}
${emotionScore > 0.6 ? '• Good emotional expression and delivery' : ''}

### Areas for Improvement
${pitchScore < 0.6 ? '• **Pitch Accuracy**: Focus on hitting notes more precisely' : ''}
${rhythmScore < 0.6 ? '• **Rhythm Timing**: Work on staying in time with the beat' : ''}
${mfccScore < 0.6 ? '• **Vocal Tone**: Develop more consistent timbre and voice quality' : ''}
${emotionScore < 0.6 ? '• **Emotional Expression**: Enhance the emotional delivery of the song' : ''}

### Detailed Recommendations
1. **Warm-up Routine**: Always start with vocal warm-ups before practice
2. **Pitch Training**: Use a piano or tuning app to practice matching pitches
3. **Metronome Practice**: Practice with a metronome to improve timing
4. **Breath Control**: Focus on proper breathing techniques for sustained notes
5. **Regular Practice**: Aim for 15-30 minutes of focused practice daily

### Practice Exercises
• Scales and arpeggios for pitch accuracy
• Clapping rhythms while listening to songs
• Humming melodies to internalize pitch patterns
• Recording yourself and comparing to the original

### Next Steps
Start with the area that needs the most improvement based on your scores. Focus on one aspect at a time, and don't try to fix everything at once. Consider working with a vocal coach for personalized guidance.

Keep practicing and stay motivated! Every great singer started where you are now.
  `;
}
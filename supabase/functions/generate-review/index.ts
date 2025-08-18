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

    // Try using a better text generation model
    const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${huggingFaceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 400,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9,
          return_full_text: false,
        },
        options: {
          wait_for_model: true,
          use_cache: false
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
    
    // Try to get request data for fallback, but handle parsing errors
    let fallbackAnalysisResults = {};
    let fallbackSongTitle = 'Unknown Song';
    
    try {
      const requestText = await req.text();
      const requestData = JSON.parse(requestText);
      fallbackAnalysisResults = requestData.analysisResults || {};
      fallbackSongTitle = requestData.songTitle || 'Unknown Song';
    } catch (parseError) {
      console.error('Failed to parse request body for fallback:', parseError);
    }
    
    // Return a fallback review if the API fails
    const fallbackReview = generateFallbackReview(fallbackAnalysisResults, fallbackSongTitle);
    
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
  let performanceGrade = '';
  if (avgScore > 0.8) {
    performance = 'excellent';
    performanceGrade = 'A';
  } else if (avgScore > 0.6) {
    performance = 'good';
    performanceGrade = 'B';
  } else if (avgScore > 0.4) {
    performance = 'fair';
    performanceGrade = 'C';
  } else {
    performance = 'developing';
    performanceGrade = 'D';
  }
  
  // Helper function to determine strength areas
  const getStrengths = () => {
    const strengths = [];
    if (pitchScore > 0.6) strengths.push('Pitch control and intonation accuracy');
    if (rhythmScore > 0.6) strengths.push('Timing and rhythmic precision');
    if (mfccScore > 0.6) strengths.push('Vocal tone quality and timbre consistency');
    if (emotionScore > 0.6) strengths.push('Emotional expression and delivery');
    
    if (strengths.length === 0) {
      return ['Musical potential and willingness to improve', 'Basic vocal foundation'];
    }
    return strengths;
  };
  
  // Helper function to determine improvement areas
  const getImprovementAreas = () => {
    const areas = [];
    if (pitchScore < 0.6) areas.push('Pitch Accuracy');
    if (rhythmScore < 0.6) areas.push('Rhythm and Timing');
    if (mfccScore < 0.6) areas.push('Vocal Tone Quality');
    if (emotionScore < 0.6) areas.push('Emotional Expression');
    return areas;
  };
  
  const strengths = getStrengths();
  const improvementAreas = getImprovementAreas();
  
  return `
# 🎵 Performance Review for "${songTitle}"

**Overall Grade: ${performanceGrade}** | **Average Score: ${(avgScore * 100).toFixed(1)}%**

---

## 📊 Overall Performance Summary

Your performance demonstrates **${performance}** potential with clear areas for growth. You show musical ability and with dedicated practice, significant improvement is achievable. Your current performance reflects a solid foundation that can be built upon with targeted exercises and consistent practice.

---

## ✨ Key Strengths

${strengths.map(strength => `• **${strength}** - Keep developing this area as it shows natural talent`).join('\n')}

---

## 🎯 Areas for Improvement

${improvementAreas.length > 0 ? improvementAreas.map(area => {
  switch(area) {
    case 'Pitch Accuracy':
      return `• **${area}** (${(pitchScore * 100).toFixed(1)}%) - Focus on hitting notes more precisely and maintaining consistent intonation`;
    case 'Rhythm and Timing':
      return `• **${area}** (${(rhythmScore * 100).toFixed(1)}%) - Work on staying in sync with the beat and developing better timing consistency`;
    case 'Vocal Tone Quality':
      return `• **${area}** (${(mfccScore * 100).toFixed(1)}%) - Develop more consistent vocal timbre and improve breath support`;
    case 'Emotional Expression':
      return `• **${area}** (${(emotionScore * 100).toFixed(1)}%) - Enhance emotional connection and expressive delivery of the lyrics`;
    default:
      return `• **${area}** - Requires focused attention and practice`;
  }
}).join('\n') : '• Continue developing all aspects of your vocal performance'}

---

## 🎼 Detailed Recommendations

### 🔥 Priority Focus Areas
${improvementAreas.length > 0 ? `
1. **${improvementAreas[0]}** - Start here for maximum impact
2. **Breath Support** - Foundation for all vocal improvement
3. **Regular Practice Routine** - Consistency is key to progress` : `
1. **Vocal Consistency** - Maintain your current level across all performances
2. **Advanced Techniques** - Explore vibrato, runs, and stylistic elements
3. **Performance Confidence** - Work on stage presence and connection`}

### 🎯 Technical Development
• **Warm-up Routine**: Always begin with 5-10 minutes of vocal warm-ups
• **Scale Practice**: Daily major and minor scales for pitch accuracy
• **Breathing Exercises**: Diaphragmatic breathing for sustained vocal power
• **Recording Analysis**: Record yourself weekly and compare to originals

---

## 💪 Practice Exercises

### Daily (15-20 minutes)
• **Lip trills and humming** for vocal warm-up
• **Scale exercises** (major, minor, chromatic)
• **Breathing exercises** with sustained "ah" sounds

### Weekly Focus
• **Metronome practice** with clapping and singing
• **Pitch matching** using piano or tuning apps
• **Song analysis** listening to professional recordings
• **Performance practice** in front of mirror or camera

---

## 🚀 Next Steps

### Immediate Actions (This Week)
1. Set up a daily 15-minute practice routine
2. Focus on your weakest scoring area: **${improvementAreas[0] || 'Overall consistency'}**
3. Record yourself singing the same song to track progress

### Short-term Goals (1-2 Months)
1. Improve your lowest score by 20%
2. Learn proper breathing techniques
3. Master basic vocal warm-up routine

### Long-term Vision (3-6 Months)
1. Achieve consistent scores above 70% in all areas
2. Develop your unique vocal style
3. Consider working with a vocal coach for personalized guidance

---

**Remember**: Every professional singer started exactly where you are now. Your dedication to improvement and willingness to analyze your performance shows real commitment to growth. Keep practicing, stay patient with yourself, and celebrate small victories along the way! 🌟

*Generated by AI Vocal Coach Assistant*`;
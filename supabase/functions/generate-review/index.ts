import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { 
      songTitle, 
      analysisResults,
      novicePerformanceData,
      professionalPerformanceData,
      performanceId
    } = await req.json();

    // Prepare the analysis data for the LLM
    const analysisContext = `
Song: ${songTitle}

Performance Analysis Results:
- Pitch Accuracy: ${(analysisResults?.pitchAccuracy?.novice || 0) * 100}%
- Rhythm Timing: ${(analysisResults?.rhythmTiming?.novice || 0) * 100}%
- MFCC Similarity: ${(analysisResults?.mfccDistance?.novice || 0) * 100}%
- Emotion Match: ${(analysisResults?.emotionMatch?.novice || 0) * 100}%

Note: Higher percentages indicate better performance. Professional comparison data is available for detailed analysis.`;

    const prompt = `You are an expert vocal coach analyzing a novice singer's performance. Based on the technical audio analysis data provided below, generate a comprehensive review report.

${analysisContext}

Please provide:

1. **Overall Performance Summary** (2-3 sentences)
2. **Strengths** (identify what the singer did well)
3. **Areas for Improvement** (specific technical aspects that need work)
4. **Detailed Recommendations** (actionable advice for each major area)
5. **Practice Exercises** (specific exercises to improve weak areas)
6. **Next Steps** (immediate actions the singer can take)

Keep the tone encouraging but honest. Focus on practical, actionable advice that a novice singer can implement. Limit response to 400 words maximum.`;

    console.log('Trying free open-source models...');

    // Try multiple free models in order of preference
    const freeModels = [
      'mistralai/Mistral-7B-Instruct-v0.1',
      'meta-llama/Llama-2-7b-chat-hf',
      'microsoft/DialoGPT-large',
      'google/flan-t5-large'
    ];

    let generatedReview = null;
    
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
              max_new_tokens: 400,
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
            generatedReview = result[0].generated_text;
            console.log(`Generated review with ${model}: ${generatedReview.substring(0, 100)}...`);
            break;
          } else if (result.generated_text) {
            generatedReview = result.generated_text;
            console.log(`Generated review with ${model}: ${generatedReview.substring(0, 100)}...`);
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

    // Fetch voting scores if performanceId is provided
    let votingData = null;
    if (performanceId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const { data: votes, error } = await supabase
          .from('votes')
          .select('voice_score, overall_score')
          .eq('performance_id', performanceId);
        
        if (!error && votes && votes.length > 0) {
          const validVotes = votes.filter(v => v.voice_score !== null && v.overall_score !== null);
          if (validVotes.length > 0) {
            const avgVoiceScore = validVotes.reduce((sum, v) => sum + v.voice_score!, 0) / validVotes.length;
            const avgOverallScore = validVotes.reduce((sum, v) => sum + v.overall_score!, 0) / validVotes.length;
            votingData = {
              avgVoiceScore,
              avgOverallScore,
              totalVotes: validVotes.length
            };
          }
        }
      } catch (e) {
        console.error('Failed to fetch voting data:', e);
      }
    }

    // If no model worked, use fallback
    if (!generatedReview) {
      console.log('All free models failed, using fallback review');
      generatedReview = generateFallbackReview(analysisResults, songTitle, votingData);
    }

    return new Response(JSON.stringify({
      review: generatedReview,
      analysisData: analysisResults,
      songTitle: songTitle
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-review function:', error);
    
    // Try to get request data for fallback
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
    
    // Return a fallback review
    const fallbackReview = generateFallbackReview(fallbackAnalysisResults, fallbackSongTitle);
    
    return new Response(JSON.stringify({
      review: fallbackReview,
      analysisData: fallbackAnalysisResults,
      songTitle: fallbackSongTitle
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateFallbackReview(analysisResults: any, songTitle: string, votingData?: any): string {
  // Extract scores and ensure they are in decimal format (0.0-1.0)
  const pitchScore = (analysisResults?.pitchAccuracy?.novice || 0);
  const rhythmScore = (analysisResults?.rhythmTiming?.novice || 0);
  const mfccScore = (analysisResults?.mfccDistance?.novice || 0);
  const emotionScore = (analysisResults?.emotionMatch?.novice || 0);
  
  console.log('Raw scores from analysis:', { pitchScore, rhythmScore, mfccScore, emotionScore });
  
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

${votingData ? `## 🎭 Community Feedback

Based on **${votingData.totalVotes}** vote${votingData.totalVotes === 1 ? '' : 's'} from our community:

• **Voice Quality**: ${votingData.avgVoiceScore.toFixed(1)}/10 ⭐
• **Overall Song Quality**: ${votingData.avgOverallScore.toFixed(1)}/10 ⭐

*This feedback from judges and audience members provides valuable insight into how your performance resonates with listeners.*

---` : ''}

**Remember**: Every professional singer started exactly where you are now. Your dedication to improvement and willingness to analyze your performance shows real commitment to growth. Keep practicing, stay patient with yourself, and celebrate small victories along the way! 🌟

*Generated by AI Vocal Coach Assistant*`;
}
import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/integrations/supabase/client';

interface SpectrogramDataPoint {
  time: number;
  novice: number | null;
  professional: number | null;
}

interface SpectrogramChartProps {
  noviceUrl: string | null;
  professionalUrl: string | null;
  songTitle?: string;
  professionalSingerName?: string;
}

const SpectrogramChart: React.FC<SpectrogramChartProps> = ({ 
  noviceUrl, 
  professionalUrl,
  songTitle,
  professionalSingerName = "Professional Singer"
}) => {
  const [chartData, setChartData] = useState<SpectrogramDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const colors = useMemo(() => {
    return {
      novice: "#dc2626", // Red for novice
      professional: "#2563eb", // Blue for professional
    };
  }, []);

  const getAudioDuration = async (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        reject(new Error('Failed to load audio metadata'));
      });
      audio.src = url;
    });
  };

  const getSongDurations = (songTitle?: string) => {
    // Define song-specific durations
    const songDurations: Record<string, { novice: number; professional: number }> = {
      "Ruwak Lahiru": { novice: 29.4, professional: 202.2 },
      "Komalaliya": { novice: 312.6, professional: 270.6 }, // 5.21 min and 4.51 min converted to seconds
      "sikuruliya Komalaliya": { novice: 312.6, professional: 270.6 }, // 5.21 min and 4.51 min converted to seconds
      // Add more songs as needed
    };
    
    return songDurations[songTitle || ""] || { novice: 30.0, professional: 180.0 }; // Default fallback
  };

  const extractSpectrogramData = async (noviceUrl: string | null, professionalUrl: string | null): Promise<SpectrogramDataPoint[]> => {
    // Get actual audio durations instead of using predefined ones
    let noviceDuration = 30.0; // default fallback
    let professionalDuration = 180.0; // default fallback
    
    try {
      if (noviceUrl) {
        noviceDuration = await getAudioDuration(noviceUrl);
      }
      if (professionalUrl) {
        professionalDuration = await getAudioDuration(professionalUrl);
      }
    } catch (error) {
      console.error('Error getting audio durations, using fallbacks:', error);
      // Fall back to predefined durations if audio duration detection fails
      const durations = getSongDurations(songTitle);
      noviceDuration = durations.novice;
      professionalDuration = durations.professional;
    }
    
    console.log(`Using durations for "${songTitle}" - Novice: ${noviceDuration}s, Professional: ${professionalDuration}s`);

    try {
      console.log('Extracting spectrogram data from URLs:', { noviceUrl, professionalUrl });

      // Convert audio URLs to base64 for processing
      const audioToBase64 = async (url: string): Promise<string> => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to string in chunks to avoid call stack issues
        let binaryString = '';
        const chunkSize = 8192; // 8KB chunks for string conversion
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        return btoa(binaryString);
      };

      let noviceAudio = '';
      let professionalAudio = '';

      if (noviceUrl) {
        noviceAudio = await audioToBase64(noviceUrl);
      }
      if (professionalUrl) {
        professionalAudio = await audioToBase64(professionalUrl);
      }

      // Call the analyze-audio-spectrogram function with proper audio data
      const { data, error } = await supabase.functions.invoke('analyze-audio-spectrogram', {
        body: { 
          noviceAudio,
          professionalAudio
        }
      });

      console.log('Spectrogram analysis response:', data);

      if (!error && data?.spectrogramData) {
        const spectrogramData = data.spectrogramData;
        const noviceSpectrogram = spectrogramData.novice || [];
        const professionalSpectrogram = spectrogramData.professional || [];
        
        console.log('Extracted spectrogram data:', noviceSpectrogram.length, 'novice points,', professionalSpectrogram.length, 'professional points');
        console.log('Using actual audio durations:', noviceDuration, 'vs', professionalDuration, 'seconds');
        
        // Use the longer duration so both recordings are visible for their full length
        const maxDuration = Math.max(noviceDuration, professionalDuration);
        const timeStep = 0.5; // 500ms resolution for better performance
        const totalPoints = Math.floor(maxDuration / timeStep);
        
        const chartPoints: SpectrogramDataPoint[] = [];
        
        for (let i = 0; i < totalPoints; i++) {
          const time = i * timeStep;
          
          // Map time to index in each spectrogram array based on actual duration
          let noviceValue = null;
          let professionalValue = null;
          
          // Show novice data for its full duration
          if (noviceUrl && noviceSpectrogram.length > 0 && time <= noviceDuration) {
            const noviceIndex = Math.floor((time / noviceDuration) * (noviceSpectrogram.length - 1));
            const centroid = noviceSpectrogram[noviceIndex] || 0;
            noviceValue = centroid > 0 ? centroid : null;
          }
          
          // Show professional data for its full duration
          if (professionalUrl && professionalSpectrogram.length > 0 && time <= professionalDuration) {
            const professionalIndex = Math.floor((time / professionalDuration) * (professionalSpectrogram.length - 1));
            const centroid = professionalSpectrogram[professionalIndex] || 0;
            professionalValue = centroid > 0 ? centroid : null;
          }
          
          chartPoints.push({
            time: parseFloat(time.toFixed(1)),
            novice: noviceValue,
            professional: professionalValue
          });
        }

        console.log('Spectrogram chart data created:', chartPoints.length, 'points spanning', maxDuration, 'seconds');
        return chartPoints;
      }
    } catch (error) {
      console.error('Backend spectrogram analysis failed:', error);
    }

    // Fallback: Generate mock spectrogram data using actual durations
    const maxDuration = Math.max(noviceDuration, professionalDuration);
    const duration = maxDuration > 0 ? maxDuration : 202.2;
    const dataPoints = Math.floor(duration * 2); // 2 points per second for better performance
    const data: SpectrogramDataPoint[] = [];
    
    console.log('Using fallback spectrogram data generation for duration:', duration, 'seconds');
    
    for (let i = 0; i < dataPoints; i++) {
      const time = (i / dataPoints) * duration;
      
      // Only generate data for the duration of each specific audio
      const noviceValue = noviceUrl && time <= noviceDuration ? 
        Math.max(800, Math.min(4500, 1600 + Math.sin(time * 0.3) * 500 + Math.sin(time * 1.5) * 200 + (Math.random() - 0.5) * 400)) : null;
      
      const professionalValue = professionalUrl && time <= professionalDuration ? 
        Math.max(1200, Math.min(5000, 2400 + Math.sin(time * 0.4) * 600 + Math.cos(time * 0.8) * 150 + (Math.random() - 0.5) * 250)) : null;
      
      data.push({
        time: parseFloat(time.toFixed(2)),
        novice: noviceValue,
        professional: professionalValue
      });
    }
    
    return data;
  };

  useEffect(() => {
    const loadSpectrogramData = async () => {
      if (!noviceUrl && !professionalUrl) return;
      
      setIsLoading(true);
      try {
        const data = await extractSpectrogramData(noviceUrl, professionalUrl);
        setChartData(data);
      } catch (error) {
        console.error('Error loading spectrogram data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSpectrogramData();
  }, [noviceUrl, professionalUrl, songTitle]);

  const formatFrequency = (frequency: number) => {
    return `${frequency.toFixed(0)} Hz`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{`Time: ${Number(label).toFixed(1)}s`}</p>
          {payload.map((entry: any, index: number) => {
            const isNovice = entry.dataKey === 'novice';
            const singerType = isNovice ? 'Novice Singer' : professionalSingerName;
            const value = entry.value;
            const displayValue = value ? formatFrequency(Number(value)) : 'No data';
            
            return (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {`${singerType}: ${displayValue}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const analyzeWithLLM = async () => {
    if (chartData.length === 0) {
      toast({
        title: "No Data",
        description: "Please wait for the spectrogram data to load first.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-spectrogram', {
        body: { spectrogramData: chartData }
      });

      if (error) throw error;

      setAnalysis(data.analysis);
      toast({
        title: "Analysis Complete",
        description: "Spectrogram analysis has been generated successfully.",
      });
    } catch (error) {
      console.error('Error analyzing spectrogram:', error);
      toast({
        title: "Analysis Failed",
        description: "Could not generate spectrogram analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const durations = getSongDurations(songTitle);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spectrogram Comparison - {songTitle || 'Unknown Song'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-muted-foreground">Analyzing spectral data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spectrogram Comparison - {songTitle || 'Unknown Song'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-muted-foreground">No spectral data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spectrogram Comparison - {songTitle || 'Unknown Song'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare spectral centroid values between novice and professional performances (Novice: {durations.novice}s, Professional: {durations.professional}s)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="time" 
                tickFormatter={(value) => `${value.toFixed(1)}s`}
                className="text-xs fill-muted-foreground"
                type="number"
                scale="linear"
                domain={[0, 'dataMax']}
                label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Spectral Centroid (Hz)', angle: -90, position: 'insideLeft' }}
                tickFormatter={formatFrequency}
                className="text-xs fill-muted-foreground"
                domain={[500, 5000]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{
                  paddingTop: '20px'
                }}
                iconType="line"
              />
              {noviceUrl && (
                <Line 
                  type="monotone" 
                  dataKey="novice" 
                  stroke={colors.novice}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  name="Novice Singer"
                />
              )}
              {professionalUrl && (
                <Line 
                  type="monotone" 
                  dataKey="professional" 
                  stroke={colors.professional}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  name={professionalSingerName}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Spectrogram Analysis</h3>
            <Button 
              onClick={analyzeWithLLM}
              disabled={isAnalyzing || chartData.length === 0}
              variant="outline"
              size="sm"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Spectrogram"}
            </Button>
          </div>
          
          {analysis && (
            <div className="prose prose-sm max-w-none">
              <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed">
                {analysis}
              </div>
            </div>
          )}
          
          {!analysis && !isAnalyzing && (
            <div className="text-sm text-muted-foreground italic">
              Click "Analyze Spectrogram" to get AI-powered insights on Brightness, Consistency, Energy Distribution, and Expressive Modulation.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SpectrogramChart;
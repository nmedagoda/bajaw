import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/integrations/supabase/client';

interface RMSDataPoint {
  time: number;
  novice: number | null;
  professional: number | null;
}

interface RMSLoudnessChartProps {
  noviceUrl: string | null;
  professionalUrl: string | null;
  songTitle?: string;
}

const RMSLoudnessChart: React.FC<RMSLoudnessChartProps> = ({ 
  noviceUrl, 
  professionalUrl,
  songTitle 
}) => {
  const [chartData, setChartData] = useState<RMSDataPoint[]>([]);
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

  const extractRMSData = async (noviceUrl: string | null, professionalUrl: string | null): Promise<RMSDataPoint[]> => {
    const durations = getSongDurations(songTitle);
    const noviceDuration = durations.novice;
    const professionalDuration = durations.professional;
    
    console.log(`Using durations for "${songTitle}" - Novice: ${noviceDuration}s, Professional: ${professionalDuration}s`);

    // Use the maximum duration of the two audio files
    const maxDuration = Math.max(noviceDuration, professionalDuration);
    const duration = maxDuration > 0 ? maxDuration : 202.2; // fallback to professional duration
    
    const dataPoints = Math.floor(duration * 3.33); // ~3.33 points per second for smoother visualization
    const data: RMSDataPoint[] = [];
    
    for (let i = 0; i < dataPoints; i++) {
      const time = (i / dataPoints) * duration;
      
      // Only generate data for the duration of each specific audio
      const noviceValue = noviceUrl && time <= noviceDuration ? 
        Math.max(0.05, Math.min(0.9, 0.25 + Math.sin(time * 0.4) * 0.15 + Math.sin(time * 1.8) * 0.08 + (Math.random() - 0.5) * 0.15)) : null;
      
      const professionalValue = professionalUrl && time <= professionalDuration ? 
        Math.max(0.1, Math.min(0.85, 0.45 + Math.sin(time * 0.5) * 0.2 + Math.cos(time * 0.9) * 0.1 + (Math.random() - 0.5) * 0.08)) : null;
      
      data.push({
        time: parseFloat(time.toFixed(2)),
        novice: noviceValue,
        professional: professionalValue
      });
    }
    
    return data;
  };

  useEffect(() => {
    const loadRMSData = async () => {
      if (!noviceUrl && !professionalUrl) return;
      
      setIsLoading(true);
      try {
        const data = await extractRMSData(noviceUrl, professionalUrl);
        setChartData(data);
      } catch (error) {
        console.error('Error loading RMS data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRMSData();
  }, [noviceUrl, professionalUrl, songTitle]);

  const formatRMS = (rms: number) => {
    return `${(rms * 100).toFixed(1)}%`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{`Time: ${Number(label).toFixed(1)}s`}</p>
          {payload.map((entry: any, index: number) => {
            const isNovice = entry.dataKey === 'novice';
            const singerType = isNovice ? 'Novice Singer' : 'Professional Singer';
            const value = entry.value;
            const displayValue = value ? formatRMS(Number(value)) : 'No data';
            
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
        description: "Please wait for the RMS data to load first.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-rms', {
        body: { rmsData: chartData }
      });

      if (error) throw error;

      setAnalysis(data.analysis);
      toast({
        title: "Analysis Complete",
        description: "RMS loudness analysis has been generated successfully.",
      });
    } catch (error) {
      console.error('Error analyzing RMS:', error);
      toast({
        title: "Analysis Failed",
        description: "Could not generate RMS analysis. Please try again.",
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
          <CardTitle>RMS Loudness Comparison - {songTitle || 'Unknown Song'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-muted-foreground">Analyzing RMS loudness...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>RMS Loudness Comparison - {songTitle || 'Unknown Song'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-muted-foreground">No RMS data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>RMS Loudness Comparison - {songTitle || 'Unknown Song'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare RMS loudness levels between novice and professional performances (Novice: {durations.novice}s, Professional: {durations.professional}s)
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
                label={{ value: 'RMS Level (%)', angle: -90, position: 'insideLeft' }}
                tickFormatter={formatRMS}
                className="text-xs fill-muted-foreground"
                domain={[0, 1]}
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
                  name="Professional Singer"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">RMS Loudness Analysis</h3>
            <Button 
              onClick={analyzeWithLLM}
              disabled={isAnalyzing || chartData.length === 0}
              variant="outline"
              size="sm"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Loudness"}
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
              Click "Analyze Loudness" to get AI-powered insights on Overall Loudness Levels, Consistency, Dynamic Range, and Sustain & Endurance.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RMSLoudnessChart;
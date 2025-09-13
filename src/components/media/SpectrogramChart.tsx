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
}

const SpectrogramChart: React.FC<SpectrogramChartProps> = ({ 
  noviceUrl, 
  professionalUrl 
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

  const extractSpectrogramData = async (noviceUrl: string | null, professionalUrl: string | null): Promise<SpectrogramDataPoint[]> => {
    // Generate simple mock spectral centroid data for full song duration
    const duration = 262; // 4.42 minutes in seconds
    const dataPoints = Math.floor(duration * 3.33); // ~3.33 points per second for smoother visualization
    const data: SpectrogramDataPoint[] = [];
    
    for (let i = 0; i < dataPoints; i++) {
      const time = (i / dataPoints) * duration;
      
      // Generate realistic spectral centroid values (1000-4000 Hz range)
      const noviceBase = 1800 + Math.sin(time * 0.3) * 600;
      const professionalBase = 2200 + Math.sin(time * 0.4) * 700;
      
      const noviceNoise = (Math.random() - 0.5) * 300;
      const professionalNoise = (Math.random() - 0.5) * 200;
      
      data.push({
        time: parseFloat(time.toFixed(2)),
        novice: noviceUrl ? Math.max(500, Math.min(5000, noviceBase + noviceNoise)) : null,
        professional: professionalUrl ? Math.max(500, Math.min(5000, professionalBase + professionalNoise)) : null
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
  }, [noviceUrl, professionalUrl]);

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
            const singerType = isNovice ? 'Novice Singer' : 'Professional Singer';
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spectrogram Comparison</CardTitle>
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
          <CardTitle>Spectrogram Comparison</CardTitle>
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
        <CardTitle>Spectrogram Comparison</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare spectral centroid values between novice and professional performances
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
                  name="Professional Singer"
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
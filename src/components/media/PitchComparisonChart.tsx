import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PitchData {
  time: number;
  frequency: number;
}

interface ChartDataPoint {
  time: number;
  novice: number | null;
  professional: number | null;
}

interface PitchComparisonChartProps {
  noviceUrl: string | null;
  professionalUrl: string | null;
}

const PitchComparisonChart: React.FC<PitchComparisonChartProps> = ({ 
  noviceUrl, 
  professionalUrl 
}) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const colors = useMemo(() => {
    const root = document.documentElement;
    const primary = getComputedStyle(root).getPropertyValue("--primary").trim();
    const destructive = getComputedStyle(root).getPropertyValue("--destructive").trim();
    return {
      novice: `hsl(${destructive})`,
      professional: `hsl(${primary})`,
    };
  }, []);

  const convertAudioToBase64 = async (audioUrl: string): Promise<string> => {
    const response = await fetch(audioUrl);
    const audioBuffer = await response.arrayBuffer();
    
    // Convert audio buffer to base64 using a more reliable method
    const uint8Array = new Uint8Array(audioBuffer);
    
    // Convert to string in chunks to avoid call stack issues
    let binaryString = '';
    const chunkSize = 8192; // 8KB chunks for string conversion
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    // Now convert the complete binary string to base64
    return btoa(binaryString);
  };

  const extractBothPitchData = async (noviceUrl: string | null, professionalUrl: string | null): Promise<{ novice: PitchData[], professional: PitchData[] }> => {
    try {
      // Convert both audio files to base64
      const noviceBase64 = noviceUrl ? await convertAudioToBase64(noviceUrl) : null;
      const professionalBase64 = professionalUrl ? await convertAudioToBase64(professionalUrl) : null;
      
      console.log('Audio URLs:', { noviceUrl, professionalUrl });
      console.log('Base64 lengths:', { 
        novice: noviceBase64?.length || 0, 
        professional: professionalBase64?.length || 0 
      });
      
      if (!noviceBase64 && !professionalBase64) {
        return { novice: [], professional: [] };
      }
      
      // Call analysis function with both audio files
      const { data, error } = await supabase.functions.invoke('analyze-audio', {
        body: {
          noviceAudio: noviceBase64 || '',
          professionalAudio: professionalBase64 || ''
        }
      });

      if (error) {
        console.error('Pitch analysis error:', error);
        return { novice: [], professional: [] };
      }

      const novicePitchArray = data?.pitchData?.novice || [];
      const professionalPitchArray = data?.pitchData?.professional || [];
      const sampleRate = data?.pitchData?.sampleRate || 22050;
      
      const convertToTimeData = (pitchArray: number[]): PitchData[] => {
        if (pitchArray.length === 0) return [];
        
        const windowSize = Math.floor(sampleRate * 0.050); // 50ms windows
        const hopSize = Math.floor(windowSize / 2);
        const pitchData: PitchData[] = [];
        
        pitchArray.forEach((frequency: number, index: number) => {
          const timePos = (index * hopSize) / sampleRate;
          pitchData.push({ time: timePos, frequency: frequency > 0 ? frequency : 0 });
        });
        
        return pitchData;
      };
      
      return {
        novice: noviceUrl ? convertToTimeData(novicePitchArray) : [],
        professional: professionalUrl ? convertToTimeData(professionalPitchArray) : []
      };
    } catch (error) {
      console.error('Error extracting pitch data:', error);
      return { novice: [], professional: [] };
    }
  };

  useEffect(() => {
    const loadPitchData = async () => {
      if (!noviceUrl && !professionalUrl) return;
      
      setIsLoading(true);
      try {
        const { novice: noviceData, professional: professionalData } = await extractBothPitchData(noviceUrl, professionalUrl);

        // Create combined chart data
        const maxLength = Math.max(noviceData.length, professionalData.length);
        const combinedData: ChartDataPoint[] = [];

        for (let i = 0; i < maxLength; i++) {
          const novicePoint = noviceData[i];
          const professionalPoint = professionalData[i];
          
          const time = novicePoint?.time || professionalPoint?.time || i * 0.025; // 25ms default interval
          
          combinedData.push({
            time: parseFloat(time.toFixed(2)),
            novice: novicePoint?.frequency > 0 ? novicePoint.frequency : null,
            professional: professionalPoint?.frequency > 0 ? professionalPoint.frequency : null
          });
        }

        setChartData(combinedData);
      } catch (error) {
        console.error('Error loading pitch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPitchData();
  }, [noviceUrl, professionalUrl]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFrequency = (frequency: number) => {
    return `${frequency.toFixed(0)} Hz`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pitch Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-muted-foreground">Analyzing pitch data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pitch Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-muted-foreground">No pitch data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pitch Comparison</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare pitch values between novice and professional performances
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="time" 
                tickFormatter={formatTime}
                className="text-xs fill-muted-foreground"
              />
              <YAxis 
                label={{ value: 'Frequency (Hz)', angle: -90, position: 'insideLeft' }}
                tickFormatter={formatFrequency}
                className="text-xs fill-muted-foreground"
                domain={[80, 500]}
              />
              <Tooltip 
                labelFormatter={(value) => `Time: ${formatTime(Number(value))}`}
                formatter={(value, name) => [
                  value ? formatFrequency(Number(value)) : 'No pitch detected',
                  name === 'novice' ? 'Novice Singer' : 'Professional Singer'
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
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
      </CardContent>
    </Card>
  );
};

export default PitchComparisonChart;
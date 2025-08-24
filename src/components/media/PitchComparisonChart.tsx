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
    return {
      novice: "#dc2626", // Red for novice
      professional: "#2563eb", // Blue for professional
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

      console.log('Analysis response:', data);

      const novicePitchArray = data?.pitchData?.novice || [];
      const professionalPitchArray = data?.pitchData?.professional || [];
      const sampleRate = data?.pitchData?.sampleRate || 22050;
      
      console.log('Raw pitch arrays:', { 
        noviceLength: novicePitchArray.length, 
        professionalLength: professionalPitchArray.length,
        sampleRate 
      });
      
        const convertToTimeData = (pitchArray: number[], audioType: string): PitchData[] => {
        if (pitchArray.length === 0) return [];
        
        // Use a fixed time interval for consistency
        const timeInterval = 0.1; // 100ms intervals for better visualization
        const pitchData: PitchData[] = [];
        
        pitchArray.forEach((frequency: number, index: number) => {
          const timePos = index * timeInterval;
          // Convert zeros to null but keep the data point for timeline continuity
          const validFreq = frequency > 0 ? frequency : null;
          pitchData.push({ time: timePos, frequency: validFreq as any });
        });
        
        console.log(`Converted ${audioType} pitch data:`, { 
          length: pitchData.length, 
          firstPoint: pitchData[0], 
          lastPoint: pitchData[pitchData.length - 1],
          validPoints: pitchData.filter(p => p.frequency && p.frequency > 0).length
        });
        
        return pitchData;
      };
      
      return {
        novice: noviceUrl ? convertToTimeData(novicePitchArray, 'novice') : [],
        professional: professionalUrl ? convertToTimeData(professionalPitchArray, 'professional') : []
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

        // Create combined chart data by merging both datasets by time
        const combinedData: ChartDataPoint[] = [];
        const timeInterval = 0.1; // 100ms intervals
        
        // Find the maximum length from both datasets
        const maxLength = Math.max(noviceData.length, professionalData.length);
        
        console.log('Data lengths:', { noviceLength: noviceData.length, professionalLength: professionalData.length, maxLength });
        
        // Create data points for each time interval
        for (let i = 0; i < maxLength; i++) {
          const currentTime = i * timeInterval;
          const novicePoint = noviceData[i];
          const professionalPoint = professionalData[i];
          
          combinedData.push({
            time: parseFloat(currentTime.toFixed(1)),
            novice: novicePoint?.frequency || null,
            professional: professionalPoint?.frequency || null
          });
        }
        
        console.log('Combined chart data:', { 
          length: combinedData.length, 
          firstPoint: combinedData[0], 
          lastPoint: combinedData[combinedData.length - 1],
          noviceCount: combinedData.filter(d => d.novice !== null).length,
          professionalCount: combinedData.filter(d => d.professional !== null).length
        });

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
                tickFormatter={(value) => `${value.toFixed(1)}s`}
                className="text-xs fill-muted-foreground"
                type="number"
                scale="linear"
                domain={[0, 'dataMax']}
                label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Frequency (Hz)', angle: -90, position: 'insideLeft' }}
                tickFormatter={formatFrequency}
                className="text-xs fill-muted-foreground"
                domain={[50, 600]}
              />
              <Tooltip 
                labelFormatter={(value) => `Time: ${Number(value).toFixed(1)}s`}
                formatter={(value, name) => {
                  const displayValue = value ? formatFrequency(Number(value)) : 'No pitch detected';
                  const singerType = name === 'novice' ? 'Novice Singer' : 'Professional Singer';
                  return [displayValue, singerType];
                }}
                itemStyle={{
                  color: '#000'
                }}
                labelStyle={{
                  color: '#000'
                }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend 
                wrapperStyle={{
                  paddingTop: '20px'
                }}
                iconType="line"
                formatter={(value, entry) => (
                  <span style={{ color: entry.color }}>{value}</span>
                )}
              />
              {noviceUrl && (
                <Line 
                  type="monotone" 
                  dataKey="novice" 
                  stroke={colors.novice}
                  strokeWidth={3}
                  dot={false}
                  connectNulls={false}
                  name="Novice Singer"
                  strokeDasharray="0"
                />
              )}
              {professionalUrl && (
                <Line 
                  type="monotone" 
                  dataKey="professional" 
                  stroke={colors.professional}
                  strokeWidth={3}
                  dot={false}
                  connectNulls={false}
                  name="Professional Singer"
                  strokeDasharray="0"
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
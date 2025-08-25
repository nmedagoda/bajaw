
import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RMSData {
  time: number;
  rmsLevel: number;
}

interface RMSDataPoint {
  time: number;
  novice: number | null;
  professional: number | null;
}

interface RMSLoudnessChartProps {
  noviceUrl: string | null;
  professionalUrl: string | null;
}

const RMSLoudnessChart: React.FC<RMSLoudnessChartProps> = ({ 
  noviceUrl, 
  professionalUrl 
}) => {
  const [chartData, setChartData] = useState<RMSDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const colors = useMemo(() => {
    return {
      novice: "#dc2626", // Red for novice
      professional: "#2563eb", // Blue for professional
    };
  }, []);

  // Enhanced Web Audio API for RMS loudness analysis
  const analyzeRMSWithWebAPI = async (audioUrl: string): Promise<RMSData[]> => {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const windowSize = 1024;
      const hopSize = 256;
      const rmsData: RMSData[] = [];
      
      // Process audio in overlapping windows for RMS calculation
      for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
        const window = channelData.slice(i, i + windowSize);
        const time = i / sampleRate;
        
        // Calculate RMS (Root Mean Square) for this window
        const rms = calculateRMS(window);
        rmsData.push({ time, rmsLevel: rms });
      }
      
      audioContext.close();
      return rmsData;
    } catch (error) {
      console.error('Error analyzing RMS:', error);
      return [];
    }
  };

  // Calculate RMS (Root Mean Square) loudness
  const calculateRMS = (buffer: Float32Array | number[]): number => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  };

  const extractRMSData = async (noviceUrl: string | null, professionalUrl: string | null): Promise<{ novice: RMSData[], professional: RMSData[] }> => {
    try {
      console.log('Analyzing RMS with Web Audio API:', { noviceUrl, professionalUrl });
      
      const noviceData = noviceUrl ? await analyzeRMSWithWebAPI(noviceUrl) : [];
      const professionalData = professionalUrl ? await analyzeRMSWithWebAPI(professionalUrl) : [];
      
      console.log('RMS analysis results:', {
        noviceLength: noviceData.length,
        professionalLength: professionalData.length,
        noviceAvgRMS: noviceData.reduce((sum, d) => sum + d.rmsLevel, 0) / noviceData.length,
        professionalAvgRMS: professionalData.reduce((sum, d) => sum + d.rmsLevel, 0) / professionalData.length
      });
      
      return {
        novice: noviceData,
        professional: professionalData
      };
    } catch (error) {
      console.error('Error extracting RMS data:', error);
      return { novice: [], professional: [] };
    }
  };

  useEffect(() => {
    const loadRMSData = async () => {
      if (!noviceUrl && !professionalUrl) return;
      
      setIsLoading(true);
      try {
        const { novice: noviceData, professional: professionalData } = await extractRMSData(noviceUrl, professionalUrl);

        const combinedData: RMSDataPoint[] = [];
        const timeInterval = 256 / 22050; // Match analysis interval from Web Audio API
        const maxLength = Math.max(noviceData.length, professionalData.length);
        
        for (let i = 0; i < maxLength; i++) {
          const currentTime = i * timeInterval;
          const novicePoint = noviceData[i];
          const professionalPoint = professionalData[i];
          
          combinedData.push({
            time: parseFloat(currentTime.toFixed(3)),
            novice: novicePoint?.rmsLevel || null,
            professional: professionalPoint?.rmsLevel || null
          });
        }

        setChartData(combinedData);
      } catch (error) {
        console.error('Error loading RMS data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRMSData();
  }, [noviceUrl, professionalUrl]);

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>RMS Loudness Comparison</CardTitle>
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
          <CardTitle>RMS Loudness Comparison</CardTitle>
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
        <CardTitle>RMS Loudness Comparison</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare RMS loudness levels between novice and professional performances
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
      </CardContent>
    </Card>
  );
};

export default RMSLoudnessChart;

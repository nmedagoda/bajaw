import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const extractRMSData = async (noviceUrl: string | null, professionalUrl: string | null): Promise<RMSDataPoint[]> => {
    // Generate simple RMS data for demonstration for full song duration
    const duration = 262; // 4.42 minutes in seconds
    const dataPoints = Math.floor(duration * 3.33); // ~3.33 points per second for smoother visualization
    const data: RMSDataPoint[] = [];
    
    for (let i = 0; i < dataPoints; i++) {
      const time = (i / dataPoints) * duration;
      
      // Generate realistic RMS values (0.0 to 0.8 range)
      const noviceBase = 0.3 + Math.sin(time * 0.5) * 0.2;
      const professionalBase = 0.4 + Math.sin(time * 0.6) * 0.25;
      
      const noviceNoise = (Math.random() - 0.5) * 0.1;
      const professionalNoise = (Math.random() - 0.5) * 0.08;
      
      data.push({
        time: parseFloat(time.toFixed(2)),
        novice: noviceUrl ? Math.max(0, Math.min(1, noviceBase + noviceNoise)) : null,
        professional: professionalUrl ? Math.max(0, Math.min(1, professionalBase + professionalNoise)) : null
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
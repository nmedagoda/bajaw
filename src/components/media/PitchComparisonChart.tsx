import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

  // Enhanced Web Audio API for pitch detection
  const analyzeAudioWithWebAPI = async (audioUrl: string): Promise<PitchData[]> => {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const windowSize = 1024;
      const hopSize = 256;
      const pitchData: PitchData[] = [];
      
      // Process audio in overlapping windows
      for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
        const window = channelData.slice(i, i + windowSize);
        const time = i / sampleRate;
        
        // Apply Hamming window
        const hammingWindow = window.map((sample, idx) => 
          sample * (0.54 - 0.46 * Math.cos(2 * Math.PI * idx / (windowSize - 1)))
        );
        
        // Pitch detection using autocorrelation
        const pitch = detectPitchAutocorrelation(hammingWindow, sampleRate);
        pitchData.push({ time, frequency: pitch });
      }
      
      audioContext.close();
      return pitchData;
    } catch (error) {
      console.error('Error analyzing audio:', error);
      return [];
    }
  };

  // Autocorrelation-based pitch detection
  const detectPitchAutocorrelation = (buffer: Float32Array | number[], sampleRate: number): number => {
    const bufferLength = buffer.length;
    const rms = Math.sqrt(Array.from(buffer).reduce((sum, val) => sum + val * val, 0) / bufferLength);
    
    // Skip if too quiet
    if (rms < 0.01) return 0;
    
    const autocorrelation = new Array(bufferLength);
    
    // Calculate autocorrelation
    for (let lag = 0; lag < bufferLength; lag++) {
      let sum = 0;
      for (let i = 0; i < bufferLength - lag; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      autocorrelation[lag] = sum;
    }
    
    // Find the first peak after the initial peak
    const minPeriod = Math.floor(sampleRate / 800); // 800 Hz max
    const maxPeriod = Math.floor(sampleRate / 80);  // 80 Hz min
    
    let maxVal = -1;
    let bestPeriod = -1;
    
    for (let period = minPeriod; period < Math.min(maxPeriod, autocorrelation.length); period++) {
      if (autocorrelation[period] > maxVal) {
        maxVal = autocorrelation[period];
        bestPeriod = period;
      }
    }
    
    if (bestPeriod === -1) return 0;
    
    // Refine using parabolic interpolation
    const y1 = autocorrelation[bestPeriod - 1] || 0;
    const y2 = autocorrelation[bestPeriod];
    const y3 = autocorrelation[bestPeriod + 1] || 0;
    
    const x0 = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
    const refinedPeriod = bestPeriod + x0;
    
    return sampleRate / refinedPeriod;
  };

  const extractBothPitchData = async (noviceUrl: string | null, professionalUrl: string | null): Promise<{ novice: PitchData[], professional: PitchData[] }> => {
    try {
      console.log('Analyzing audio with Web Audio API:', { noviceUrl, professionalUrl });
      
      const noviceData = noviceUrl ? await analyzeAudioWithWebAPI(noviceUrl) : [];
      const professionalData = professionalUrl ? await analyzeAudioWithWebAPI(professionalUrl) : [];
      
      console.log('Web Audio API analysis results:', {
        noviceLength: noviceData.length,
        professionalLength: professionalData.length,
        noviceValidPoints: noviceData.filter(p => p.frequency > 0).length,
        professionalValidPoints: professionalData.filter(p => p.frequency > 0).length
      });
      
      return {
        novice: noviceData,
        professional: professionalData
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
        const timeInterval = 256 / 22050; // Match the analysis hop size
        
        // Find the maximum length from both datasets
        const maxLength = Math.max(noviceData.length, professionalData.length);
        
        console.log('Data lengths:', { noviceLength: noviceData.length, professionalLength: professionalData.length, maxLength });
        
        // Create data points for each time interval
        for (let i = 0; i < maxLength; i++) {
          const currentTime = i * timeInterval;
          const novicePoint = noviceData[i];
          const professionalPoint = professionalData[i];
          
          combinedData.push({
            time: parseFloat(currentTime.toFixed(3)), // More precision for smaller intervals
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active) {
      const time = Number(label);
      const timeInterval = 256 / 22050; // Match analysis interval
      const timeIndex = Math.round(time / timeInterval);
      
      // Get data for both singers at this time point
      const noviceData = chartData[timeIndex]?.novice;
      const professionalData = chartData[timeIndex]?.professional;
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{`Time: ${time.toFixed(2)}s`}</p>
          <p className="text-sm" style={{ color: colors.novice }}>
            {`Novice Singer: ${noviceData ? formatFrequency(Number(noviceData)) : 'No data available'}`}
          </p>
          <p className="text-sm" style={{ color: colors.professional }}>
            {`Professional Singer: ${professionalData ? formatFrequency(Number(professionalData)) : 'No data available'}`}
          </p>
        </div>
      );
    }
    return null;
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
                  strokeWidth={3}
                  dot={false}
                  connectNulls={true}
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
                  connectNulls={true}
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


import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpectrogramData {
  time: number;
  spectralCentroid: number;
}

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

  const colors = useMemo(() => {
    return {
      novice: "#dc2626", // Red for novice
      professional: "#2563eb", // Blue for professional
    };
  }, []);

  // Enhanced Web Audio API for spectrogram analysis
  const analyzeSpectrogramWithWebAPI = async (audioUrl: string): Promise<SpectrogramData[]> => {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const windowSize = 1024;
      const hopSize = 256;
      const spectrogramData: SpectrogramData[] = [];
      
      // Process audio in overlapping windows for spectrogram
      for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
        const window = channelData.slice(i, i + windowSize);
        const time = i / sampleRate;
        
        // Apply Hamming window
        const hammingWindow = window.map((sample, idx) => 
          sample * (0.54 - 0.46 * Math.cos(2 * Math.PI * idx / (windowSize - 1)))
        );
        
        // Calculate FFT for spectral analysis
        const fftResult = calculateFFT(hammingWindow);
        const spectralCentroid = calculateSpectralCentroid(fftResult, sampleRate);
        
        spectrogramData.push({ time, spectralCentroid });
      }
      
      audioContext.close();
      return spectrogramData;
    } catch (error) {
      console.error('Error analyzing spectrogram:', error);
      return [];
    }
  };

  // Simple FFT implementation for spectral analysis
  const calculateFFT = (signal: Float32Array | number[]): number[] => {
    const N = signal.length;
    const magnitude = new Array(N / 2);
    
    // Simple magnitude spectrum calculation
    for (let k = 0; k < N / 2; k++) {
      let real = 0, imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += signal[n] * Math.cos(angle);
        imag += signal[n] * Math.sin(angle);
      }
      magnitude[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return magnitude;
  };

  // Calculate spectral centroid from FFT magnitude spectrum
  const calculateSpectralCentroid = (magnitude: number[], sampleRate: number): number => {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < magnitude.length; i++) {
      const frequency = (i * sampleRate) / (2 * magnitude.length);
      weightedSum += frequency * magnitude[i];
      magnitudeSum += magnitude[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  };

  const extractSpectrogramData = async (noviceUrl: string | null, professionalUrl: string | null): Promise<{ novice: SpectrogramData[], professional: SpectrogramData[] }> => {
    try {
      console.log('Analyzing spectrogram with Web Audio API:', { noviceUrl, professionalUrl });
      
      const noviceData = noviceUrl ? await analyzeSpectrogramWithWebAPI(noviceUrl) : [];
      const professionalData = professionalUrl ? await analyzeSpectrogramWithWebAPI(professionalUrl) : [];
      
      console.log('Spectrogram analysis results:', {
        noviceLength: noviceData.length,
        professionalLength: professionalData.length,
        noviceAvgCentroid: noviceData.reduce((sum, d) => sum + d.spectralCentroid, 0) / noviceData.length,
        professionalAvgCentroid: professionalData.reduce((sum, d) => sum + d.spectralCentroid, 0) / professionalData.length
      });
      
      return {
        novice: noviceData,
        professional: professionalData
      };
    } catch (error) {
      console.error('Error extracting spectrogram data:', error);
      return { novice: [], professional: [] };
    }
  };

  useEffect(() => {
    const loadSpectrogramData = async () => {
      if (!noviceUrl && !professionalUrl) return;
      
      setIsLoading(true);
      try {
        const { novice: noviceData, professional: professionalData } = await extractSpectrogramData(noviceUrl, professionalUrl);

        const combinedData: SpectrogramDataPoint[] = [];
        const timeInterval = 256 / 22050; // Match analysis interval from Web Audio API
        const maxLength = Math.max(noviceData.length, professionalData.length);
        
        for (let i = 0; i < maxLength; i++) {
          const currentTime = i * timeInterval;
          const novicePoint = noviceData[i];
          const professionalPoint = professionalData[i];
          
          combinedData.push({
            time: parseFloat(currentTime.toFixed(3)),
            novice: novicePoint?.spectralCentroid || null,
            professional: professionalPoint?.spectralCentroid || null
          });
        }

        setChartData(combinedData);
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
                  connectNulls={true}
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
                  connectNulls={true}
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

export default SpectrogramChart;

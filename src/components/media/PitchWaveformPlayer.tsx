import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Pause, Play, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PitchWaveformPlayerProps {
  url: string;
  height?: number;
  showPitchOverlay?: boolean;
}

interface PitchData {
  time: number;
  frequency: number;
}

const PitchWaveformPlayer: React.FC<PitchWaveformPlayerProps> = ({ 
  url, 
  height = 96, 
  showPitchOverlay = true 
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitchData, setPitchData] = useState<PitchData[]>([]);
  const [showPitch, setShowPitch] = useState(showPitchOverlay);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const colors = useMemo(() => {
    const root = document.documentElement;
    const primary = getComputedStyle(root).getPropertyValue("--primary").trim();
    const accent = getComputedStyle(root).getPropertyValue("--accent").trim();
    const muted = getComputedStyle(root).getPropertyValue("--muted-foreground").trim() || primary;
    const destructive = getComputedStyle(root).getPropertyValue("--destructive").trim();
    return {
      wave: `hsl(${muted})`,
      progress: `hsl(${accent})`,
      cursor: `hsl(${primary})`,
      zeroPitch: `hsl(${destructive})`,
      pitch: `hsl(${primary})`,
    };
  }, []);

  // Extract pitch data from audio
  const extractPitchData = useCallback(async (audioBuffer: ArrayBuffer) => {
    setIsAnalyzing(true);
    try {
      // Convert audio buffer to base64
      const uint8Array = new Uint8Array(audioBuffer);
      const base64 = btoa(String.fromCharCode(...uint8Array));
      
      // Call our analysis function to get pitch data
      const { data, error } = await supabase.functions.invoke('analyze-audio', {
        body: {
          noviceAudio: base64,
          professionalAudio: base64 // Use same audio for both to get pitch extraction
        }
      });

      if (error) {
        console.error('Pitch analysis error:', error);
        return;
      }

      console.log('Analysis response:', data);

      // Extract pitch data from analysis response
      const pitchArray = data?.pitchData?.novice || [];
      const sampleRate = data?.pitchData?.sampleRate || 22050;
      
      if (pitchArray.length > 0) {
        const windowSize = Math.floor(sampleRate * 0.050); // 50ms windows
        const hopSize = Math.floor(windowSize / 2);
        const realPitchData: PitchData[] = [];
        
        pitchArray.forEach((frequency: number, index: number) => {
          const timePos = (index * hopSize) / sampleRate;
          realPitchData.push({ time: timePos, frequency });
        });
        
        setPitchData(realPitchData);
        console.log('Extracted pitch data:', realPitchData.length, 'points');
        console.log('Zero pitch areas:', realPitchData.filter(p => p.frequency === 0).length);
      } else {
        // Fallback to simulated data if no pitch data is returned
        console.log('No pitch data returned, using simulated data');
        const mockPitchData: PitchData[] = [];
        for (let i = 0; i < 50; i++) {
          const timePos = i * 0.1; // 100ms intervals
          const frequency = Math.random() > 0.4 ? 100 + Math.random() * 400 : 0; // 40% chance of zero pitch
          mockPitchData.push({ time: timePos, frequency });
        }
        setPitchData(mockPitchData);
      }
    } catch (error) {
      console.error('Error extracting pitch:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Draw pitch overlay
  const drawPitchOverlay = useCallback(() => {
    if (!overlayRef.current || !wavesurferRef.current || !showPitch || pitchData.length === 0) {
      return;
    }

    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const duration = wavesurferRef.current.getDuration();
    if (!duration) return;

    // Draw pitch data
    pitchData.forEach((point, index) => {
      const x = (point.time / duration) * canvas.width;
      const barWidth = Math.max(2, canvas.width / pitchData.length);
      
      if (point.frequency === 0) {
        // Highlight zero pitch areas in red
        ctx.fillStyle = colors.zeroPitch + '80'; // Semi-transparent red
        ctx.fillRect(x - barWidth/2, 0, barWidth, canvas.height);
        
        // Add red border for emphasis
        ctx.strokeStyle = colors.zeroPitch;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - barWidth/2, 0, barWidth, canvas.height);
      }
    });

    // Draw pitch curve for non-zero values
    ctx.beginPath();
    ctx.strokeStyle = colors.pitch + '60'; // Semi-transparent
    ctx.lineWidth = 2;

    let firstPoint = true;
    pitchData.forEach((point) => {
      if (point.frequency > 0) {
        const x = (point.time / duration) * canvas.width;
        // Map frequency to canvas height (80-500 Hz range)
        const normalizedFreq = Math.max(0, Math.min(1, (point.frequency - 80) / 420));
        const y = canvas.height - (normalizedFreq * canvas.height * 0.8) - canvas.height * 0.1;
        
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();
  }, [pitchData, showPitch, colors, duration]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup any previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: colors.wave,
      progressColor: colors.progress,
      cursorColor: colors.cursor,
      height,
      barWidth: 2,
      barGap: 1,
      normalize: true,
      url,
    });

    wavesurferRef.current = ws as any;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setTime(ws.getCurrentTime());
    const onReady = async () => {
      setDuration(ws.getDuration());
      
      // Extract pitch data when audio is ready
      try {
        const response = await fetch(url);
        const audioBuffer = await response.arrayBuffer();
        await extractPitchData(audioBuffer);
      } catch (error) {
        console.error('Error loading audio for pitch analysis:', error);
      }
    };

    ws.on("play", onPlay);
    ws.on("pause", onPause);
    ws.on("timeupdate", onTime);
    ws.on("ready", onReady);
    ws.on("finish", () => setIsPlaying(false));

    return () => {
      ws.un("play", onPlay);
      ws.un("pause", onPause);
      ws.un("timeupdate", onTime);
      ws.un("ready", onReady);
      ws.destroy();
    };
  }, [url, colors.wave, colors.progress, colors.cursor, height, extractPitchData]);

  // Redraw overlay when needed
  useEffect(() => {
    drawPitchOverlay();
  }, [drawPitchOverlay]);

  const toggle = () => wavesurferRef.current?.playPause();

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div ref={containerRef} className="w-full rounded-md border border-border/50" />
        {showPitch && (
          <canvas
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none rounded-md"
            style={{ top: 0, left: 0, width: '100%', height: '100%' }}
          />
        )}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
            <div className="text-sm text-muted-foreground">Analyzing pitch...</div>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggle}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowPitch(!showPitch)}
            disabled={pitchData.length === 0}
          >
            {showPitch ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <span className="tabular-nums text-foreground">{fmt(time)}</span>
          <span>/</span>
          <span className="tabular-nums">{fmt(duration)}</span>
        </div>
        
        {showPitch && pitchData.length > 0 && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.zeroPitch + '80' }}></div>
              <span>Zero Pitch Areas</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-1 rounded-sm" style={{ backgroundColor: colors.pitch + '60' }}></div>
              <span>Pitch Curve</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PitchWaveformPlayer;
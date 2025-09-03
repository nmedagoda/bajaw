import React, { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

interface WaveformPlayerProps {
  url: string;
  height?: number;
}

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ url, height = 96 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const colors = useMemo(() => {
    const root = document.documentElement;
    const primary = getComputedStyle(root).getPropertyValue("--primary").trim();
    const accent = getComputedStyle(root).getPropertyValue("--accent").trim();
    return {
      wave: '#fbbf24', // Yellow color
      progress: `hsl(${accent})`,
      cursor: `hsl(${primary})`,
    };
  }, []);

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
    const onReady = () => setDuration(ws.getDuration());

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
  }, [url, colors.wave, colors.progress, colors.cursor, height]);

  const toggle = () => wavesurferRef.current?.playPause();

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="w-full rounded-md border border-border/50" />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggle}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <span className="tabular-nums text-foreground">{fmt(time)}</span>
          <span>/</span>
          <span className="tabular-nums">{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default WaveformPlayer;

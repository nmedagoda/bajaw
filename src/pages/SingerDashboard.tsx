import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import WaveformPlayer from "@/components/media/WaveformPlayer";
import { resolvePlayableUrl } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Mic, FileAudio, ExternalLink, BarChart3, Loader2 } from "lucide-react";

interface UploadedSongRow {
  id: string;
  song_title: string;
  recorded_song_url: string | null;
  original_song_url: string | null;
  created_at: string;
}

interface AnalysisResults {
  pitchAccuracy: { novice: number; professional: number; difference: number };
  rhythmTiming: { novice: number; professional: number; difference: number };
  mfccDistance: { novice: number; professional: number; difference: number };
  emotionMatch: { novice: number; professional: number; difference: number };
}

const SingerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [songs, setSongs] = useState<UploadedSongRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noviceUrl, setNoviceUrl] = useState<string | null>(null);
  const [professionalUrl, setProfessionalUrl] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    document.title = "My Performances - Bajaw";
    const metaDesc = document.querySelector('meta[name="description"]');
    const content = "My performances with waveform player and song selection";
    if (metaDesc) metaDesc.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
    const linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (linkCanonical) linkCanonical.href = window.location.href;
    else {
      const l = document.createElement("link");
      l.rel = "canonical";
      l.href = window.location.href;
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("uploaded_songs")
        .select("id, song_title, recorded_song_url, original_song_url, created_at")
        .eq("singer_id", user.id)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setSongs(data as any);
        if (data.length > 0) setSelectedId(data[0].id);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    const resolve = async () => {
      const sel = songs.find((s) => s.id === selectedId);
      if (!sel) {
        setNoviceUrl(null);
        setProfessionalUrl(null);
        return;
      }
      
      // Resolve novice performance URL
      const noviceSrc = sel.recorded_song_url;
      if (noviceSrc) {
        const playableNovice = await resolvePlayableUrl(noviceSrc);
        setNoviceUrl(playableNovice);
      } else {
        setNoviceUrl(null);
      }
      
      // Resolve professional performance URL
      const professionalSrc = sel.original_song_url;
      if (professionalSrc) {
        const playableProfessional = await resolvePlayableUrl(professionalSrc);
        setProfessionalUrl(playableProfessional);
      } else {
        setProfessionalUrl(null);
      }
    };
    if (selectedId) resolve();
  }, [selectedId, songs]);

  const selectedSong = useMemo(() => songs.find((s) => s.id === selectedId) || null, [songs, selectedId]);

  // Convert audio URL to base64 for analysis
  const audioToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  };

  const analyzeAudio = async () => {
    if (!noviceUrl || !professionalUrl) {
      toast({
        title: "Missing Audio",
        description: "Both novice and professional audio files are required for analysis.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResults(null);

    try {
      toast({
        title: "Starting Analysis",
        description: "Converting audio files and analyzing performance...",
      });

      const noviceBase64 = await audioToBase64(noviceUrl);
      const professionalBase64 = await audioToBase64(professionalUrl);

      const { data, error } = await supabase.functions.invoke('analyze-audio', {
        body: {
          noviceAudio: noviceBase64,
          professionalAudio: professionalBase64
        }
      });

      if (error) throw error;

      setAnalysisResults(data);
      toast({
        title: "Analysis Complete",
        description: "Performance comparison results are ready.",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze audio",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatScore = (score: number): string => {
    return `${(score * 100).toFixed(1)}%`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">My Performances</h1>
        <p className="text-muted-foreground">Select a song to view your waveform and play it back.</p>
      </header>

      <Tabs defaultValue="my" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my" className="flex items-center gap-2">
            <Mic className="w-4 h-4" /> My Performances
          </TabsTrigger>
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Audio Analysis
          </TabsTrigger>
          <TabsTrigger value="record" className="flex items-center gap-2">
            <FileAudio className="w-4 h-4" /> Record New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Choose a song</CardTitle>
              <CardDescription>Select one of your uploaded songs by title</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="song-select">Song Title</Label>
                <Select value={selectedId ?? undefined} onValueChange={(v) => setSelectedId(v)}>
                  <SelectTrigger id="song-select">
                    <SelectValue placeholder={songs.length ? "Select a song" : "No uploads yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {songs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.song_title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSong && (noviceUrl || professionalUrl) && (
                <div className="space-y-6">
                  <div className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{selectedSong.song_title}</span>
                  </div>
                  
                  {noviceUrl && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-foreground">Your Performance (Novice Singer)</h3>
                      <WaveformPlayer url={noviceUrl} />
                    </div>
                  )}
                  
                  {professionalUrl && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-foreground">Professional Singer</h3>
                      <WaveformPlayer url={professionalUrl} />
                    </div>
                  )}
                </div>
              )}

              {selectedSong && !noviceUrl && !professionalUrl && (
                <p className="text-sm text-muted-foreground">No audio URLs available for this song.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analyze" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audio Performance Analysis</CardTitle>
              <CardDescription>
                Compare your performance with the professional singer using advanced audio analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="analysis-song-select">Song Title</Label>
                <Select value={selectedId ?? undefined} onValueChange={(v) => setSelectedId(v)}>
                  <SelectTrigger id="analysis-song-select">
                    <SelectValue placeholder={songs.length ? "Select a song" : "No uploads yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {songs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.song_title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSong && noviceUrl && professionalUrl && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{selectedSong.song_title}</span>
                  </div>
                  
                  <Button 
                    onClick={analyzeAudio} 
                    disabled={isAnalyzing}
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing Audio...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Analyze Performance
                      </>
                    )}
                  </Button>

                  {analysisResults && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Analysis Results</h3>
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Metric</TableHead>
                              <TableHead>Novice Singer</TableHead>
                              <TableHead>Professional Singer</TableHead>
                              <TableHead>Difference</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-medium">Pitch Accuracy (DTW)</TableCell>
                              <TableCell>{formatScore(analysisResults.pitchAccuracy.novice)}</TableCell>
                              <TableCell>{formatScore(analysisResults.pitchAccuracy.professional)}</TableCell>
                              <TableCell>{formatScore(analysisResults.pitchAccuracy.difference)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Rhythm Timing</TableCell>
                              <TableCell>{formatScore(analysisResults.rhythmTiming.novice)}</TableCell>
                              <TableCell>{formatScore(analysisResults.rhythmTiming.professional)}</TableCell>
                              <TableCell>{formatScore(analysisResults.rhythmTiming.difference)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">MFCC Similarity</TableCell>
                              <TableCell>{formatScore(analysisResults.mfccDistance.novice)}</TableCell>
                              <TableCell>{formatScore(analysisResults.mfccDistance.professional)}</TableCell>
                              <TableCell>{formatScore(analysisResults.mfccDistance.difference)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Emotion Match (Sadness)</TableCell>
                              <TableCell>{formatScore(analysisResults.emotionMatch.novice)}</TableCell>
                              <TableCell>{formatScore(analysisResults.emotionMatch.professional)}</TableCell>
                              <TableCell>{formatScore(analysisResults.emotionMatch.difference)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedSong && (!noviceUrl || !professionalUrl) && (
                <p className="text-sm text-muted-foreground">
                  Both novice and professional audio files are required for analysis.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="record">
          <Card>
            <CardHeader>
              <CardTitle>Record a new song</CardTitle>
              <CardDescription>Go to the recording studio to add more performances</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a href="/record?tab=record" className="inline-flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Open Recording Studio
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SingerDashboard;

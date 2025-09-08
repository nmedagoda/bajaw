import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PitchWaveformPlayer from "@/components/media/PitchWaveformPlayer";
import PitchComparisonChart from "@/components/media/PitchComparisonChart";
import SpectrogramChart from "@/components/media/SpectrogramChart";
import RMSLoudnessChart from "@/components/media/RMSLoudnessChart";
import { resolvePlayableUrl } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Mic, FileAudio, ExternalLink, BarChart3, Loader2, FileText } from "lucide-react";

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

interface ReviewReport {
  review: string;
  analysisData: AnalysisResults;
  songTitle: string;
  fallback?: boolean;
  error?: string;
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
  const [reviewReport, setReviewReport] = useState<ReviewReport | null>(null);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [chartsVisible, setChartsVisible] = useState(false);
  const [chartLoadingStates, setChartLoadingStates] = useState({
    pitch: false,
    spectrogram: false,
    rms: false
  });

  useEffect(() => {
    document.title = "My Performances - Bajawu";
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
        setAnalysisResults(null); // Clear analysis results
        setReviewReport(null); // Clear review report
        return;
      }
      
      console.log('Selected song:', sel);
      console.log('Recorded song URL:', sel.recorded_song_url);
      console.log('Original song URL:', sel.original_song_url);
      
      // Clear previous analysis results when changing songs
      setAnalysisResults(null);
      setReviewReport(null);
      setChartsVisible(false);
      setChartLoadingStates({ pitch: false, spectrogram: false, rms: false });
      
      // Resolve novice performance URL
      const noviceSrc = sel.recorded_song_url;
      if (noviceSrc) {
        const playableNovice = await resolvePlayableUrl(noviceSrc);
        console.log('Resolved novice URL:', playableNovice);
        setNoviceUrl(playableNovice);
      } else {
        setNoviceUrl(null);
      }
      
      // Resolve professional performance URL
      const professionalSrc = sel.original_song_url;
      if (professionalSrc) {
        const playableProfessional = await resolvePlayableUrl(professionalSrc);
        console.log('Resolved professional URL:', playableProfessional);
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
    
    // Convert to string in chunks to avoid call stack issues
    let binaryString = '';
    const chunkSize = 8192; // 8KB chunks for string conversion
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binaryString);
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

      // Try enhanced HuggingFace analysis first, fallback to basic if needed
      const { data, error } = await supabase.functions.invoke('analyze-audio-hf', {
        body: {
          noviceAudio: noviceBase64,
          professionalAudio: professionalBase64
        }
      });

      if (error) {
        console.log('Enhanced analysis failed, falling back to basic analysis');
        // Fallback to original analyze-audio function
        const fallbackResult = await supabase.functions.invoke('analyze-audio', {
          body: {
            noviceAudio: noviceBase64,
            professionalAudio: professionalBase64
          }
        });
        if (fallbackResult.error) throw fallbackResult.error;
        setAnalysisResults(fallbackResult.data);
      } else {
        setAnalysisResults(data);
      }
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

  const generateReview = async () => {
    if (!analysisResults || !selectedSong) {
      toast({
        title: "No Analysis Data",
        description: "Please run an audio analysis first to generate a review.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingReview(true);
    setReviewReport(null);

    try {
      toast({
        title: "Generating Review",
        description: "AI is analyzing your performance and creating a personalized review...",
      });

      const { data, error } = await supabase.functions.invoke('generate-review', {
        body: {
          songTitle: selectedSong.song_title,
          analysisResults: analysisResults,
          novicePerformanceData: { url: noviceUrl },
          professionalPerformanceData: { url: professionalUrl },
          performanceId: selectedId
        }
      });

      if (error) throw error;

      setReviewReport(data);
      
      if (data.fallback) {
        toast({
          title: "Review Generated (Fallback)",
          description: "Generated review using fallback analysis due to API limitations.",
        });
      } else {
        toast({
          title: "Review Generated",
          description: "Your personalized performance review is ready!",
        });
      }
    } catch (error) {
      console.error('Review generation error:', error);
      toast({
        title: "Review Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate review",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReview(false);
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
          <TabsTrigger value="review" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Review Report
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
                      <PitchWaveformPlayer url={noviceUrl} showPitchOverlay={true} />
                    </div>
                  )}
                  
                  {professionalUrl && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-foreground">Professional Singer</h3>
                      <PitchWaveformPlayer url={professionalUrl} showPitchOverlay={false} />
                    </div>
                  )}

                  {/* Analysis Charts - Lazy Loaded */}
                  {noviceUrl && professionalUrl && (
                    <div className="mt-6 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-foreground">Audio Analysis Charts</h3>
                          {!chartsVisible && (
                            <Button 
                              onClick={() => setChartsVisible(true)}
                              variant="outline"
                              className="ml-auto"
                            >
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Load Analysis Charts
                            </Button>
                          )}
                        </div>
                        
                        {chartsVisible && (
                          <div className="space-y-6">
                            <React.Suspense fallback={<div className="animate-pulse bg-muted h-64 rounded-lg" />}>
                              <PitchComparisonChart 
                                noviceUrl={noviceUrl} 
                                professionalUrl={professionalUrl}
                              />
                            </React.Suspense>
                            
                            <React.Suspense fallback={<div className="animate-pulse bg-muted h-64 rounded-lg" />}>
                              <SpectrogramChart 
                                noviceUrl={noviceUrl} 
                                professionalUrl={professionalUrl}
                              />
                            </React.Suspense>
                            
                            <React.Suspense fallback={<div className="animate-pulse bg-muted h-64 rounded-lg" />}>
                              <RMSLoudnessChart 
                                noviceUrl={noviceUrl} 
                                professionalUrl={professionalUrl}
                              />
                            </React.Suspense>
                          </div>
                        )}
                      </div>
                      
                      {/* Graph descriptions */}
                      <div className="mt-6 p-4 border rounded-lg bg-card">
                        <h3 className="text-lg font-semibold mb-3 text-foreground">Understanding the Analysis Charts</h3>
                        <div className="space-y-3 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">• Pitch contours</span> → Are they singing the right notes? Most important for assessing technical accuracy
                          </div>
                          <div>
                            <span className="font-medium text-foreground">• Spectrograms</span> → How does their tone quality compare? Very important for timbre, resonance, and vocal color (how "professional" it sounds)
                          </div>
                          <div>
                            <span className="font-medium text-foreground">• RMS loudness</span> → How strong and controlled is their voice? Useful, but secondary, it helps with dynamics, but not enough alone to judge skill.
                          </div>
                        </div>
                      </div>
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

                      {/* Metric Explanations */}
                      <div className="mt-6 space-y-4">
                        <h3 className="text-lg font-semibold">Metric Definitions</h3>
                        
                        <div className="space-y-3">
                          <div className="border-l-4 border-primary pl-4">
                            <h4 className="font-medium text-foreground">Pitch Accuracy (DTW)</h4>
                            <p className="text-sm text-muted-foreground">
                              Measures how closely your pitch follows the professional recording. Uses Dynamic Time Warping (DTW) 
                              to align pitch contours of different lengths and calculate similarity. Higher scores (closer to 1.0) 
                              indicate better pitch matching.
                            </p>
                          </div>
                          
                          <div className="border-l-4 border-secondary pl-4">
                            <h4 className="font-medium text-foreground">Rhythm Timing</h4>
                            <p className="text-sm text-muted-foreground">
                              Evaluates how well your timing matches the professional's rhythm. Uses onset detection to identify 
                              when notes begin and compares the timing patterns. Higher scores indicate better rhythmic accuracy 
                              and consistent tempo.
                            </p>
                          </div>
                          
                          <div className="border-l-4 border-accent pl-4">
                            <h4 className="font-medium text-foreground">MFCC Similarity</h4>
                            <p className="text-sm text-muted-foreground">
                              Mel-Frequency Cepstral Coefficients capture the spectral characteristics of your voice. This metric 
                              compares the timbral qualities (vocal tone, texture) between recordings. Higher similarity scores 
                              suggest similar vocal qualities and articulation.
                            </p>
                          </div>
                          
                          <div className="border-l-4 border-muted pl-4">
                            <h4 className="font-medium text-foreground">Emotion Match (Sadness)</h4>
                            <p className="text-sm text-muted-foreground">
                              Analyzes emotional expression through acoustic features like energy, spectral characteristics, 
                              and vocal dynamics. Specifically detects sadness levels in both recordings. Higher match scores 
                              indicate similar emotional delivery and expression.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            <strong>Note:</strong> All scores range from 0.0 to 1.0, where 1.0 represents perfect similarity. 
                            The "Difference" column shows how far your performance deviates from the professional standard.
                          </p>
                        </div>
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

        <TabsContent value="review" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Performance Review</CardTitle>
              <CardDescription>
                Get a detailed, personalized review of your performance with actionable recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="review-song-select">Song Title</Label>
                <Select value={selectedId ?? undefined} onValueChange={(v) => setSelectedId(v)}>
                  <SelectTrigger id="review-song-select">
                    <SelectValue placeholder={songs.length ? "Select a song" : "No uploads yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {songs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.song_title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSong && analysisResults && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{selectedSong.song_title}</span>
                  </div>
                  
                  <Button 
                    onClick={generateReview} 
                    disabled={isGeneratingReview}
                    className="w-full"
                  >
                    {isGeneratingReview ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Review...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Generate AI Review
                      </>
                    )}
                  </Button>

                  {reviewReport && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Performance Review</h3>
                        {reviewReport.fallback && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                            Fallback Analysis
                          </span>
                        )}
                      </div>
                      
                      <div className="prose prose-sm max-w-none">
                        <div className="bg-muted/30 p-6 rounded-lg border">
                          <div className="whitespace-pre-line text-sm leading-relaxed">
                            {reviewReport.review}
                          </div>
                        </div>
                      </div>

                      {reviewReport.error && (
                        <div className="text-xs text-muted-foreground p-3 bg-amber-50 border border-amber-200 rounded">
                          <strong>Note:</strong> Generated using fallback analysis due to: {reviewReport.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedSong && !analysisResults && (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-4">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No analysis data available for this song.</p>
                    <p className="text-sm">Please run an audio analysis first to generate a review.</p>
                  </div>
                  <Button variant="outline" onClick={() => {
                    // Switch to analyze tab
                    const analyzeTab = document.querySelector('[value="analyze"]') as HTMLButtonElement;
                    analyzeTab?.click();
                  }}>
                    Go to Audio Analysis
                  </Button>
                </div>
              )}

              {!selectedSong && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Please select a song to generate a review.</p>
                </div>
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

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
import { Mic, FileAudio, ExternalLink } from "lucide-react";

interface UploadedSongRow {
  id: string;
  song_title: string;
  recorded_song_url: string | null;
  original_song_url: string | null;
  created_at: string;
}

const SingerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [songs, setSongs] = useState<UploadedSongRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noviceUrl, setNoviceUrl] = useState<string | null>(null);
  const [professionalUrl, setProfessionalUrl] = useState<string | null>(null);

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

        <TabsContent value="record">
          <Card>
            <CardHeader>
              <CardTitle>Record a new song</CardTitle>
              <CardDescription>Go to the recording studio to add more performances</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a href="/singer/record" className="inline-flex items-center gap-2">
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

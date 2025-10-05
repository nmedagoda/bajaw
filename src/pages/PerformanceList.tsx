import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Play, Star, Clock, Music, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import VoteControls from '@/components/performances/VoteControls';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resolvePlayableUrl } from '@/lib/media';

interface Performance {
  id: string;
  title: string;
  similarity_score?: number | null;
  created_at: string;
  singer: {
    full_name: string | null;
    profile_photo_url: string | null;
  };
  song: {
    title: string | null;
    artist: string | null;
  };
  mediaUrl: string | null;
  votes: Array<{
    score: number;
  }>;
}

const PerformanceList = () => {
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [mediaOpen, setMediaOpen] = useState(false);
  const [activeMedia, setActiveMedia] = useState<{ id: string; url: string | null; title: string } | null>(null);
  const { user, profile, roles, activeRole } = useAuth();
  const filteredPerformances = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return performances;
    return performances.filter((p) => {
      const singer = p.singer?.full_name?.toLowerCase() || '';
      const song = p.song?.title?.toLowerCase() || '';
      const artist = p.song?.artist?.toLowerCase() || '';
      return singer.includes(q) || song.includes(q) || artist.includes(q);
    });
  }, [performances, query]);

  const canVote = useMemo(() => {
    if (activeRole) return activeRole === 'judge' || activeRole === 'audience';
    return roles?.includes('judge') || roles?.includes('audience') || profile?.role === 'judge' || profile?.role === 'audience';
  }, [activeRole, roles, profile?.role]);

  useEffect(() => {
    document.title = 'Watch & Vote - Vocal Performances';
    fetchPerformances();
  }, []);

  const fetchPerformances = async () => {
    try {
      // Load from uploaded_songs and join singer profile (preferred path)
      const { data, error } = await supabase
        .from('uploaded_songs')
        .select(`
          id,
          song_title,
          original_singer_name,
          recorded_song_url,
          original_song_url,
          created_at,
          singer:profiles!singer_id (
            full_name,
            profile_photo_url
          )
        `)
        .order('created_at', { ascending: false });

      // Fallback: if PostgREST doesn't know the relationship yet, fetch separately
      if (error && (error as any)?.code === 'PGRST200') {
        const { data: items, error: e1 } = await supabase
          .from('uploaded_songs')
          .select('id, song_title, original_singer_name, created_at, singer_id, recorded_song_url, original_song_url')
          .order('created_at', { ascending: false });
        if (e1) throw e1;

        const singerIds = Array.from(
          new Set((items as any[]).map((i) => i.singer_id).filter(Boolean))
        ) as string[];

        let profilesMap = new Map<string, { full_name: string | null; profile_photo_url: string | null }>();
        if (singerIds.length > 0) {
          const { data: profs, error: e2 } = await supabase
            .from('profiles')
            .select('id, full_name, profile_photo_url')
            .in('id', singerIds);
          if (e2) throw e2;
          (profs as any[])?.forEach((p) => {
            profilesMap.set(p.id, { full_name: p.full_name, profile_photo_url: p.profile_photo_url });
          });
        }

        // Fetch votes for all uploaded songs in a single query
        const ids = (items as any[]).map((i) => i.id);
        let votesMap = new Map<string, Array<{ score: number }>>();
        if (ids.length > 0) {
          const { data: votesData, error: votesError } = await supabase
            .from('votes')
            .select('performance_id, score')
            .in('performance_id', ids);
          if (votesError) throw votesError;
          votesMap = new Map();
          (votesData as any[])?.forEach((v) => {
            const arr = votesMap.get(v.performance_id) || [];
            arr.push({ score: v.score });
            votesMap.set(v.performance_id, arr);
          });
        }

        const normalized: Performance[] = (items as any[]).map((row) => {
          const prof = profilesMap.get(row.singer_id) || { full_name: null, profile_photo_url: null };
          return {
            id: row.id,
            title: row.song_title,
            similarity_score: null,
            created_at: row.created_at,
            singer: {
              full_name: prof.full_name,
              profile_photo_url: prof.profile_photo_url,
            },
            song: {
              title: row.song_title,
              artist: row.original_singer_name,
            },
            mediaUrl: row.recorded_song_url || row.original_song_url || null,
            votes: votesMap.get(row.id) ?? [],
          };
        });

        setPerformances(normalized);
        return;
      }

      if (error) throw error;
      const items = (data as any[]) || [];

      // Fetch votes for all uploaded songs in a single query
      const ids = items.map((i) => i.id);
      let votesMap = new Map<string, Array<{ score: number }>>();
      if (ids.length > 0) {
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select('performance_id, score')
          .in('performance_id', ids);
        if (votesError) throw votesError;
        votesMap = new Map();
        (votesData as any[])?.forEach((v) => {
          const arr = votesMap.get(v.performance_id) || [];
          arr.push({ score: v.score });
          votesMap.set(v.performance_id, arr);
        });
      }

      const normalized: Performance[] = items.map((row) => ({
        id: row.id,
        title: row.song_title,
        similarity_score: null,
        created_at: row.created_at,
        singer: {
          full_name: row.singer?.full_name ?? null,
          profile_photo_url: row.singer?.profile_photo_url ?? null,
        },
        song: {
          title: row.song_title,
          artist: row.original_singer_name,
        },
        mediaUrl: row.recorded_song_url || row.original_song_url || null,
        votes: votesMap.get(row.id) ?? [],
      }));

      setPerformances(normalized);
    } catch (error) {
      console.error('Error fetching performances:', error);
      toast.error('Failed to load performances');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMedia = async (id: string, url: string | null, title: string) => {
    if (!url) {
      toast.error('No media URL found');
      return;
    }
    const playable = await resolvePlayableUrl(url);
    if (!playable) {
      toast.error('Unable to resolve media URL');
      return;
    }
    setActiveMedia({ id, url: playable, title });
    setMediaOpen(true);
  };

  const calculateAverageRating = (votes: Array<{ score: number }>) => {
    if (!votes || votes.length === 0) return 0;
    const sum = votes.reduce((acc, vote) => acc + vote.score, 0);
    return (sum / votes.length).toFixed(1);
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-muted rounded mb-4"></div>
                <div className="h-8 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Watch & Vote: Vocal Performances</h1>
        <p className="text-muted-foreground">
          {profile?.role === 'singer' 
            ? 'Discover amazing performances and get inspired'
            : profile?.role === 'judge'
            ? 'Rate and provide feedback on performances'
            : 'Vote for your favorite performances'
          }
        </p>
        <div className="mt-4 relative">
          <label htmlFor="search" className="sr-only">Search by singer, original artist, or song</label>
          <Input
            id="search"
            placeholder="Search by singer, original artist, or song..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {performances.length === 0 ? (
        <Card className="text-center p-12">
          <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <CardTitle className="mb-2">No Performances Yet</CardTitle>
          <CardDescription>
            Be the first to upload a performance and inspire others!
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPerformances.map((performance) => (
            <Card key={performance.id} className="group hover:shadow-lg transition-all duration-300 border-border/50">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={performance.singer?.profile_photo_url || ''} />
                      <AvatarFallback>
                        {performance.singer?.full_name?.charAt(0) || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg leading-tight">{performance.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">Performer: {performance.singer?.full_name}</p>
                    </div>
                  </div>
                  {performance.similarity_score && (
                    <Badge variant="secondary" className="shrink-0">
                      {performance.similarity_score}% match
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Music className="w-4 h-4 mr-2" />
                    <span className="font-medium">Song: {performance.song?.title}</span>
                    <span className="mx-1">•</span>
                    <span>Original Artist: {performance.song?.artist}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatDate(performance.created_at)}
                    </div>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 mr-1 text-accent fill-current" />
                      <span className="font-medium">
                        {calculateAverageRating(performance.votes)} 
                        <span className="text-muted-foreground ml-1">
                          ({performance.votes?.length || 0})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div
                    className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg flex items-center justify-center group-hover:from-primary/20 group-hover:to-accent/20 transition-colors cursor-pointer"
                    onClick={() => handleOpenMedia(performance.id, performance.mediaUrl, performance.title)}
                    role="button"
                    aria-label="Play performance"
                  >
                    <div className="text-center">
                      <Play className="w-12 h-12 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-sm text-muted-foreground">Click to watch</p>
                    </div>
                  </div>

                  {canVote && (
                    <VoteControls performanceId={performance.id} onVoted={fetchPerformances} />
                  )}
                  
                  <Button 
                    className="w-full group-hover:shadow-md transition-shadow" 
                    onClick={() => handleOpenMedia(performance.id, performance.mediaUrl, performance.title)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {profile?.role === 'judge' ? 'Watch & Rate' : 'Watch & Vote'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={mediaOpen}
        onOpenChange={(open) => {
          setMediaOpen(open);
          if (!open) setActiveMedia(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{activeMedia?.title ?? 'Playback'}</DialogTitle>
          </DialogHeader>
          {activeMedia?.url ? (
            <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
              <div>
                {activeMedia.url.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
                  <AspectRatio ratio={16 / 9}>
                    <video
                      src={activeMedia.url}
                      controls
                      className="w-full h-full rounded-md"
                    />
                  </AspectRatio>
                ) : (
                  <audio src={activeMedia.url} controls className="w-full" />
                )}
              </div>
              <aside>
                {canVote ? (
                  <VoteControls performanceId={activeMedia.id} onVoted={fetchPerformances} />
                ) : (
                  <p className="text-sm text-muted-foreground">Sign in as audience or judger to vote.</p>
                )}
              </aside>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No media available</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerformanceList;
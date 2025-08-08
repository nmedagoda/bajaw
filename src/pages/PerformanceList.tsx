import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Play, Star, Clock, Music } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Performance {
  id: string;
  title: string;
  similarity_score: number;
  created_at: string;
  singer: {
    full_name: string;
    profile_photo_url: string;
  };
  song: {
    title: string;
    artist: string;
  };
  votes: Array<{
    score: number;
  }>;
}

const PerformanceList = () => {
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchPerformances();
  }, []);

  const fetchPerformances = async () => {
    try {
      const { data, error } = await supabase
        .from('performances')
        .select(`
          id,
          title,
          similarity_score,
          created_at,
          singer:profiles!singer_id (
            full_name,
            profile_photo_url
          ),
          song:songs (
            title,
            artist
          ),
          votes (
            score
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPerformances(data || []);
    } catch (error) {
      console.error('Error fetching performances:', error);
      toast.error('Failed to load performances');
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Vocal Performances</h1>
        <p className="text-muted-foreground">
          {profile?.role === 'singer' 
            ? 'Discover amazing performances and get inspired'
            : profile?.role === 'judge'
            ? 'Rate and provide feedback on performances'
            : 'Vote for your favorite performances'
          }
        </p>
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
          {performances.map((performance) => (
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
                      <p className="text-sm text-muted-foreground">{performance.singer?.full_name}</p>
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
                    <span className="font-medium">{performance.song?.title}</span>
                    <span className="mx-1">•</span>
                    <span>{performance.song?.artist}</span>
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
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg flex items-center justify-center group-hover:from-primary/20 group-hover:to-accent/20 transition-colors">
                    <div className="text-center">
                      <Play className="w-12 h-12 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-sm text-muted-foreground">Click to watch</p>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full group-hover:shadow-md transition-shadow" 
                    onClick={() => toast.success('Video player will be implemented soon!')}
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
    </div>
  );
};

export default PerformanceList;
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, Mic, Play, Pause, Square, Upload, Search, Timer, Volume2, Loader2, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre: string;
  duration: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  popularity?: number;
  previewUrl?: string | null;
  spotifyUrl?: string;
  imageUrl?: string | null;
  searchSnippet?: string;
  originalUrl?: string;
  lyrics?: string;
  lyricsImageUrl?: string | null;
  lyricsLanguage?: string;
}

const RecordSong = () => {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [performanceTitle, setPerformanceTitle] = useState('');
  const [performanceDescription, setPerformanceDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search for songs using Spotify API
  const searchSongs = async (query: string) => {
    if (!query.trim()) {
      setSongs([]);
      setSearchTotal(0);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-songs', {
        body: { query, limit: 20 }
      });

      if (error) {
        console.error('Search error:', error);
        toast.error('Failed to search songs. Please check your internet connection.');
        return;
      }

      if (data.error) {
        console.error('API error:', data.error);
        if (data.error.includes('credentials not configured')) {
          toast.error('Spotify API not configured. Please contact support.');
        } else {
          toast.error('Failed to search songs.');
        }
        return;
      }

      setSongs(data.songs || []);
      setSearchTotal(data.total || 0);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search songs');
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchSongs(searchQuery);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Load popular songs on component mount
  useEffect(() => {
    // Clear any existing search data
    setSearchQuery('');
    setSongs([]);
    setSearchTotal(0);
    
    // Clear any browser storage related to search
    try {
      localStorage.removeItem('songSearchHistory');
      localStorage.removeItem('recentSearches');
      sessionStorage.removeItem('songSearchHistory');
      sessionStorage.removeItem('recentSearches');
    } catch (error) {
      console.log('Storage clear skipped');
    }
    
    searchSongs('popular songs 2024');
  }, []);

  // Clear search function
  const clearSearch = () => {
    setSearchQuery('');
    setSongs([]);
    setSearchTotal(0);
    
    // Clear any browser storage
    try {
      localStorage.removeItem('songSearchHistory');
      localStorage.removeItem('recentSearches');
      sessionStorage.removeItem('songSearchHistory');
      sessionStorage.removeItem('recentSearches');
    } catch (error) {
      console.log('Storage clear skipped');
    }
    
    searchSongs('popular songs 2024');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Hard': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      audioStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast.success('Recording started!');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        intervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        setIsPaused(false);
        toast.success('Recording resumed');
      } else {
        mediaRecorderRef.current.pause();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsPaused(true);
        toast.success('Recording paused');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Stop all tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setIsRecording(false);
      setIsPaused(false);
      toast.success('Recording completed!');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadPerformance = async () => {
    if (!audioBlob || !performanceTitle.trim()) {
      toast.error('Please provide a title and record audio');
      return;
    }

    try {
      setUploadProgress(0);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Here you would typically upload to your backend/Supabase
      // For now, we'll simulate the upload
      setTimeout(() => {
        setUploadProgress(100);
        toast.success('Performance uploaded successfully!');
        
        // Reset form
        setAudioBlob(null);
        setPerformanceTitle('');
        setPerformanceDescription('');
        setRecordingTime(0);
        setUploadProgress(0);
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload performance');
      setUploadProgress(0);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Record New Song
        </h1>
        <p className="text-muted-foreground">
          Choose a song and record your performance to get AI-powered vocal analysis
        </p>
      </div>

      <Tabs defaultValue="search" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Song Library
          </TabsTrigger>
          <TabsTrigger value="record" className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Recording Studio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6">
          {/* Song Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="w-5 h-5" />
                Choose Your Song
              </CardTitle>
              <CardDescription>
                Search the internet for any song and select a track to perform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search by song title, artist, or genre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-8"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={clearSearch}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <Button variant="outline" size="icon" disabled={isSearching}>
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {searchTotal > 0 && (
                <p className="text-sm text-muted-foreground">
                  Found {searchTotal} songs {searchQuery && `for "${searchQuery}"`}
                </p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                  {isSearching && songs.length === 0 ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">Searching for songs...</p>
                    </div>
                  ) : songs.length === 0 ? (
                    <div className="text-center py-8">
                      <Music className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchQuery ? 'No songs found. Try a different search term.' : 'Start typing to search for songs on the internet...'}
                      </p>
                    </div>
                  ) : (
                    songs.map((song) => (
                      <Card 
                        key={song.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedSong?.id === song.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setSelectedSong(song)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {song.imageUrl && (
                                <img 
                                  src={song.imageUrl} 
                                  alt={`${song.title} cover`}
                                  className="w-12 h-12 rounded object-cover"
                                />
                              )}
                              <div className="flex-1">
                                <h3 className="font-semibold">{song.title}</h3>
                                <p className="text-sm text-muted-foreground">{song.artist}</p>
                                {song.album && (
                                  <p className="text-xs text-muted-foreground">{song.album}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="secondary">{song.genre}</Badge>
                                  <Badge 
                                    className={`text-white ${getDifficultyColor(song.difficulty)}`}
                                  >
                                    {song.difficulty}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Timer className="w-3 h-3" />
                                    {song.duration}
                                  </span>
                                   {song.originalUrl && (
                                     <a 
                                       href={song.originalUrl} 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       className="text-blue-600 hover:text-blue-700"
                                       onClick={(e) => e.stopPropagation()}
                                     >
                                       <ExternalLink className="w-3 h-3" />
                                     </a>
                                   )}
                                </div>
                              </div>
                            </div>
                            <Button 
                              variant={selectedSong?.id === song.id ? "default" : "outline"}
                              size="sm"
                            >
                              {selectedSong?.id === song.id ? 'Selected' : 'Select'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Lyrics Display */}
                {selectedSong && (selectedSong.lyrics || selectedSong.lyricsImageUrl) && (
                  <Card className="lg:sticky lg:top-4">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Music className="w-4 h-4" />
                        Lyrics - {selectedSong.title}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        by {selectedSong.artist}
                        {selectedSong.lyricsLanguage && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {selectedSong.lyricsLanguage}
                          </Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border border-border rounded-lg p-4 bg-muted/20 max-h-80 overflow-y-auto">
                        {selectedSong.lyricsImageUrl ? (
                          <div className="space-y-3">
                            <img 
                              src={selectedSong.lyricsImageUrl} 
                              alt={`Lyrics for ${selectedSong.title}`}
                              className="w-full rounded border object-contain max-h-64"
                              onError={(e) => {
                                console.error('Failed to load lyrics image:', selectedSong.lyricsImageUrl);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="text-center py-8 text-muted-foreground">
                                      <p>Unable to load lyrics image</p>
                                      <p class="text-xs mt-2">URL: ${selectedSong.lyricsImageUrl}</p>
                                    </div>
                                  `;
                                }
                              }}
                              crossOrigin="anonymous"
                            />
                            <p className="text-xs text-muted-foreground">
                              Lyrics image in {selectedSong.lyricsLanguage || 'original language'}
                            </p>
                          </div>
                        ) : (
                          <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                            {selectedSong.lyrics}
                          </pre>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Note: This is sample lyrics structure. Real implementation would require proper licensing for copyrighted content.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="record" className="space-y-6">
          {/* Recording Studio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recording Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  Recording Studio
                </CardTitle>
                <CardDescription>
                  Record your performance with professional quality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedSong && (
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <h3 className="font-semibold">{selectedSong.title}</h3>
                    <p className="text-sm text-muted-foreground">{selectedSong.artist}</p>
                  </div>
                )}

                <div className="text-center space-y-4">
                  <div className="text-3xl font-mono">
                    {formatTime(recordingTime)}
                  </div>
                  
                  {isRecording && (
                    <div className="flex items-center justify-center gap-2 text-red-500">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">
                        {isPaused ? 'PAUSED' : 'RECORDING'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-center gap-2">
                    {!isRecording ? (
                      <Button 
                        onClick={startRecording}
                        className="flex items-center gap-2"
                        disabled={!selectedSong}
                      >
                        <Mic className="w-4 h-4" />
                        Start Recording
                      </Button>
                    ) : (
                      <>
                        <Button 
                          onClick={pauseRecording}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                          {isPaused ? 'Resume' : 'Pause'}
                        </Button>
                        <Button 
                          onClick={stopRecording}
                          variant="destructive"
                          className="flex items-center gap-2"
                        >
                          <Square className="w-4 h-4" />
                          Stop
                        </Button>
                      </>
                    )}
                  </div>

                  {!selectedSong && (
                    <p className="text-sm text-muted-foreground">
                      Please select a song from the library first
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Performance Details
                </CardTitle>
                <CardDescription>
                  Add details about your performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Performance Title *</Label>
                  <Input
                    id="title"
                    placeholder="My cover of..."
                    value={performanceTitle}
                    onChange={(e) => setPerformanceTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Tell us about your performance..."
                    value={performanceDescription}
                    onChange={(e) => setPerformanceDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {audioBlob && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                        <Volume2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Recording Ready</span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Duration: {formatTime(recordingTime)}
                      </p>
                    </div>

                    {uploadProgress > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Uploading...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} />
                      </div>
                    )}

                    <Button 
                      onClick={uploadPerformance}
                      className="w-full"
                      disabled={uploadProgress > 0 && uploadProgress < 100}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Performance
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecordSong;
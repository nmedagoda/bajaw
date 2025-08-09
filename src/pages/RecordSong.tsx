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
import { Music, Mic, Play, Pause, Square, Upload, Search, Timer, Volume2, Loader2, ExternalLink, X, FileAudio } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  const { user } = useAuth();
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [singerName, setSingerName] = useState('');
  const [songWords, setSongWords] = useState('');
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

  // Upload Songs tab state
  const [songTitle, setSongTitle] = useState('');
  const [originalSingerName, setOriginalSingerName] = useState('');
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [recordedFileType, setRecordedFileType] = useState<'wav' | 'mp3'>('mp3');
  const [originalFileType, setOriginalFileType] = useState<'wav' | 'mp3'>('mp3');
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search for songs using Google API with singer priority
  const searchSongs = async (singer: string, words?: string) => {
    if (!singer.trim()) {
      setSongs([]);
      setSearchTotal(0);
      return;
    }

    setIsSearching(true);
    try {
      // Prioritize singer name first, then add song words
      const searchTerm = words?.trim() 
        ? `${singer} ${words}`.trim() 
        : singer;
      
      const { data, error } = await supabase.functions.invoke('search-songs', {
        body: { query: searchTerm, limit: 20 }
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
      searchSongs(singerName, songWords);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [singerName, songWords]);

  // Load popular songs on component mount
  useEffect(() => {
    // Clear any existing search data
    setSingerName('');
    setSongWords('');
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
    setSingerName('');
    setSongWords('');
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

  // Upload songs functionality
  const handleFileUpload = async () => {
    if (!user) {
      toast.error('Please log in to upload songs');
      return;
    }

    if (!songTitle.trim() || !originalSingerName.trim() || !recordedFile || !originalFile) {
      toast.error('Please fill in all fields and select both audio files');
      return;
    }

    setIsUploading(true);
    try {
      // Upload recorded song file
      const recordedFileName = `${user.id}/recorded/${Date.now()}_${recordedFile.name}`;
      const { data: recordedData, error: recordedError } = await supabase.storage
        .from('audio-uploads')
        .upload(recordedFileName, recordedFile);

      if (recordedError) throw recordedError;

      // Upload original song file
      const originalFileName = `${user.id}/original/${Date.now()}_${originalFile.name}`;
      const { data: originalData, error: originalError } = await supabase.storage
        .from('audio-uploads')
        .upload(originalFileName, originalFile);

      if (originalError) throw originalError;

      // Get public URLs
      const { data: recordedUrl } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(recordedData.path);

      const { data: originalUrl } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(originalData.path);

      // Save to database
      const { error: dbError } = await supabase
        .from('uploaded_songs')
        .insert({
          singer_id: user.id,
          song_title: songTitle,
          original_singer_name: originalSingerName,
          recorded_song_url: recordedUrl.publicUrl,
          original_song_url: originalUrl.publicUrl,
          recorded_file_type: recordedFileType,
          original_file_type: originalFileType
        });

      if (dbError) throw dbError;

      toast.success('Songs uploaded successfully!');
      
      // Reset form
      setSongTitle('');
      setOriginalSingerName('');
      setRecordedFile(null);
      setOriginalFile(null);
      setRecordedFileType('mp3');
      setOriginalFileType('mp3');

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload songs');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecordedFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileType = file.type;
      if (fileType === 'audio/wav' || fileType === 'audio/mpeg' || fileType === 'audio/mp3') {
        setRecordedFile(file);
        setRecordedFileType(fileType === 'audio/wav' ? 'wav' : 'mp3');
      } else {
        toast.error('Please select a valid .wav or .mp3 file');
      }
    }
  };

  const handleOriginalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileType = file.type;
      if (fileType === 'audio/wav' || fileType === 'audio/mpeg' || fileType === 'audio/mp3') {
        setOriginalFile(file);
        setOriginalFileType(fileType === 'audio/wav' ? 'wav' : 'mp3');
      } else {
        toast.error('Please select a valid .wav or .mp3 file');
      }
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

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <FileAudio className="w-4 h-4" />
            Upload Songs
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Song Library
          </TabsTrigger>
          <TabsTrigger value="record" className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Recording Studio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* Upload Songs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileAudio className="w-5 h-5" />
                Upload Songs
              </CardTitle>
              <CardDescription>
                Upload both your recorded version and the original song for comparison
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Song Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Song Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="songTitle">Song Title *</Label>
                    <Input
                      id="songTitle"
                      placeholder="Enter song title..."
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="originalSinger">Original Singer's Name *</Label>
                    <Input
                      id="originalSinger"
                      placeholder="Enter original singer's name..."
                      value={originalSingerName}
                      onChange={(e) => setOriginalSingerName(e.target.value)}
                    />
                  </div>
                </div>

                {/* File Uploads */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Audio Files</h3>
                  
                  {/* Recorded Song Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="recordedFile">Your Recorded Version *</Label>
                    <div className="space-y-2">
                      <Input
                        id="recordedFile"
                        type="file"
                        accept=".wav,.mp3,audio/wav,audio/mpeg,audio/mp3"
                        onChange={handleRecordedFileChange}
                      />
                      <div className="flex items-center gap-2">
                        <Label htmlFor="recordedType" className="text-sm">File Type:</Label>
                        <Select value={recordedFileType} onValueChange={(value: 'wav' | 'mp3') => setRecordedFileType(value)}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mp3">MP3</SelectItem>
                            <SelectItem value="wav">WAV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {recordedFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {recordedFile.name} ({(recordedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Original Song Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="originalFile">Original Song *</Label>
                    <div className="space-y-2">
                      <Input
                        id="originalFile"
                        type="file"
                        accept=".wav,.mp3,audio/wav,audio/mpeg,audio/mp3"
                        onChange={handleOriginalFileChange}
                      />
                      <div className="flex items-center gap-2">
                        <Label htmlFor="originalType" className="text-sm">File Type:</Label>
                        <Select value={originalFileType} onValueChange={(value: 'wav' | 'mp3') => setOriginalFileType(value)}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mp3">MP3</SelectItem>
                            <SelectItem value="wav">WAV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {originalFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {originalFile.name} ({(originalFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Button */}
              <div className="flex justify-center pt-4 border-t">
                <Button 
                  onClick={handleFileUpload}
                  disabled={isUploading || !songTitle.trim() || !originalSingerName.trim() || !recordedFile || !originalFile}
                  className="px-8"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Songs
                    </>
                  )}
                </Button>
              </div>

              {/* Help Text */}
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <h4 className="font-medium mb-2">Upload Guidelines:</h4>
                <ul className="space-y-1 text-xs">
                  <li>• Supported formats: .wav and .mp3</li>
                  <li>• Maximum file size: 50MB per file</li>
                  <li>• Both your recorded version and the original song are required</li>
                  <li>• Files will be stored securely and linked to your account</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Enter original singer's name..."
                      value={singerName}
                      onChange={(e) => setSingerName(e.target.value)}
                      className="pr-8"
                    />
                    {(singerName || songWords) && (
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

                <div className="flex gap-2">
                  <Input
                    placeholder="Add some song words or lyrics (optional)..."
                    value={songWords}
                    onChange={(e) => setSongWords(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {searchTotal > 0 && (
                <p className="text-sm text-muted-foreground">
                  Found {searchTotal} songs {singerName && `for "${singerName}"`} {songWords && `with words "${songWords}"`}
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
                        {singerName || songWords ? 'No songs found. Try a different singer or song words.' : 'Enter a singer\'s name to search for songs with lyrics...'}
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
                  Recording Controls
                </CardTitle>
                <CardDescription>
                  Record your performance with professional-quality audio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedSong && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h3 className="font-semibold text-sm mb-1">Selected Song</h3>
                    <p className="text-sm">{selectedSong.title}</p>
                    <p className="text-xs text-muted-foreground">by {selectedSong.artist}</p>
                  </div>
                )}

                {/* Recording Timer */}
                <div className="text-center py-6">
                  <div className="text-4xl font-mono font-bold mb-2">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="flex items-center justify-center gap-1 mb-4">
                    <Timer className="w-4 h-4" />
                    <span className="text-sm text-muted-foreground">Recording Time</span>
                  </div>
                  
                  {/* Recording Status */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {isRecording && (
                      <>
                        <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                        <span className="text-sm font-medium">
                          {isPaused ? 'Paused' : 'Recording'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center justify-center gap-3">
                    {!isRecording ? (
                      <Button onClick={startRecording} size="lg" className="px-8">
                        <Mic className="w-4 h-4 mr-2" />
                        Start Recording
                      </Button>
                    ) : (
                      <>
                        <Button 
                          onClick={pauseRecording} 
                          variant="outline" 
                          size="lg"
                        >
                          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </Button>
                        <Button 
                          onClick={stopRecording} 
                          variant="destructive" 
                          size="lg"
                        >
                          <Square className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Audio Preview */}
                {audioBlob && (
                  <div className="border border-dashed border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 className="w-4 h-4" />
                      <span className="font-medium">Recording Preview</span>
                    </div>
                    <audio 
                      controls 
                      src={URL.createObjectURL(audioBlob)}
                      className="w-full"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Performance
                </CardTitle>
                <CardDescription>
                  Add details about your performance and upload to get analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Performance Title *</Label>
                  <Input
                    id="title"
                    placeholder="Give your performance a title..."
                    value={performanceTitle}
                    onChange={(e) => setPerformanceTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Add any notes about your performance..."
                    value={performanceDescription}
                    onChange={(e) => setPerformanceDescription(e.target.value)}
                    rows={3}
                  />
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
                  {uploadProgress > 0 && uploadProgress < 100 ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Analyze
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecordSong;
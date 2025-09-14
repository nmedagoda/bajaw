import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { resolvePlayableUrl } from '@/lib/media';

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
  source?: string;
}

const RecordSong = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'upload';
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

  // Karaoke track state for Recording Studio
  const [karaokeFile, setKaraokeFile] = useState<File | null>(null);
  const [selectedKaraokeTrack, setSelectedKaraokeTrack] = useState<Song | null>(null);
  const [karaokeSource, setKaraokeSource] = useState<'upload' | 'select' | 'database' | null>(null);
  const [isKaraokeReady, setIsKaraokeReady] = useState(false);
  const [karaokeSongTitle, setKaraokeSongTitle] = useState('');
  const [karaokeOriginalSinger, setKaraokeOriginalSinger] = useState('');
  const [databaseKaraokeTracks, setDatabaseKaraokeTracks] = useState<any[]>([]);
  const [karaokeSearchTerm, setKaraokeSearchTerm] = useState('');
  const [selectedDatabaseTrack, setSelectedDatabaseTrack] = useState<any>(null);
  const [showUploadOption, setShowUploadOption] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const karaokeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const karaokeSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Load karaoke tracks from database on component mount
  useEffect(() => {
    const loadKaraokeTracks = async () => {
      try {
        const { data, error } = await supabase
          .from('karaoke_tracks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading karaoke tracks:', error);
          return;
        }

        setDatabaseKaraokeTracks(data || []);
      } catch (error) {
        console.error('Error loading karaoke tracks:', error);
      }
    };

    loadKaraokeTracks();
  }, []);

  // Filter karaoke tracks based on search term
  const filteredKaraokeTracks = databaseKaraokeTracks.filter(track => 
    track.song_title.toLowerCase().includes(karaokeSearchTerm.toLowerCase()) ||
    track.original_singer_name.toLowerCase().includes(karaokeSearchTerm.toLowerCase())
  );

  // Select karaoke track from database
  const selectDatabaseKaraokeTrack = async (track: any) => {
    setSelectedDatabaseTrack(track);
    setKaraokeSource('database');
    setKaraokeFile(null);
    setSelectedKaraokeTrack(null);
    
    // Resolve the karaoke URL for playback
    try {
      const resolvedUrl = await resolvePlayableUrl(track.karaoke_file_url);
      if (resolvedUrl && karaokeAudioRef.current) {
        karaokeAudioRef.current.src = resolvedUrl;
        karaokeAudioRef.current.onloadeddata = () => {
          setIsKaraokeReady(true);
        };
        karaokeAudioRef.current.onerror = () => {
          console.error('Failed to load karaoke track:', track.karaoke_file_url);
          toast.error('Failed to load karaoke track. Please try another track.');
          setIsKaraokeReady(false);
        };
      }
    } catch (error) {
      console.error('Error resolving karaoke URL:', error);
      toast.error('Failed to load karaoke track.');
      setIsKaraokeReady(false);
    }
    
    toast.success('Karaoke track selected from library!');
  };
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
      // Clean up any existing audio context and sources
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (karaokeSourceRef.current) {
        karaokeSourceRef.current.disconnect();
        karaokeSourceRef.current = null;
      }

      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false, // Disable for better mixing
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        } 
      });
      
      // Create audio context for mixing
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // Create microphone source
      const micSource = audioContext.createMediaStreamSource(micStream);
      
      // Create destination for mixed audio
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect microphone to destination
      micSource.connect(destination);
      
      // If karaoke track is selected, play it and mix with microphone
      if (karaokeAudioRef.current && isKaraokeReady) {
        try {
          // Only create a new MediaElementSourceNode if one doesn't exist
          if (!karaokeSourceRef.current) {
            karaokeSourceRef.current = audioContext.createMediaElementSource(karaokeAudioRef.current);
          }
          karaokeSourceRef.current.connect(destination);
          karaokeSourceRef.current.connect(audioContext.destination); // Also play through speakers
          
          // Start karaoke playback
          karaokeAudioRef.current.currentTime = 0;
          await karaokeAudioRef.current.play();
        } catch (error) {
          console.error('Error setting up karaoke audio:', error);
          // Continue with recording even if karaoke fails
        }
      }
      
      audioStreamRef.current = destination.stream;
      const mediaRecorder = new MediaRecorder(destination.stream, {
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
        
        // Stop karaoke playback
        if (karaokeAudioRef.current) {
          karaokeAudioRef.current.pause();
        }
        
        // Clean up audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast.success('Recording started with karaoke!');
    } catch (error) {
      console.error('Error starting recording:', error);
      
      // Clean up any partially created resources
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (karaokeSourceRef.current) {
        karaokeSourceRef.current.disconnect();
        karaokeSourceRef.current = null;
      }
      
      // Show specific error message
      let errorMessage = 'Failed to start recording.';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Microphone permission denied. Please allow microphone access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please check your audio devices.';
        } else if (error.name === 'InvalidStateError') {
          errorMessage = 'Audio device is already in use. Please close other applications using the microphone.';
        } else {
          errorMessage = `Recording error: ${error.message}`;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        if (karaokeAudioRef.current) {
          karaokeAudioRef.current.play();
        }
        intervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        setIsPaused(false);
        toast.success('Recording resumed');
      } else {
        mediaRecorderRef.current.pause();
        if (karaokeAudioRef.current) {
          karaokeAudioRef.current.pause();
        }
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
      
      // Stop karaoke playback
      if (karaokeAudioRef.current) {
        karaokeAudioRef.current.pause();
        karaokeAudioRef.current.currentTime = 0;
      }
      
      // Stop all tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Clean up karaoke source
      if (karaokeSourceRef.current) {
        karaokeSourceRef.current.disconnect();
        karaokeSourceRef.current = null;
      }
      
      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
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

    if (!user) {
      toast.error('Please log in to upload performances');
      return;
    }

    try {
      setUploadProgress(10);
      
      // Convert audio blob to file
      const audioFile = new File([audioBlob], 'performance.webm', { type: 'audio/webm' });
      
      // Upload audio file to storage
      const audioFileName = `${user.id}/performances/${Date.now()}_${audioFile.name}`;
      setUploadProgress(30);
      
      const { data: audioData, error: audioError } = await supabase.storage
        .from('audio-uploads')
        .upload(audioFileName, audioFile);
      
      if (audioError) throw audioError;
      setUploadProgress(60);

      // Get public URL
      const { data: audioUrl } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(audioData.path);
      
      setUploadProgress(80);

      // Save performance to database
      const performanceData: any = {
        singer_id: user.id,
        title: performanceTitle.trim(),
        audio_url: audioUrl.publicUrl,
        analysis_data: {
          recording_duration: recordingTime,
          karaoke_used: isKaraokeReady,
          karaoke_source: karaokeSource,
          description: performanceDescription.trim() || null
        }
      };

      // If there's a selected song, try to link it
      if (selectedSong) {
        // First try to find existing song in database
        const { data: existingSong } = await supabase
          .from('songs')
          .select('id')
          .ilike('title', selectedSong.title)
          .ilike('artist', selectedSong.artist)
          .maybeSingle();

        if (existingSong) {
          performanceData.song_id = existingSong.id;
        } else {
          // Create new song entry
          const { data: newSong, error: songError } = await supabase
            .from('songs')
            .insert({
              title: selectedSong.title,
              artist: selectedSong.artist,
              lyrics: selectedSong.lyrics || null
            })
            .select('id')
            .single();

          if (!songError && newSong) {
            performanceData.song_id = newSong.id;
          }
        }
      }

      const { error: dbError } = await supabase
        .from('performances')
        .insert(performanceData);

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success('Performance uploaded successfully!');
      
      // Reset form
      setAudioBlob(null);
      setPerformanceTitle('');
      setPerformanceDescription('');
      setRecordingTime(0);
      setUploadProgress(0);
      
      // Clear karaoke selection if it was uploaded file
      if (karaokeSource === 'upload') {
        clearKaraokeSelection();
      }

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

    if (!songTitle.trim() || !originalSingerName.trim() || !recordedFile) {
      toast.error('Please fill in song title, original singer, and your recorded file');
      return;
    }

    setIsUploading(true);
    try {
      const normalizedTitle = songTitle.trim();
      const normalizedArtist = originalSingerName.trim();

      // 1) Upload recorded song file (always unique per singer)
      const recordedFileName = `${user.id}/recorded/${Date.now()}_${recordedFile.name}`;
      const { data: recordedData, error: recordedError } = await supabase.storage
        .from('audio-uploads')
        .upload(recordedFileName, recordedFile);
      if (recordedError) throw recordedError;

      // Get recorded public URL
      const { data: recordedUrl } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(recordedData.path);

      // 2) Check if an Original Song already exists in canonical songs table
      let originalPublicUrl: string | null = null;
      let usedExistingOriginal = false;

      const { data: existingSong, error: findSongError } = await supabase
        .from('songs')
        .select('id, professional_audio_url')
        .ilike('title', normalizedTitle)
        .ilike('artist', normalizedArtist)
        .not('professional_audio_url', 'is', null)
        .maybeSingle();

      if (findSongError) {
        console.warn('Song lookup warning:', findSongError.message);
      }

      if (existingSong?.professional_audio_url) {
        // Reuse existing original without re-uploading
        originalPublicUrl = existingSong.professional_audio_url as string;
        usedExistingOriginal = true;
      } else {
        // No existing original found. Require a file to be provided once.
        if (!originalFile) {
          throw new Error('Original song not found in library. Please upload the original song file once.');
        }

        // Upload original song file only when not already present
        const originalFileName = `${user.id}/original/${Date.now()}_${originalFile.name}`;
        const { data: originalData, error: originalError } = await supabase.storage
          .from('audio-uploads')
          .upload(originalFileName, originalFile);
        if (originalError) throw originalError;

        const { data: originalUrl } = supabase.storage
          .from('audio-uploads')
          .getPublicUrl(originalData.path);
        originalPublicUrl = originalUrl.publicUrl;

        // Try to seed the canonical songs table so future uploads can reuse it
        // (INSERT only; we avoid UPDATE due to current RLS restrictions)
        const { error: seedError } = await supabase
          .from('songs')
          .insert({ title: normalizedTitle, artist: normalizedArtist, professional_audio_url: originalPublicUrl });
        if (seedError) {
          console.warn('Seeding songs table failed (non-blocking):', seedError.message);
        }
      }

      // 3) Save to uploaded_songs (per-singer metadata)
      const { error: dbError } = await supabase
        .from('uploaded_songs')
        .insert({
          singer_id: user.id,
          song_title: normalizedTitle,
          original_singer_name: normalizedArtist,
          recorded_song_url: recordedUrl.publicUrl,
          original_song_url: originalPublicUrl,
          recorded_file_type: recordedFileType,
          original_file_type: originalFileType
        });
      if (dbError) throw dbError;

      if (usedExistingOriginal) {
        toast.success('Uploaded recording. Reused existing original song.');
      } else {
        toast.success('Songs uploaded successfully!');
      }

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

  // Save karaoke track information to database
  const saveKaraokeTrack = async (file: File) => {
    if (!user) {
      toast.error('Please log in to save karaoke tracks');
      return;
    }

    if (!karaokeSongTitle.trim() || !karaokeOriginalSinger.trim()) {
      toast.error('Please fill in song title and original singer name');
      return;
    }

    try {
      // Upload karaoke file to storage
      const karaokeFileName = `${user.id}/karaoke/${Date.now()}_${file.name}`;
      const { data: karaokeData, error: karaokeError } = await supabase.storage
        .from('audio-uploads')
        .upload(karaokeFileName, file);
      
      if (karaokeError) throw karaokeError;

      // Get public URL
      const { data: karaokeUrl } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(karaokeData.path);

      // Save to karaoke_tracks table
      const { error: dbError } = await supabase
        .from('karaoke_tracks')
        .insert({
          uploader_id: user.id,
          song_title: karaokeSongTitle.trim(),
          original_singer_name: karaokeOriginalSinger.trim(),
          karaoke_file_url: karaokeUrl.publicUrl,
          file_type: file.type === 'audio/wav' ? 'wav' : 'mp3'
        });

      if (dbError) throw dbError;

      toast.success('Karaoke track saved successfully!');
      
      // Refresh the karaoke tracks list
      const { data: updatedTracks } = await supabase
        .from('karaoke_tracks')
        .select('*')
        .order('created_at', { ascending: false });
      
      setDatabaseKaraokeTracks(updatedTracks || []);
    } catch (error) {
      console.error('Save karaoke error:', error);
      toast.error('Failed to save karaoke track');
    }
  };

  // Handle karaoke file upload
  const handleKaraokeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileType = file.type;
      if (fileType === 'audio/wav' || fileType === 'audio/mpeg' || fileType === 'audio/mp3') {
        setKaraokeFile(file);
        setKaraokeSource('upload');
        setSelectedKaraokeTrack(null);
        setIsKaraokeReady(true);
        
        // Don't auto-save, let user manually save with the button
        toast.success('Karaoke track uploaded! Fill in song details and click Save to add to library.');
      } else {
        toast.error('Please select a valid .wav or .mp3 file');
      }
    }
  };

  // Handle karaoke track selection from database
  const selectKaraokeTrack = (song: Song) => {
    setSelectedKaraokeTrack(song);
    setKaraokeSource('select');
    setKaraokeFile(null);
    setIsKaraokeReady(true);
    toast.success('Karaoke track selected!');
  };


  // Clear karaoke selection
  const clearKaraokeSelection = () => {
    setKaraokeFile(null);
    setSelectedKaraokeTrack(null);
    setSelectedDatabaseTrack(null);
    setKaraokeSource(null);
    setIsKaraokeReady(false);
    setKaraokeSongTitle('');
    setKaraokeOriginalSinger('');
    setShowUploadOption(false);
    
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Record New Song
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Choose a song and record your performance to get AI-powered vocal analysis
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="upload" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm p-2 sm:p-3">
            <FileAudio className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Upload Songs</span>
            <span className="sm:hidden">Upload</span>
          </TabsTrigger>
          <TabsTrigger value="search" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm p-2 sm:p-3">
            <Search className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Song Library</span>
            <span className="sm:hidden">Library</span>
          </TabsTrigger>
          <TabsTrigger value="record" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm p-2 sm:p-3">
            <Mic className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Recording Studio</span>
            <span className="sm:hidden">Record</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4 sm:space-y-6">
          {/* Upload Songs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <FileAudio className="w-4 h-4 sm:w-5 sm:h-5" />
                Upload Songs
              </CardTitle>
              <CardDescription className="text-sm">
                Upload both your recorded version and the original song for comparison
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Song Information */}
                <div className="space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold">Song Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="songTitle" className="text-sm">Song Title *</Label>
                    <Input
                      id="songTitle"
                      placeholder="Enter song title..."
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="originalSinger" className="text-sm">Original Singer's Name *</Label>
                    <Input
                      id="originalSinger"
                      placeholder="Enter original singer's name..."
                      value={originalSingerName}
                      onChange={(e) => setOriginalSingerName(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* File Uploads */}
                <div className="space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold">Audio Files</h3>
                  
                  {/* Recorded Song Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="recordedFile" className="text-sm">Your Recorded Version *</Label>
                    <div className="space-y-2">
                      <Input
                        id="recordedFile"
                        type="file"
                        accept=".wav,.mp3,audio/wav,audio/mpeg,audio/mp3"
                        onChange={handleRecordedFileChange}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Label htmlFor="recordedType" className="text-xs sm:text-sm">File Type:</Label>
                        <Select value={recordedFileType} onValueChange={(value: 'wav' | 'mp3') => setRecordedFileType(value)}>
                          <SelectTrigger className="w-16 sm:w-20 text-xs">
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
                    <Label htmlFor="originalFile">Original Song (auto-skipped if already exists)</Label>
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
                  disabled={isUploading || !songTitle.trim() || !originalSingerName.trim() || !recordedFile}
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
                  <li>• Your recorded version is required; the original will be reused automatically if it already exists</li>
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
          {/* Karaoke Track Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="w-5 h-5" />
                Choose Karaoke Track
              </CardTitle>
              <CardDescription>
                Select or upload a karaoke track to record with background music
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Browse Existing Karaoke Tracks */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">1. Browse Karaoke Library</h3>
                  <Badge variant="secondary">{databaseKaraokeTracks.length} tracks available</Badge>
                </div>
                
                {/* Search existing tracks */}
                <div className="space-y-3">
                  <Input
                    placeholder="Search by song title or artist name..."
                    value={karaokeSearchTerm}
                    onChange={(e) => setKaraokeSearchTerm(e.target.value)}
                    className="w-full"
                  />
                  
                  {/* Local Database Results */}
                  {filteredKaraokeTracks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">From Library</h4>
                      <div className="max-h-32 overflow-y-auto space-y-2 bg-muted/20 rounded-lg p-3">
                        {filteredKaraokeTracks.map((track) => (
                          <div
                            key={track.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                              selectedDatabaseTrack?.id === track.id ? 'border-primary bg-primary/10' : 'border-border'
                            }`}
                            onClick={() => selectDatabaseKaraokeTrack(track)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{track.song_title}</p>
                                <p className="text-xs text-muted-foreground">by {track.original_singer_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Added {new Date(track.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              {selectedDatabaseTrack?.id === track.id && (
                                <Badge variant="default" className="text-xs">Selected</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                  {/* Default state */}
                  {!karaokeSearchTerm && filteredKaraokeTracks.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg">
                      <p className="text-sm">No karaoke tracks available yet</p>
                      <p className="text-xs mt-1">Search for songs or upload a new track</p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        onClick={() => setShowUploadOption(true)}
                        className="mt-2"
                      >
                        Upload a track
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Search Online Songs (fallback) */}
              {!selectedDatabaseTrack && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-lg">2. Search Online Songs</h3>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {songs.slice(0, 3).map((song) => (
                      <div
                        key={song.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedKaraokeTrack?.id === song.id ? 'border-primary bg-primary/10' : 'border-border'
                        }`}
                        onClick={() => selectKaraokeTrack(song)}
                      >
                        <p className="text-sm font-medium">{song.title}</p>
                        <p className="text-xs text-muted-foreground">{song.artist}</p>
                      </div>
                    ))}
                    {songs.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Go to Song Library tab to search for songs
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Upload New Track (fallback) */}
              {(showUploadOption || (!selectedDatabaseTrack && songs.length === 0)) && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">3. Upload New Karaoke Track</h3>
                    {showUploadOption && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowUploadOption(false)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Song Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="karaokeSongTitle">Song Title *</Label>
                      <Input
                        id="karaokeSongTitle"
                        placeholder="Enter song title..."
                        value={karaokeSongTitle}
                        onChange={(e) => setKaraokeSongTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="karaokeOriginalSinger">Original Singer *</Label>
                      <Input
                        id="karaokeOriginalSinger"
                        placeholder="Enter original singer name..."
                        value={karaokeOriginalSinger}
                        onChange={(e) => setKaraokeOriginalSinger(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-3">
                    <Label>Karaoke Audio File</Label>
                    <Input
                      type="file"
                      accept=".wav,.mp3,audio/wav,audio/mpeg,audio/mp3"
                      onChange={handleKaraokeFileChange}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    {karaokeFile && karaokeSource === 'upload' && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium">Selected: {karaokeFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Size: {(karaokeFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Manual Save Button */}
                  {karaokeFile && karaokeSource === 'upload' && karaokeSongTitle.trim() && karaokeOriginalSinger.trim() && (
                    <Button 
                      onClick={() => saveKaraokeTrack(karaokeFile)}
                      variant="outline"
                      size="sm"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Save Karaoke Track
                    </Button>
                  )}
                </div>
              )}

              {/* Current Selection Display */}
              {isKaraokeReady && (
                <div className="border border-dashed border-border rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {karaokeSource === 'upload' ? 'Uploaded Track' : 
                         karaokeSource === 'database' ? 'Library Track' : 'Selected Track'}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearKaraokeSelection}>
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  
                  {karaokeSource === 'upload' && karaokeFile && (
                    <div>
                      <p className="text-sm mb-2 font-medium">{karaokeSongTitle || karaokeFile.name}</p>
                      {karaokeOriginalSinger && (
                        <p className="text-xs text-muted-foreground mb-2">by {karaokeOriginalSinger}</p>
                      )}
                      <audio
                        ref={karaokeAudioRef}
                        controls
                        src={URL.createObjectURL(karaokeFile)}
                        className="w-full"
                        onLoadedData={() => setIsKaraokeReady(true)}
                      />
                    </div>
                  )}
                  
                  {karaokeSource === 'database' && selectedDatabaseTrack && (
                    <div>
                      <p className="text-sm mb-1 font-medium">{selectedDatabaseTrack.song_title}</p>
                      <p className="text-xs text-muted-foreground mb-2">by {selectedDatabaseTrack.original_singer_name}</p>
                      <audio
                        ref={karaokeAudioRef}
                        controls
                        className="w-full"
                        onLoadedData={() => setIsKaraokeReady(true)}
                      />
                    </div>
                  )}
                  
                  {karaokeSource === 'select' && selectedKaraokeTrack && (
                    <div>
                      <p className="text-sm mb-2 font-medium">
                        {selectedKaraokeTrack.title} by {selectedKaraokeTrack.artist}
                      </p>
                      {selectedKaraokeTrack.previewUrl && (
                        <audio
                          ref={karaokeAudioRef}
                          controls
                          src={selectedKaraokeTrack.previewUrl}
                          className="w-full"
                          onLoadedData={() => setIsKaraokeReady(true)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isKaraokeReady && !showUploadOption && (
                <div className="text-center py-6 text-muted-foreground">
                  <Music className="w-8 h-8 mx-auto mb-2" />
                  <p>Select a karaoke track from the library above to get started</p>
                  <Button 
                    variant="link" 
                    onClick={() => setShowUploadOption(true)}
                    className="mt-2"
                  >
                    Or upload a new track
                  </Button>
                </div>
              )}

              {/* Current Karaoke Track */}
              {isKaraokeReady && (
                <div className="border border-dashed border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {karaokeSource === 'upload' ? 'Uploaded Track' : 'Selected Track'}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearKaraokeSelection}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {karaokeSource === 'upload' && karaokeFile && (
                    <div>
                      <p className="text-sm mb-2">{karaokeFile.name}</p>
                      <audio
                        ref={karaokeAudioRef}
                        controls
                        src={URL.createObjectURL(karaokeFile)}
                        className="w-full"
                        onLoadedData={() => setIsKaraokeReady(true)}
                      />
                    </div>
                  )}
                  
                  {karaokeSource === 'select' && selectedKaraokeTrack && (
                    <div>
                      <p className="text-sm mb-2">
                        {selectedKaraokeTrack.title} by {selectedKaraokeTrack.artist}
                      </p>
                      {selectedKaraokeTrack.previewUrl && (
                        <audio
                          ref={karaokeAudioRef}
                          controls
                          src={selectedKaraokeTrack.previewUrl}
                          className="w-full"
                          onLoadedData={() => setIsKaraokeReady(true)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isKaraokeReady && (
                <div className="text-center py-6 text-muted-foreground">
                  <Music className="w-8 h-8 mx-auto mb-2" />
                  <p>Upload a karaoke track or select a song to get started</p>
                </div>
              )}
            </CardContent>
          </Card>

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
                  Record your vocals with karaoke background music
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Karaoke Track Status */}
                {isKaraokeReady ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        Karaoke Track Ready
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {karaokeSource === 'upload' && karaokeFile ? karaokeFile.name : 
                       selectedKaraokeTrack ? `${selectedKaraokeTrack.title} by ${selectedKaraokeTrack.artist}` : ''}
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        No Karaoke Track
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recording will capture vocals only without background music
                    </p>
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
                      <Button 
                        onClick={startRecording} 
                        size="lg" 
                        className="px-8"
                        disabled={!isKaraokeReady}
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        {isKaraokeReady ? 'Start Recording with Karaoke' : 'Start Recording'}
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

                  {!isKaraokeReady && (
                    <p className="text-center text-sm text-muted-foreground mt-2">
                      Select a karaoke track above to record with background music
                    </p>
                  )}
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
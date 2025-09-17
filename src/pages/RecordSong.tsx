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
import { Music, Mic, Play, Pause, Square, Upload, Search, Timer, Volume2, Loader2, ExternalLink, X, FileAudio, RotateCcw, Trash2, Plus, Download } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolvePlayableUrl } from '@/lib/media';
import { OriginalSongPlayer } from '@/components/media/OriginalSongPlayer';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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
  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null);
  const [ffmpegReady, setFfmpegReady] = useState(false);

  // Karaoke track state for Recording Studio
  const [karaokeFile, setKaraokeFile] = useState<File | null>(null);
  const [karaokeOriginalFile, setKaraokeOriginalFile] = useState<File | null>(null);
  const [selectedKaraokeTrack, setSelectedKaraokeTrack] = useState<Song | null>(null);
  const [karaokeSource, setKaraokeSource] = useState<'upload' | 'select' | 'database' | null>(null);
  const [isKaraokeReady, setIsKaraokeReady] = useState(false);
  const [karaokeSongTitle, setKaraokeSongTitle] = useState('');
  const [karaokeOriginalSinger, setKaraokeOriginalSinger] = useState('');
  const [databaseKaraokeTracks, setDatabaseKaraokeTracks] = useState<any[]>([]);
  const [karaokeSearchTerm, setKaraokeSearchTerm] = useState('');
  const [selectedDatabaseTrack, setSelectedDatabaseTrack] = useState<any>(null);
  const [showUploadOption, setShowUploadOption] = useState(false);
  const [isKaraokeTestPlaying, setIsKaraokeTestPlaying] = useState(false);

  // Recording refs - SIMPLIFIED APPROACH
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const karaokeSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  // NEW APPROACH: Independent karaoke playback (no Web Audio API routing)
  const karaokeAudioRef = useRef<HTMLAudioElement | null>(null);
  const isKaraokePlayingRef = useRef(false);

  // Audio control state
  const [karaokeVolume, setKaraokeVolume] = useState(80);
  const [karaokeBass, setKaraokeBass] = useState(0);
  const [karaokeTreble, setKaraokeTreble] = useState(0);

  // Audio filter refs
  const gainNodeRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);

  // Initialize karaoke audio element with audio filters
  useEffect(() => {
    if (!karaokeAudioRef.current) {
      const audio = new Audio();
      audio.volume = 0.8;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      karaokeAudioRef.current = audio;
      console.log('✅ Karaoke audio element initialized');
      
      // Initialize audio context and filters
      initializeAudioFilters();
    }
  }, []);

  // Initialize audio filters
  const initializeAudioFilters = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    
    // Create gain node for volume control
    gainNodeRef.current = audioContext.createGain();
    
    // Create bass filter (low-shelf)
    bassFilterRef.current = audioContext.createBiquadFilter();
    bassFilterRef.current.type = 'lowshelf';
    bassFilterRef.current.frequency.value = 200;
    
    // Create treble filter (high-shelf)
    trebleFilterRef.current = audioContext.createBiquadFilter();
    trebleFilterRef.current.type = 'highshelf';
    trebleFilterRef.current.frequency.value = 3000;
  };

  // Apply audio effects when controls change
  useEffect(() => {
    if (karaokeAudioRef.current && gainNodeRef.current) {
      gainNodeRef.current.gain.value = karaokeVolume / 100;
    }
  }, [karaokeVolume]);

  useEffect(() => {
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.value = karaokeBass;
    }
  }, [karaokeBass]);

  useEffect(() => {
    if (trebleFilterRef.current) {
      trebleFilterRef.current.gain.value = karaokeTreble;
    }
  }, [karaokeTreble]);

  // Load karaoke tracks from database on component mount
  useEffect(() => {
    const loadKaraokeTracks = async () => {
      try {
        const { data, error } = await supabase
          .from('karaoke_tracks')
          .select('*, original_song_url')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading karaoke tracks:', error);
          return;
        }

        console.log('Loaded karaoke tracks:', data);
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
    console.log('🎵 Selecting karaoke track:', track);
    setSelectedDatabaseTrack(track);
    setKaraokeSource('database');
    setKaraokeFile(null);
    setSelectedKaraokeTrack(null);
    setIsKaraokeReady(true);
    
    // Setup karaoke audio
    try {
      const resolvedUrl = await resolvePlayableUrl(track.karaoke_file_url);
      console.log('🎵 Resolved karaoke URL:', resolvedUrl);
      if (resolvedUrl && karaokeAudioRef.current) {
        karaokeAudioRef.current.src = resolvedUrl;
        karaokeAudioRef.current.onloadeddata = () => {
          console.log('✅ Karaoke audio loaded successfully');
        };
        karaokeAudioRef.current.onerror = (e) => {
          console.error('❌ Failed to load karaoke track:', e);
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

  // Initialize FFmpeg
  useEffect(() => {
    const initFFmpeg = async () => {
      try {
        const ffmpegInstance = new FFmpeg();
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        
        ffmpegInstance.on('log', ({ message }) => {
          console.log('[FFmpeg]', message);
        });
        
        await ffmpegInstance.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        setFFmpeg(ffmpegInstance);
        setFfmpegReady(true);
      } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        toast.error('Failed to initialize audio converter');
      }
    };
    
    initFFmpeg();
  }, []);

  // Convert webm audio to mp3 using FFmpeg
  const convertWebmToMp3 = async (webmBlob: Blob): Promise<Blob> => {
    if (!ffmpeg || !ffmpegReady) {
      throw new Error('FFmpeg not ready for conversion');
    }

    try {
      const webmData = await fetchFile(webmBlob);
      await ffmpeg.writeFile('input.webm', webmData);
      
      await ffmpeg.exec(['-i', 'input.webm', '-acodec', 'mp3', '-ab', '128k', 'output.mp3']);
      
      const mp3Data = await ffmpeg.readFile('output.mp3');
      return new Blob([mp3Data], { type: 'audio/mp3' });
    } catch (error) {
      console.error('Failed to convert webm to mp3:', error);
      throw error;
    }
  };

  const searchSongs = async (singer: string, words?: string) => {
    if (!singer.trim()) {
      setSongs([]);
      setSearchTotal(0);
      return;
    }

    setIsSearching(true);
    try {
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
    setSingerName('');
    setSongWords('');
    setSongs([]);
    setSearchTotal(0);
    searchSongs('popular songs 2024');
  }, []);

  // Clear search function
  const clearSearch = () => {
    setSingerName('');
    setSongWords('');
    setSongs([]);
    setSearchTotal(0);
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

  // AUDIO MIXING APPROACH - Record both microphone and karaoke
  const startRecording = async () => {
    try {
      console.log('🎙️ Starting recording with audio mixing...');
      
      // Clean up any existing audio context and sources
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (karaokeSourceNodeRef.current) {
        karaokeSourceNodeRef.current = null;
      }
      
      // Reset karaoke audio element to prevent "already connected" error
      if (karaokeAudioRef.current) {
        const currentSrc = karaokeAudioRef.current.src;
        const currentTime = karaokeAudioRef.current.currentTime;
        karaokeAudioRef.current.load(); // This disconnects any existing MediaElementSource
        karaokeAudioRef.current.src = currentSrc;
        karaokeAudioRef.current.currentTime = currentTime;
      }
      
      // Get microphone stream with better error handling
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          } 
        });
      } catch (micError) {
        console.error('❌ Microphone access denied:', micError);
        if (micError instanceof Error) {
          if (micError.name === 'NotAllowedError') {
            toast.error('Microphone permission denied. Please allow microphone access and try again.');
          } else if (micError.name === 'NotFoundError') {
            toast.error('No microphone found. Please connect a microphone and try again.');
          } else {
            toast.error('Failed to access microphone. Please check your microphone settings.');
          }
        }
        return;
      }
      
      audioStreamRef.current = micStream;
      
      // Create audio context for mixing
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const mixedDestination = audioContext.createMediaStreamDestination();
      
      // Connect microphone with higher gain
      const micSource = audioContext.createMediaStreamSource(micStream);
      const micGain = audioContext.createGain();
      micGain.gain.value = 2.0; // Boost mic volume significantly
      micSource.connect(micGain);
      micGain.connect(mixedDestination);
      
      // Also connect mic to speakers for monitoring (optional)
      const monitorGain = audioContext.createGain();
      monitorGain.gain.value = 0.2; // Low volume for monitoring to avoid feedback
      micGain.connect(monitorGain);
      monitorGain.connect(audioContext.destination);
      
      console.log('🎤 Microphone connected to mixer');
      
      // Handle karaoke audio if available
      if (karaokeAudioRef.current && isKaraokeReady) {
        console.log('🎵 Setting up karaoke for mixing...');
        
        try {
          // Ensure karaoke has the correct source
          if (!karaokeAudioRef.current.src) {
            if (karaokeSource === 'upload' && karaokeFile) {
              karaokeAudioRef.current.src = URL.createObjectURL(karaokeFile);
            } else if (karaokeSource === 'database' && selectedDatabaseTrack) {
              const resolvedUrl = await resolvePlayableUrl(selectedDatabaseTrack.karaoke_file_url);
              if (resolvedUrl) {
                karaokeAudioRef.current.src = resolvedUrl;
              }
            } else if (karaokeSource === 'select' && selectedKaraokeTrack?.previewUrl) {
              karaokeAudioRef.current.src = selectedKaraokeTrack.previewUrl;
            }
          }
          
          // Only create source node if we don't have one already
          if (!karaokeSourceNodeRef.current) {
            karaokeSourceNodeRef.current = audioContext.createMediaElementSource(karaokeAudioRef.current);
          }
          
          // Create audio filter chain for karaoke
          const karaokeGain = audioContext.createGain();
          karaokeGain.gain.value = (karaokeVolume / 100) * 0.8; // Apply volume setting
          
          const bassFilter = audioContext.createBiquadFilter();
          bassFilter.type = 'lowshelf';
          bassFilter.frequency.value = 200;
          bassFilter.gain.value = karaokeBass;
          
          const trebleFilter = audioContext.createBiquadFilter();
          trebleFilter.type = 'highshelf';
          trebleFilter.frequency.value = 3000;
          trebleFilter.gain.value = karaokeTreble;
          
          // Connect the filter chain: source -> bass -> treble -> gain -> destination
          karaokeSourceNodeRef.current.connect(bassFilter);
          bassFilter.connect(trebleFilter);
          trebleFilter.connect(karaokeGain);
          karaokeGain.connect(mixedDestination);
          
          // Also connect to speakers for monitoring
          const speakerGain = audioContext.createGain();
          speakerGain.gain.value = 0.7; // Separate speaker volume control
          karaokeGain.connect(speakerGain);
          speakerGain.connect(audioContext.destination);
          
          // Store filter references for real-time updates
          gainNodeRef.current = karaokeGain;
          bassFilterRef.current = bassFilter;
          trebleFilterRef.current = trebleFilter;
          
          console.log('🎵 Karaoke connected to mixer and speakers');
          
          // Start karaoke playback
          karaokeAudioRef.current.currentTime = 0;
          
          try {
            await karaokeAudioRef.current.play();
            isKaraokePlayingRef.current = true;
            console.log('✅ Karaoke playing and mixing');
            toast.success('Recording started with karaoke mixing!');
          } catch (playError) {
            console.error('❌ Failed to play karaoke:', playError);
            toast.error('Karaoke failed to play, recording microphone only');
          }
        } catch (karaokeError) {
          console.error('❌ Failed to setup karaoke mixing:', karaokeError);
          toast.error('Karaoke mixing failed, recording microphone only');
        }
      } else {
        console.log('🎙️ Recording microphone only');
        toast.success('Recording started!');
      }
      
      // Create MediaRecorder with the mixed stream and better settings
      const mediaRecorder = new MediaRecorder(mixedDestination.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000 // Higher quality audio
      });
      
      console.log('🎤 Mixed stream tracks:', mixedDestination.stream.getAudioTracks().length);
      console.log('🎤 Mixed stream active:', mixedDestination.stream.active);
      
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        console.log('✅ Mixed recording stopped, blob created');
        
        // Clean up audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        karaokeSourceNodeRef.current = null;
      };
      
      // Start recording the mixed stream
      mediaRecorder.start();
      setIsRecording(true);
      console.log('✅ Mixed MediaRecorder started');
      
      // Start timer
      let startTime = Date.now();
      intervalRef.current = setInterval(() => {
        setRecordingTime(Date.now() - startTime);
      }, 100);
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      if (error instanceof Error) {
        toast.error(`Recording failed: ${error.message}`);
      } else {
        toast.error('Failed to start recording. Please try again.');
      }
    }
  };

  const stopRecording = () => {
    console.log('🛑 Stopping recording...');
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Stop karaoke
    if (karaokeAudioRef.current && isKaraokePlayingRef.current) {
      karaokeAudioRef.current.pause();
      isKaraokePlayingRef.current = false;
      console.log('🎵 Karaoke stopped');
    }
    
    // Clean up audio context and source nodes
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    karaokeSourceNodeRef.current = null;
    
    setIsRecording(false);
    setIsPaused(false);
    console.log('✅ Recording stopped completely');
    toast.success('Recording completed!');
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        if (karaokeAudioRef.current && isKaraokeReady) {
          karaokeAudioRef.current.play();
          isKaraokePlayingRef.current = true;
        }
        setIsPaused(false);
        toast.success('Recording resumed');
      } else {
        mediaRecorderRef.current.pause();
        if (karaokeAudioRef.current) {
          karaokeAudioRef.current.pause();
          isKaraokePlayingRef.current = false;
        }
        setIsPaused(true);
        toast.success('Recording paused');
      }
    }
  };

  // Test karaoke audio function
  const testKaraokeAudio = async () => {
    if (!karaokeAudioRef.current || !isKaraokeReady) {
      toast.error('No karaoke track selected');
      return;
    }

    console.log('🎵 Test: Playing karaoke directly');
    try {
      karaokeAudioRef.current.currentTime = 0;
      await karaokeAudioRef.current.play();
      setIsKaraokeTestPlaying(true);
      toast.success('Karaoke test playing!');
      
      // Add event listener to detect when audio ends
      const handleEnded = () => {
        setIsKaraokeTestPlaying(false);
        karaokeAudioRef.current?.removeEventListener('ended', handleEnded);
      };
      karaokeAudioRef.current.addEventListener('ended', handleEnded);
    } catch (error) {
      console.error('❌ Test karaoke failed:', error);
      toast.error('Failed to play karaoke test');
    }
  };

  // Stop karaoke test function
  const stopKaraokeTest = () => {
    if (karaokeAudioRef.current) {
      karaokeAudioRef.current.pause();
      karaokeAudioRef.current.currentTime = 0;
      setIsKaraokeTestPlaying(false);
      toast.success('Karaoke test stopped!');
      console.log('🛑 Karaoke test stopped');
    }
  };

  // Test Web Audio API function (keeping for debugging)
  const testWebAudio = () => {
    console.log('🔊 Testing Web Audio API with beep...');
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 440; // A4 note
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    toast.success('Web Audio API test beep played!');
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Clear/delete current recording
  const clearRecording = () => {
    // Clean up audio context and source nodes to prevent "already connected" error
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (karaokeSourceNodeRef.current) {
      karaokeSourceNodeRef.current = null;
    }
    
    // Reset karaoke audio element
    if (karaokeAudioRef.current) {
      karaokeAudioRef.current.pause();
      karaokeAudioRef.current.currentTime = 0;
      const currentSrc = karaokeAudioRef.current.src;
      karaokeAudioRef.current.load(); // This disconnects any existing MediaElementSource
      karaokeAudioRef.current.src = currentSrc; // Restore the source
    }
    
    setAudioBlob(null);
    setRecordingTime(0);
    setPerformanceTitle('');
    setPerformanceDescription('');
    setUploadProgress(0);
    toast.success('Recording cleared');
  };

  // Download current recording
  const downloadRecording = () => {
    if (!audioBlob) {
      toast.error('No recording to download');
      return;
    }

    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${performanceTitle || 'recording'}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Recording downloaded successfully!');
  };

  // Start new recording (re-record)
  const startNewRecording = () => {
    clearRecording();
    startRecording();
  };

  const uploadRecording = async () => {
    if (!audioBlob || !user) {
      toast.error('No recording to upload or user not authenticated');
      return;
    }

    if (!performanceTitle.trim()) {
      toast.error('Please enter a performance title');
      return;
    }

    setUploadProgress(0);
    
    try {
      let finalBlob = audioBlob;
      let fileExtension = 'webm';
      let contentType = 'audio/webm';

      // Try to convert to MP3 if FFmpeg is ready, otherwise use webm
      if (ffmpeg && ffmpegReady) {
        try {
          console.log('🔄 Converting webm to mp3...');
          finalBlob = await convertWebmToMp3(audioBlob);
          fileExtension = 'mp3';
          contentType = 'audio/mp3';
          console.log('✅ Converted to MP3 successfully');
        } catch (conversionError) {
          console.warn('⚠️ MP3 conversion failed, uploading as webm:', conversionError);
          // Keep using webm format as fallback
        }
      } else {
        console.log('⚠️ FFmpeg not ready, uploading as webm');
      }
      
      const fileName = `${Date.now()}_${performanceTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${fileExtension}`;
      const filePath = `${user.id}/recorded/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-uploads')
        .upload(filePath, finalBlob, {
          contentType: contentType,
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload recording');
        return;
      }

      setUploadProgress(50);

      const { data: urlData } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(filePath);

      // Determine karaoke source information
      let originalSingerName = 'Unknown Artist';
      let originalSongUrl = null;
      let originalFileType = null;

      if (selectedDatabaseTrack) {
        originalSingerName = selectedDatabaseTrack.original_singer_name;
        originalSongUrl = selectedDatabaseTrack.karaoke_file_url;
        originalFileType = selectedDatabaseTrack.file_type;
      } else if (selectedKaraokeTrack) {
        originalSingerName = selectedKaraokeTrack.artist;
        originalSongUrl = selectedKaraokeTrack.previewUrl;
        originalFileType = 'mp3';
      } else if (selectedSong) {
        originalSingerName = selectedSong.artist;
        originalSongUrl = selectedSong.previewUrl;
        originalFileType = 'mp3';
      }

      const { data: insertData, error: insertError } = await supabase
        .from('uploaded_songs')
        .insert({
          singer_id: user.id,
          song_title: performanceTitle,
          original_singer_name: originalSingerName,
          recorded_song_url: urlData.publicUrl,
          original_song_url: originalSongUrl,
          recorded_file_type: fileExtension,
          original_file_type: originalFileType
        });

      if (insertError) {
        console.error('Database insert error:', insertError);
        toast.error('Failed to save recording information');
        return;
      }

      setUploadProgress(100);
      toast.success('Recording uploaded successfully!');
      
      // Reset form
      setAudioBlob(null);
      setPerformanceTitle('');
      setPerformanceDescription('');
      setRecordingTime(0);
      setUploadProgress(0);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload recording');
    }
  };

  const uploadSongs = async () => {
    if (!recordedFile || !songTitle || !originalSingerName || !user) {
      toast.error('Please fill in all required fields and select files');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const timestamp = Date.now();
      const sanitizedTitle = songTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      
      // Upload recorded file
      const recordedFileName = `${timestamp}_${sanitizedTitle}.${recordedFileType}`;
      const recordedFilePath = `${user.id}/recorded/${recordedFileName}`;
      
      const { error: recordedUploadError } = await supabase.storage
        .from('audio-uploads')
        .upload(recordedFilePath, recordedFile);

      if (recordedUploadError) {
        throw new Error('Failed to upload recorded file');
      }

      setUploadProgress(30);

      // Upload original file (if provided)
      let originalFileUrl = null;
      if (originalFile) {
        const originalFileName = `${timestamp}_${sanitizedTitle}-original.${originalFileType}`;
        const originalFilePath = `${user.id}/original/${originalFileName}`;
        
        const { error: originalUploadError } = await supabase.storage
          .from('audio-uploads')
          .upload(originalFilePath, originalFile);

        if (originalUploadError) {
          throw new Error('Failed to upload original file');
        }

        const { data: originalUrlData } = supabase.storage
          .from('audio-uploads')
          .getPublicUrl(originalFilePath);
        
        originalFileUrl = originalUrlData.publicUrl;
      }

      setUploadProgress(60);

      // Get public URLs
      const { data: recordedUrlData } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(recordedFilePath);

      // Insert into database
      const { error: insertError } = await supabase
        .from('uploaded_songs')
        .insert({
          singer_id: user.id,
          song_title: songTitle,
          original_singer_name: originalSingerName,
          recorded_song_url: recordedUrlData.publicUrl,
          original_song_url: originalFileUrl,
          recorded_file_type: recordedFileType,
          original_file_type: originalFileType
        });

      if (insertError) {
        throw new Error('Failed to save song information');
      }

      setUploadProgress(100);
      toast.success('Songs uploaded successfully!');
      
      // Reset form
      setSongTitle('');
      setOriginalSingerName('');
      setRecordedFile(null);
      setOriginalFile(null);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload songs');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const uploadKaraokeTrack = async () => {
    if (!karaokeFile || !karaokeSongTitle || !karaokeOriginalSinger || !user) {
      toast.error('Please fill in all fields and select a karaoke file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const timestamp = Date.now();
      const sanitizedTitle = karaokeSongTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      
      // Upload karaoke file
      const karaokeFileName = `${timestamp}_${sanitizedTitle}-karaoke.mp3`;
      const karaokeFilePath = `${user.id}/karaoke/${karaokeFileName}`;
      
      const { error: karaokeUploadError } = await supabase.storage
        .from('audio-uploads')
        .upload(karaokeFilePath, karaokeFile);

      if (karaokeUploadError) {
        throw new Error('Failed to upload karaoke file');
      }

      setUploadProgress(30);

      // Upload original song file if provided
      let originalSongUrl = null;
      if (karaokeOriginalFile) {
        const originalFileName = `${timestamp}_${sanitizedTitle}-original.mp3`;
        const originalFilePath = `${user.id}/original/${originalFileName}`;
        
        const { error: originalUploadError } = await supabase.storage
          .from('audio-uploads')
          .upload(originalFilePath, karaokeOriginalFile);

        if (originalUploadError) {
          throw new Error('Failed to upload original song file');
        }

        const { data: originalUrlData } = supabase.storage
          .from('audio-uploads')
          .getPublicUrl(originalFilePath);
        
        originalSongUrl = originalUrlData.publicUrl;
      }

      setUploadProgress(70);

      const { data: karaokeUrlData } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(karaokeFilePath);

      const { error: insertError } = await supabase
        .from('karaoke_tracks')
        .insert({
          uploader_id: user.id,
          song_title: karaokeSongTitle,
          original_singer_name: karaokeOriginalSinger,
          karaoke_file_url: karaokeUrlData.publicUrl,
          original_song_url: originalSongUrl,
          file_type: 'mp3'
        });

      if (insertError) {
        throw new Error('Failed to save karaoke track information');
      }

      setUploadProgress(100);
      toast.success('Karaoke track uploaded successfully!');
      
      // Reset form and reload tracks
      setKaraokeSongTitle('');
      setKaraokeOriginalSinger('');
      setKaraokeFile(null);
      setKaraokeOriginalFile(null);
      setShowUploadOption(false);
      
      // Reload karaoke tracks
      const { data } = await supabase
        .from('karaoke_tracks')
        .select('*, original_song_url')
        .order('created_at', { ascending: false });
      setDatabaseKaraokeTracks(data || []);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload karaoke track');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
        
        // Setup karaoke audio element
        if (karaokeAudioRef.current) {
          karaokeAudioRef.current.src = URL.createObjectURL(file);
        }
        
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
    
    // Setup karaoke audio element
    if (karaokeAudioRef.current && song.previewUrl) {
      karaokeAudioRef.current.src = song.previewUrl;
    }
    
    toast.success('Karaoke track selected!');
  };

  // Clear karaoke selection
  const clearKaraokeSelection = () => {
    setKaraokeFile(null);
    setKaraokeOriginalFile(null);
    setSelectedKaraokeTrack(null);
    setSelectedDatabaseTrack(null);
    setKaraokeSource(null);
    setIsKaraokeReady(false);
    setKaraokeSongTitle('');
    setKaraokeOriginalSinger('');
    setShowUploadOption(false);
    
    if (karaokeAudioRef.current) {
      karaokeAudioRef.current.src = '';
    }
  };

  // Clear all upload controls and reset form
  const clearUploadControls = () => {
    // Clear upload form fields
    setSongTitle('');
    setOriginalSingerName('');
    setRecordedFile(null);
    setOriginalFile(null);
    setRecordedFileType('mp3');
    setOriginalFileType('mp3');
    setUploadProgress(0);
    
    // Clear karaoke selection
    clearKaraokeSelection();
    
    // Reset file inputs
    const recordedInput = document.getElementById('recorded-file') as HTMLInputElement;
    const originalInput = document.getElementById('original-file') as HTMLInputElement;
    if (recordedInput) recordedInput.value = '';
    if (originalInput) originalInput.value = '';
    
    toast.success('Upload form cleared');
  };

  // Handle recorded file change
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

  // Handle original file change
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
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
          <Music className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Record Song</h1>
          <p className="text-muted-foreground">Record performances with or without karaoke tracks</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="record" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Recording Studio
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Song Search
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Songs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Karaoke Track Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  Karaoke Track (Optional)
                </CardTitle>
                <CardDescription>
                  Select a karaoke track to sing along with
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Database Tracks */}
                <div className="space-y-3">
                  <Label>Search Karaoke Library</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search songs or artists..."
                      value={karaokeSearchTerm}
                      onChange={(e) => setKaraokeSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  
                  {filteredKaraokeTracks.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                      {filteredKaraokeTracks.map((track) => (
                        <div
                          key={track.id}
                          className={`p-3 rounded border cursor-pointer transition-colors ${
                            selectedDatabaseTrack?.id === track.id
                              ? 'bg-primary/10 border-primary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => selectDatabaseKaraokeTrack(track)}
                        >
                          <div className="font-medium">{track.song_title}</div>
                          <div className="text-sm text-muted-foreground">
                            by {track.original_singer_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload New Karaoke Track */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Or Upload New Karaoke Track</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUploadOption(!showUploadOption)}
                    >
                      {showUploadOption ? 'Cancel' : 'Upload New'}
                    </Button>
                  </div>
                  
                  {showUploadOption && (
                     <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                      <div className="grid gap-3">
                        <div>
                          <Label htmlFor="karaoke-title">Song Title</Label>
                          <Input
                            id="karaoke-title"
                            value={karaokeSongTitle}
                            onChange={(e) => setKaraokeSongTitle(e.target.value)}
                            placeholder="Enter song title"
                          />
                        </div>
                        <div>
                          <Label htmlFor="karaoke-singer">Original Singer</Label>
                          <Input
                            id="karaoke-singer"
                            value={karaokeOriginalSinger}
                            onChange={(e) => setKaraokeOriginalSinger(e.target.value)}
                            placeholder="Enter original singer name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="karaoke-file">Karaoke File (MP3) *</Label>
                          <Input
                            id="karaoke-file"
                            type="file"
                            accept="audio/mp3,audio/mpeg"
                            onChange={handleKaraokeFileChange}
                          />
                        </div>
                        <div>
                          <Label htmlFor="karaoke-original-file">Original Song File (MP3) - Optional</Label>
                          <Input
                            id="karaoke-original-file"
                            type="file"
                            accept="audio/mp3,audio/mpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setKaraokeOriginalFile(file);
                                toast.success('Original song file added');
                              }
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Upload the original song with vocals for reference
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={uploadKaraokeTrack}
                        disabled={isUploading || !karaokeFile || !karaokeSongTitle || !karaokeOriginalSinger}
                        className="w-full"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading... {uploadProgress}%
                          </>
                        ) : (
                          'Upload Karaoke Track'
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Karaoke Status */}
                {isKaraokeReady && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">Karaoke track ready</span>
                    </div>
                    
                    {/* Test Karaoke Button */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={isKaraokeTestPlaying ? stopKaraokeTest : testKaraokeAudio}
                        className="flex items-center gap-2"
                      >
                        <Volume2 className="h-4 w-4" />
                        {isKaraokeTestPlaying ? 'Stop Karaoke Test' : 'Test Karaoke Audio'}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={testWebAudio}
                        className="flex items-center gap-2"
                      >
                        <Volume2 className="h-4 w-4" />
                        Test Web Audio API
                      </Button>
                    </div>

                    {/* Original Song Player */}
                    {((selectedDatabaseTrack?.original_song_url) || karaokeOriginalFile) && (
                      <div className="space-y-2 pt-3 border-t">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <FileAudio className="h-4 w-4" />
                          Original Song
                        </Label>
                        <OriginalSongPlayer 
                          originalSongUrl={selectedDatabaseTrack?.original_song_url}
                          karaokeOriginalFile={karaokeOriginalFile}
                        />
                        <p className="text-xs text-muted-foreground">
                          Listen to the original song for reference
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recording Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Recording Controls
                </CardTitle>
                <CardDescription>
                  Record your performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Audio Controls for Karaoke Track */}
                {isKaraokeReady && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      Karaoke Audio Settings
                    </h4>
                    
                    {/* Volume Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Volume</Label>
                        <span className="text-sm text-muted-foreground">{karaokeVolume}%</span>
                      </div>
                      <Slider
                        value={[karaokeVolume]}
                        onValueChange={(value) => setKaraokeVolume(value[0])}
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Bass Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Bass</Label>
                        <span className="text-sm text-muted-foreground">{karaokeBass > 0 ? '+' : ''}{karaokeBass}dB</span>
                      </div>
                      <Slider
                        value={[karaokeBass]}
                        onValueChange={(value) => setKaraokeBass(value[0])}
                        max={12}
                        min={-12}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Treble Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Treble</Label>
                        <span className="text-sm text-muted-foreground">{karaokeTreble > 0 ? '+' : ''}{karaokeTreble}dB</span>
                      </div>
                      <Slider
                        value={[karaokeTreble]}
                        onValueChange={(value) => setKaraokeTreble(value[0])}
                        max={12}
                        min={-12}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <div className="text-4xl font-mono font-bold text-primary mb-4">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="flex justify-center gap-2">
                    {!isRecording ? (
                      <Button
                        onClick={startRecording}
                        className="bg-red-500 hover:bg-red-600 text-white px-8"
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        {isKaraokeReady ? 'Start Recording with Karaoke' : 'Start Recording'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={pauseRecording}
                          variant="outline"
                        >
                          {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                          {isPaused ? 'Resume' : 'Pause'}
                        </Button>
                        <Button
                          onClick={stopRecording}
                          className="bg-gray-500 hover:bg-gray-600 text-white"
                        >
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {audioBlob && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Recording Ready</h4>
                      <div className="flex gap-2">
                        <Button
                          onClick={downloadRecording}
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                        <Button
                          onClick={startNewRecording}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        >
                          <RotateCcw className="mr-1 h-4 w-4" />
                          Re-record
                        </Button>
                        <Button
                          onClick={clearRecording}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    <audio
                      controls
                      src={URL.createObjectURL(audioBlob)}
                      className="w-full"
                    />
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="performance-title">Performance Title *</Label>
                        <Input
                          id="performance-title"
                          value={performanceTitle}
                          onChange={(e) => setPerformanceTitle(e.target.value)}
                          placeholder="Enter performance title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="performance-description">Description (Optional)</Label>
                        <Textarea
                          id="performance-description"
                          value={performanceDescription}
                          onChange={(e) => setPerformanceDescription(e.target.value)}
                          placeholder="Add notes about your performance"
                          rows={3}
                        />
                      </div>
                      
                      {uploadProgress > 0 && (
                        <Progress value={uploadProgress} className="w-full" />
                      )}
                      
                      <Button
                        onClick={uploadRecording}
                        disabled={!performanceTitle.trim() || uploadProgress > 0}
                        className="w-full"
                      >
                        {uploadProgress > 0 ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading... {uploadProgress}%
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Recording
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Song Search
              </CardTitle>
              <CardDescription>
                Search for songs to record
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="singer-name">Singer/Artist Name *</Label>
                  <Input
                    id="singer-name"
                    value={singerName}
                    onChange={(e) => setSingerName(e.target.value)}
                    placeholder="e.g., Taylor Swift, Ed Sheeran"
                  />
                </div>
                <div>
                  <Label htmlFor="song-words">Song Title/Keywords (Optional)</Label>
                  <Input
                    id="song-words"
                    value={songWords}
                    onChange={(e) => setSongWords(e.target.value)}
                    placeholder="e.g., Love Story, Perfect"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {isSearching ? 'Searching...' : `${searchTotal} results found`}
                </div>
                <Button variant="outline" size="sm" onClick={clearSearch}>
                  <X className="mr-2 h-4 w-4" />
                  Clear Search
                </Button>
              </div>

              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {songs.map((song) => (
                  <Card
                    key={song.id}
                    className={`cursor-pointer transition-colors ${
                      selectedSong?.id === song.id
                        ? 'ring-2 ring-primary'
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => setSelectedSong(song)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h3 className="font-semibold line-clamp-1">{song.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{song.artist}</p>
                        {song.album && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{song.album}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={getDifficultyColor(song.difficulty)}
                          >
                            {song.difficulty}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{song.duration}</span>
                        </div>
                        {song.previewUrl && (
                          <audio
                            controls
                            className="w-full h-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <source src={song.previewUrl} type="audio/mpeg" />
                          </audio>
                        )}
                        {song.spotifyUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(song.spotifyUrl, '_blank');
                            }}
                          >
                            <ExternalLink className="mr-2 h-3 w-3" />
                            Open in Spotify
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Songs
              </CardTitle>
              <CardDescription>
                Upload your recorded and original songs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileAudio className="h-4 w-4" />
                  Upload your recorded and original songs
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearUploadControls}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Upload
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="song-title">Song Title *</Label>
                  <Input
                    id="song-title"
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                    placeholder="Enter song title"
                  />
                </div>
                <div>
                  <Label htmlFor="original-singer">Original Singer *</Label>
                  <Input
                    id="original-singer"
                    value={originalSingerName}
                    onChange={(e) => setOriginalSingerName(e.target.value)}
                    placeholder="Enter original singer name"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <FileAudio className="h-4 w-4" />
                    Recorded Version *
                  </h3>
                  <div>
                    <Label htmlFor="recorded-file">Upload Recorded File</Label>
                    <Input
                      id="recorded-file"
                      type="file"
                      accept="audio/*"
                      onChange={handleRecordedFileChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="recorded-file-type">File Type</Label>
                    <Select
                      value={recordedFileType}
                      onValueChange={(value: 'wav' | 'mp3') => setRecordedFileType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp3">MP3</SelectItem>
                        <SelectItem value="wav">WAV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    Original Version (Optional)
                  </h3>
                  <div>
                    <Label htmlFor="original-file">Upload Original File</Label>
                    <Input
                      id="original-file"
                      type="file"
                      accept="audio/*"
                      onChange={handleOriginalFileChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="original-file-type">File Type</Label>
                    <Select
                      value={originalFileType}
                      onValueChange={(value: 'wav' | 'mp3') => setOriginalFileType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp3">MP3</SelectItem>
                        <SelectItem value="wav">WAV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {uploadProgress > 0 && (
                <Progress value={uploadProgress} className="w-full" />
              )}

              <Button
                onClick={uploadSongs}
                disabled={isUploading || !recordedFile || !songTitle || !originalSingerName}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Songs
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecordSong;

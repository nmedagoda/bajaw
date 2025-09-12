-- Create karaoke_tracks table for karaoke track uploads
CREATE TABLE public.karaoke_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id UUID NOT NULL,
  song_title TEXT NOT NULL,
  original_singer_name TEXT NOT NULL,
  karaoke_file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('wav', 'mp3')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.karaoke_tracks ENABLE ROW LEVEL SECURITY;

-- Create policies for karaoke_tracks
CREATE POLICY "Anyone can view karaoke tracks" 
ON public.karaoke_tracks 
FOR SELECT 
USING (true);

CREATE POLICY "Singers can upload karaoke tracks" 
ON public.karaoke_tracks 
FOR INSERT 
WITH CHECK (auth.uid() = uploader_id AND has_role(auth.uid(), 'singer'::user_role));

CREATE POLICY "Users can update their own karaoke tracks" 
ON public.karaoke_tracks 
FOR UPDATE 
USING (auth.uid() = uploader_id);

CREATE POLICY "Users can delete their own karaoke tracks" 
ON public.karaoke_tracks 
FOR DELETE 
USING (auth.uid() = uploader_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_karaoke_tracks_updated_at
BEFORE UPDATE ON public.karaoke_tracks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_karaoke_tracks_uploader_id ON public.karaoke_tracks(uploader_id);
CREATE INDEX idx_karaoke_tracks_search ON public.karaoke_tracks(song_title, original_singer_name);
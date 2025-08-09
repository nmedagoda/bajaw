
-- Create a table for uploaded songs
CREATE TABLE public.uploaded_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singer_id UUID REFERENCES auth.users NOT NULL,
  song_title TEXT NOT NULL,
  original_singer_name TEXT NOT NULL,
  recorded_song_url TEXT,
  original_song_url TEXT,
  recorded_file_type TEXT CHECK (recorded_file_type IN ('wav', 'mp3')),
  original_file_type TEXT CHECK (original_file_type IN ('wav', 'mp3')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.uploaded_songs ENABLE ROW LEVEL SECURITY;

-- Create policies for uploaded_songs
CREATE POLICY "Singers can view their own uploaded songs" 
  ON public.uploaded_songs 
  FOR SELECT 
  USING (auth.uid() = singer_id);

CREATE POLICY "Singers can create their own uploaded songs" 
  ON public.uploaded_songs 
  FOR INSERT 
  WITH CHECK (auth.uid() = singer_id);

CREATE POLICY "Singers can update their own uploaded songs" 
  ON public.uploaded_songs 
  FOR UPDATE 
  USING (auth.uid() = singer_id);

-- Create trigger for updated_at
CREATE TRIGGER update_uploaded_songs_updated_at
  BEFORE UPDATE ON public.uploaded_songs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create audio-uploads bucket for storing audio files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio-uploads', 'audio-uploads', false);

-- Create RLS policies for the audio-uploads bucket
CREATE POLICY "Authenticated users can upload audio files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-uploads');

CREATE POLICY "Users can view their own audio files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own audio files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own audio files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

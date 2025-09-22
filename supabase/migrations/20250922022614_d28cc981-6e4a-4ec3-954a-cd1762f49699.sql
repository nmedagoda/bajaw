-- Create the audio-uploads bucket for storing karaoke tracks and recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-uploads', 'audio-uploads', true);

-- Create storage policies for the audio-uploads bucket
-- Allow public access to view files
CREATE POLICY "Public access for audio files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audio-uploads');

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload to their own folder" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'audio-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'audio-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'audio-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
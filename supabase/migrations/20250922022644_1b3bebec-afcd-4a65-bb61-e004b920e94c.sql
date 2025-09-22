-- Update the audio-uploads bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'audio-uploads';
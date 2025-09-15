-- Update check constraints to allow webm file type for recordings
ALTER TABLE uploaded_songs 
DROP CONSTRAINT uploaded_songs_recorded_file_type_check;

ALTER TABLE uploaded_songs 
ADD CONSTRAINT uploaded_songs_recorded_file_type_check 
CHECK (recorded_file_type = ANY (ARRAY['wav'::text, 'mp3'::text, 'webm'::text]));
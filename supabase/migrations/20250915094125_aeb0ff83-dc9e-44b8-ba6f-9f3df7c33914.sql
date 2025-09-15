-- Remove columns from performances table that should be in uploaded_songs
ALTER TABLE public.performances 
DROP COLUMN IF EXISTS original_singer_name,
DROP COLUMN IF EXISTS original_song_url,
DROP COLUMN IF EXISTS recorded_file_type,
DROP COLUMN IF EXISTS original_file_type;
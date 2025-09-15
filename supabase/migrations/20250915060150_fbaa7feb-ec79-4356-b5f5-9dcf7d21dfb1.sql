-- Add missing columns to performances table for original song metadata
ALTER TABLE public.performances 
ADD COLUMN original_singer_name TEXT,
ADD COLUMN original_song_url TEXT,
ADD COLUMN recorded_file_type TEXT,
ADD COLUMN original_file_type TEXT;
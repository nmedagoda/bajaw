-- Add original_song_url column to karaoke_tracks table
ALTER TABLE public.karaoke_tracks 
ADD COLUMN original_song_url TEXT;
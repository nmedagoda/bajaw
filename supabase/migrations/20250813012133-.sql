-- Add FK from uploaded_songs.singer_id to profiles.id for PostgREST embedding
DO $$ BEGIN
  ALTER TABLE public.uploaded_songs
    ADD CONSTRAINT uploaded_songs_singer_id_fkey
    FOREIGN KEY (singer_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Ensure anyone can view uploaded songs for Watch & Vote listing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'uploaded_songs'
      AND policyname = 'Anyone can view uploaded songs'
  ) THEN
    CREATE POLICY "Anyone can view uploaded songs"
    ON public.uploaded_songs
    FOR SELECT
    USING (true);
  END IF;
END $$;
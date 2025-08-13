-- Ensure FK so PostgREST embedding works: uploaded_songs.singer_id -> profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uploaded_songs_singer_id_fkey'
  ) THEN
    ALTER TABLE public.uploaded_songs
      ADD CONSTRAINT uploaded_songs_singer_id_fkey
      FOREIGN KEY (singer_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Normalize SELECT policies so anyone can list uploaded songs
-- Drop restrictive/self-view policies that could block audience listing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'uploaded_songs'
      AND policyname = 'Singers can view their own uploaded songs'
  ) THEN
    DROP POLICY "Singers can view their own uploaded songs" ON public.uploaded_songs;
  END IF;

  -- Replace any existing public policy to be permissive true
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'uploaded_songs'
      AND policyname = 'Anyone can view uploaded songs'
  ) THEN
    DROP POLICY "Anyone can view uploaded songs" ON public.uploaded_songs;
  END IF;

  CREATE POLICY "Anyone can view uploaded songs"
  ON public.uploaded_songs
  FOR SELECT
  TO public
  USING (true);
END $$;
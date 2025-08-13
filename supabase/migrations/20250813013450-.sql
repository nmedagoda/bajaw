-- Fix incorrect FK: uploaded_songs.singer_id currently references auth.users
-- We want it to reference public.profiles(id) so PostgREST can embed profiles
DO $$
DECLARE
  ref_table text;
BEGIN
  SELECT pc.confrelid::regclass::text INTO ref_table
  FROM pg_constraint pc
  WHERE pc.conrelid = 'public.uploaded_songs'::regclass
    AND pc.conname = 'uploaded_songs_singer_id_fkey'
    AND pc.contype = 'f';

  IF ref_table IS NOT NULL AND ref_table = 'auth.users' THEN
    ALTER TABLE public.uploaded_songs
      DROP CONSTRAINT uploaded_songs_singer_id_fkey;
  END IF;
END $$;

-- Now ensure FK exists to public.profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.uploaded_songs'::regclass
      AND conname = 'uploaded_songs_singer_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.uploaded_songs
      ADD CONSTRAINT uploaded_songs_singer_id_profiles_fkey
      FOREIGN KEY (singer_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Optional: keep permissive SELECT policy for listing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'uploaded_songs'
      AND policyname = 'Anyone can view uploaded songs'
  ) THEN
    CREATE POLICY "Anyone can view uploaded songs"
    ON public.uploaded_songs
    FOR SELECT
    USING (true);
  END IF;
END $$;
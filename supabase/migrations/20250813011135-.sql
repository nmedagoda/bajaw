-- Add a foreign key from uploaded_songs.singer_id -> profiles.id to enable PostgREST embeddings
DO $$ BEGIN
  ALTER TABLE public.uploaded_songs
    ADD CONSTRAINT uploaded_songs_singer_id_fkey
    FOREIGN KEY (singer_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists
  NULL;
END $$;

-- Relax profiles SELECT policy to allow displaying singer names and avatars publicly
-- Create permissive policy for SELECT on profiles if not exists
DO $$ BEGIN
  -- Check if a policy with this name already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles
    FOR SELECT
    USING (true);
  END IF;
END $$;

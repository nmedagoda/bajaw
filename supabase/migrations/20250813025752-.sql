-- Align votes.performance_id to uploaded_songs(id)
-- 1) Drop existing FK to performances (if any)
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_performance_id_fkey;

-- 2) Add new FK to uploaded_songs
ALTER TABLE public.votes
  ADD CONSTRAINT votes_performance_id_fkey
  FOREIGN KEY (performance_id)
  REFERENCES public.uploaded_songs(id)
  ON DELETE CASCADE;

-- 3) Helpful index for lookups
CREATE INDEX IF NOT EXISTS idx_votes_performance_id ON public.votes(performance_id);

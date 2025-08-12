-- Add category-specific scores while keeping existing `score` for compatibility
ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS voice_score integer,
  ADD COLUMN IF NOT EXISTS overall_score integer;

-- Ensure scores are within 1..10 when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'votes_voice_score_range'
  ) THEN
    ALTER TABLE public.votes
      ADD CONSTRAINT votes_voice_score_range CHECK (voice_score IS NULL OR (voice_score >= 1 AND voice_score <= 10));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'votes_overall_score_range'
  ) THEN
    ALTER TABLE public.votes
      ADD CONSTRAINT votes_overall_score_range CHECK (overall_score IS NULL OR (overall_score >= 1 AND overall_score <= 10));
  END IF;
END$$;

-- Auto-calculate the legacy `score` as the average of the two categories when both are present
CREATE OR REPLACE FUNCTION public.set_votes_score()
RETURNS trigger AS $$
BEGIN
  IF NEW.voice_score IS NOT NULL AND NEW.overall_score IS NOT NULL THEN
    NEW.score = ROUND(((NEW.voice_score + NEW.overall_score)::numeric) / 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_votes_score ON public.votes;
CREATE TRIGGER trg_set_votes_score
BEFORE INSERT OR UPDATE ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.set_votes_score();
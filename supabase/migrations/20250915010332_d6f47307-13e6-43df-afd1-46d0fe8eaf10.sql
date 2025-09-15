-- Fix critical security vulnerability: Restrict vote viewing to authorized users only
-- Drop the overly permissive policy that allows anyone to view all votes
DROP POLICY IF EXISTS "Users can view all votes" ON public.votes;

-- Create secure policies for vote viewing

-- 1. Judges can view all votes (for transparency in judging process)
CREATE POLICY "Judges can view all votes" 
ON public.votes 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'judge'::user_role));

-- 2. Singers can view votes on their own performances only
CREATE POLICY "Singers can view votes on their performances" 
ON public.votes 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'singer'::user_role) 
  AND EXISTS (
    SELECT 1 FROM public.performances p 
    WHERE p.id = votes.performance_id 
    AND p.singer_id = auth.uid()
  )
);

-- 3. Voters can view their own votes only
CREATE POLICY "Voters can view their own votes" 
ON public.votes 
FOR SELECT 
TO authenticated
USING (auth.uid() = voter_id);

-- Add comments for documentation
COMMENT ON POLICY "Judges can view all votes" ON public.votes IS 
'Allows judges to view all voting data for transparency and oversight';

COMMENT ON POLICY "Singers can view votes on their performances" ON public.votes IS 
'Allows singers to see feedback on their own performances only';

COMMENT ON POLICY "Voters can view their own votes" ON public.votes IS 
'Allows users to view their own voting history';
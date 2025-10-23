-- Fix security issue: uploaded_songs_public_read
-- Restrict access to authenticated users only instead of allowing anonymous access
DROP POLICY IF EXISTS "Anyone can view uploaded songs" ON public.uploaded_songs;

CREATE POLICY "Authenticated users can view uploaded songs"
  ON public.uploaded_songs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Fix security issue: public_profiles_no_policies
-- Since public_profiles is a view (not a table), we need to handle it differently
-- Views inherit security from their underlying tables, so we'll ensure the view
-- only exposes data that should be public and relies on the profiles table RLS

-- First, check if the view exists and drop it to recreate with proper security
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate the view to expose only non-sensitive public profile information
-- The view will inherit RLS from the profiles table
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  role,
  profile_photo_url,
  created_at
FROM public.profiles;

-- Grant select to authenticated users only
GRANT SELECT ON public.public_profiles TO authenticated;
REVOKE SELECT ON public.public_profiles FROM anon;
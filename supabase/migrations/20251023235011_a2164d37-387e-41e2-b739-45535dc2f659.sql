-- Fix SECURITY DEFINER view issue by explicitly setting SECURITY INVOKER
-- This ensures the view uses the querying user's permissions, not the creator's

-- Drop and recreate the view with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT 
  id,
  full_name,
  role,
  profile_photo_url,
  created_at
FROM public.profiles;

-- Maintain the same access grants
GRANT SELECT ON public.public_profiles TO authenticated;
REVOKE SELECT ON public.public_profiles FROM anon;
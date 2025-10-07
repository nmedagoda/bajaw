-- Fix Security Definer View Warning
-- Recreate the public_profiles view explicitly without SECURITY DEFINER
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  full_name,
  profile_photo_url,
  role,
  created_at
FROM public.profiles;

-- Grant read access to the public view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Add security documentation
COMMENT ON VIEW public.public_profiles IS 
'Public-safe view of profiles that only exposes non-PII fields (no email, phone, address). Uses SECURITY INVOKER to enforce RLS policies of the querying user rather than the view creator.';
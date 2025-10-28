-- Drop the existing public_profiles view
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate the public_profiles view with security definer to bypass RLS
CREATE VIEW public.public_profiles
WITH (security_invoker=false)
AS
SELECT 
  id,
  full_name,
  profile_photo_url,
  role,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
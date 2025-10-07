-- Phase 1: Fix Critical PII Exposure
-- Drop the overly permissive policy that exposes all user data
DROP POLICY IF EXISTS "Anyone can view public profile info" ON public.profiles;

-- Create a restricted view with only public-safe fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  profile_photo_url,
  role,
  created_at
FROM public.profiles;

-- Grant read access to the public view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Phase 2: Secure Role Management
-- Update the existing policy to prevent users from changing their role
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND role = (SELECT role FROM profiles WHERE id = auth.uid())
);

-- Add comment explaining the security measure
COMMENT ON POLICY "Users can update own profile" ON public.profiles IS 
'Allows users to update their own profile but prevents role changes to prevent privilege escalation';

-- Remove the now-unused get_public_profile function since we have the view
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);
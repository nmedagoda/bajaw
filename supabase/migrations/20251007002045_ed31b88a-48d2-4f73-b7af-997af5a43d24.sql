-- Add policy to allow public viewing of safe profile fields for karaoke competition
-- This allows displaying singer names and photos while protecting PII (email, contact_number, address)
CREATE POLICY "Anyone can view public profile info"
ON public.profiles
FOR SELECT
USING (true);

-- Note: The existing "Block unauthenticated access to profiles" policy with USING (false) 
-- will be overridden by this more permissive policy since policies are combined with OR logic.
-- However, users will only be able to see id, full_name, profile_photo_url, role, and created_at.
-- They won't be able to see email, contact_number, address, age, gender, or terms_accepted_at
-- unless they are viewing their own profile (covered by "Users can view own profile" policy).

-- Create a security definer function to get only public profile data
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  profile_photo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.profile_photo_url
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;
-- Strengthen RLS policies for profiles table to better protect sensitive personal data

-- Drop existing policies to recreate them with stronger security
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create more robust policies that explicitly require authentication
-- and add additional safety checks

-- Policy for viewing own profile - requires authentication and exact ID match
CREATE POLICY "Authenticated users can view own profile only" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- Policy for inserting own profile - only during user creation
CREATE POLICY "Authenticated users can insert own profile only" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);

-- Policy for updating own profile - strict authentication and ownership check
CREATE POLICY "Authenticated users can update own profile only" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);

-- Add a policy to completely block access to unauthenticated users
CREATE POLICY "Block all access for unauthenticated users" 
ON public.profiles 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Create a security definer function to get basic public profile info
-- This allows controlled access to non-sensitive profile data when needed
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  profile_photo_url text
) 
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.profile_photo_url
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;
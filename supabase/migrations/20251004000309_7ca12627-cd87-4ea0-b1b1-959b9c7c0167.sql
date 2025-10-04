-- Fix critical security issue: Block unauthenticated access to profiles table
-- This prevents anonymous users from accessing sensitive personal information

-- Drop existing policies to recreate them with proper security
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Explicitly block all unauthenticated access
CREATE POLICY "Block unauthenticated access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- Allow authenticated users to view only their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to update only their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to insert only their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Add similar protection for user_roles table
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Block unauthenticated access to user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false);

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
-- Fix RLS policies for profiles table to ensure proper security

-- Drop the problematic policy
DROP POLICY IF EXISTS "Block all access for unauthenticated users" ON public.profiles;

-- Drop existing policies to recreate them with proper restrictive approach
DROP POLICY IF EXISTS "Authenticated users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can insert own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update own profile only" ON public.profiles;

-- Create restrictive policies that only allow authenticated users to access their own data
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Explicitly deny all access to anonymous users
CREATE POLICY "Deny anonymous access"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
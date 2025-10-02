-- Fix RLS policy conflict on profiles table
-- Remove the overly restrictive "Deny anonymous access" policy that blocks all operations
-- The existing policies already properly restrict access to authenticated users viewing their own profiles

DROP POLICY IF EXISTS "Deny anonymous access" ON public.profiles;

-- The remaining policies ensure:
-- 1. Users can only view their own profile (auth.uid() = id)
-- 2. Users can only update their own profile (auth.uid() = id)
-- 3. Users can only insert their own profile (auth.uid() = id)
-- Anonymous users are automatically denied because auth.uid() will be NULL
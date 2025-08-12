-- Restrict public access to user emails by limiting profiles SELECT
-- 1) Drop overly-permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- 2) Create strict policy: users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

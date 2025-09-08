-- Remove the overly permissive policy that allows everyone to view all profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- The existing "Users can view own profile" policy will remain, ensuring users can only access their own data
-- If you need to display basic singer information publicly (like for performances), 
-- you should create a separate policy for specific use cases with limited field access

-- Optional: Create a policy for viewing only basic public info (uncomment if needed)
-- CREATE POLICY "Public basic profile info" ON public.profiles
-- FOR SELECT USING (true)
-- WITH CHECK (false); -- This would need to be implemented with a view or specific column access
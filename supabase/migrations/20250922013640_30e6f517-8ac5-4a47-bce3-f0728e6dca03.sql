-- Create missing profiles for users who don't have them
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  COALESCE((au.raw_user_meta_data->>'role')::public.user_role, 'audience'::public.user_role)
FROM auth.users au 
LEFT JOIN public.profiles p ON au.id = p.id 
WHERE p.id IS NULL;

-- Also ensure user_roles are created for these users
INSERT INTO public.user_roles (user_id, role)
SELECT 
  au.id,
  COALESCE((au.raw_user_meta_data->>'role')::public.user_role, 'audience'::public.user_role)
FROM auth.users au 
LEFT JOIN public.user_roles ur ON au.id = ur.user_id 
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
-- Insert admin role for the specified user
INSERT INTO public.user_roles (user_id, role)
SELECT 
  au.id,
  'admin'::public.user_role
FROM auth.users au
WHERE au.email = 'nmedagoda@yahoo.com'
ON CONFLICT (user_id, role) DO NOTHING;
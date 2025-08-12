-- Update handle_new_user to grant both 'singer' and 'audience' on signup when singer is chosen
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  initial_role public.user_role;
BEGIN
  initial_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'audience'::public.user_role);

  -- Ensure profile exists
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    initial_role
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert the initial role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, initial_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- If user signs up as singer, also grant audience role by default
  IF initial_role = 'singer'::public.user_role THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'audience'::public.user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists to run function on auth.users creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill: create missing profiles for existing users
INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'full_name', ''),
       coalesce((u.raw_user_meta_data->>'role')::public.user_role, 'audience'::public.user_role)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill: ensure each user has their initial role from metadata (default to audience)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
       coalesce((u.raw_user_meta_data->>'role')::public.user_role, 'audience'::public.user_role)
FROM auth.users u
LEFT JOIN public.user_roles ur
  ON ur.user_id = u.id
 AND ur.role = coalesce((u.raw_user_meta_data->>'role')::public.user_role, 'audience'::public.user_role)
WHERE ur.id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Backfill: if user signed up as singer, ensure they also have audience role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'audience'::public.user_role
FROM auth.users u
LEFT JOIN public.user_roles ur
  ON ur.user_id = u.id
 AND ur.role = 'audience'::public.user_role
WHERE ur.id IS NULL
  AND (u.raw_user_meta_data->>'role')::public.user_role = 'singer'::public.user_role
ON CONFLICT (user_id, role) DO NOTHING;
-- Add terms acceptance tracking to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone;

-- Update the handle_new_user function to initialize terms_accepted_at
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

  -- Ensure profile exists with terms acceptance timestamp
  INSERT INTO public.profiles (id, email, full_name, role, terms_accepted_at)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    initial_role,
    now()
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
-- Fix search path security for existing functions
CREATE OR REPLACE FUNCTION public.set_votes_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.voice_score IS NOT NULL AND NEW.overall_score IS NOT NULL THEN
    NEW.score = ROUND(((NEW.voice_score + NEW.overall_score)::numeric) / 2);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$function$;

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
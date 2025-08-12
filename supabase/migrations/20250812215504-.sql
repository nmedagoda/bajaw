-- 1) Create user_roles table for multi-role support
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Enable RLS on user_roles
alter table public.user_roles enable row level security;

-- Allow users to view their own roles
create policy if not exists "Users can view their own roles"
on public.user_roles for select
using (auth.uid() = user_id);

-- 2) Role helper function that bypasses RLS safely
create or replace function public.has_role(_user_id uuid, _role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

-- 3) Update policies to use has_role
-- Performances
drop policy if exists "Singers can create performances" on public.performances;
drop policy if exists "Singers can update own performances" on public.performances;

create policy "Singers can create performances"
on public.performances for insert
with check (public.has_role(auth.uid(), 'singer'::public.user_role));

create policy "Singers can update own performances"
on public.performances for update
using (
  singer_id = auth.uid()
  and public.has_role(auth.uid(), 'singer'::public.user_role)
);

-- Votes
drop policy if exists "Judges and audience can vote" on public.votes;

create policy "Judges and audience can vote"
on public.votes for insert
with check (
  auth.uid() = voter_id
  and (
    public.has_role(auth.uid(), 'judge'::public.user_role)
    or public.has_role(auth.uid(), 'audience'::public.user_role)
  )
);

-- Uploaded songs
drop policy if exists "Singers can create their own uploaded songs" on public.uploaded_songs;
drop policy if exists "Singers can update their own uploaded songs" on public.uploaded_songs;

create policy "Singers can create their own uploaded songs"
on public.uploaded_songs for insert
with check (
  auth.uid() = singer_id
  and public.has_role(auth.uid(), 'singer'::public.user_role)
);

create policy "Singers can update their own uploaded songs"
on public.uploaded_songs for update
using (
  auth.uid() = singer_id
  and public.has_role(auth.uid(), 'singer'::public.user_role)
);

-- 4) Backfill roles from profiles for existing users
insert into public.user_roles (user_id, role)
select id, role from public.profiles
on conflict (user_id, role) do nothing;

-- 5) Ensure new users also get a role row alongside profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  initial_role public.user_role;
begin
  initial_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'audience'::public.user_role);

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    initial_role
  );

  insert into public.user_roles (user_id, role)
  values (new.id, initial_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;
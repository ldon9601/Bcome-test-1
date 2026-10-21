-- Bcome initial schema.
-- Create the Supabase project in the Sydney region (ap-southeast-2) so student data stays in Australia.
-- Row Level Security is on for every table: students see their own data, careers advisers see
-- students at their school, and parents see their child's data only after consent is granted.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- People and schools
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null check (state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student','adviser','parent','admin')),
  display_name text,
  school_id uuid references public.schools (id) on delete set null,
  -- Year level and state only. We deliberately do not store date of birth.
  year_level smallint check (year_level between 7 and 12),
  state text check (state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Parent or guardian consent for a student under 18.
create table public.guardian_links (
  student_id uuid not null references public.profiles (id) on delete cascade,
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  consent_status text not null default 'pending' check (consent_status in ('pending','granted','withdrawn')),
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);

-- ---------------------------------------------------------------------------
-- Questionnaire, results and plans
-- ---------------------------------------------------------------------------

create table public.questionnaire_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  bank_id text not null,
  bank_version text not null,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress','complete')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.questionnaire_sessions (student_id, started_at desc);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.questionnaire_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  holland_code text not null,
  profile jsonb not null,
  -- Top matches with scores, reasons and cautions, as shown to the student.
  matches jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.results (student_id, created_at desc);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  plan jsonb not null,
  generated_by text not null check (generated_by in ('claude','template')),
  model text,
  data_source text,
  adviser_reviewed_by uuid references public.profiles (id),
  adviser_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.plans (student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Reference data (loaded from /data by `npm run db:seed-sql`)
-- ---------------------------------------------------------------------------

create table public.occupations (
  id text primary key,
  anzsco text not null,
  title text not null,
  riasec text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.occupation_outlook (
  anzsco text primary key,
  name text,
  growth5_pct numeric,
  growth10_pct numeric,
  employed_2025k numeric,
  source text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions for policies
-- ---------------------------------------------------------------------------

create or replace function public.current_role_is(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = r);
$$;

create or replace function public.is_adviser_for(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles a join profiles s on s.school_id = a.school_id
    where a.id = auth.uid() and a.role = 'adviser' and s.id = student and s.school_id is not null
  );
$$;

create or replace function public.is_guardian_of(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from guardian_links
    where guardian_id = auth.uid() and student_id = student and consent_status = 'granted'
  );
$$;

create or replace function public.can_view_student(student uuid) returns boolean
language sql stable as $$
  select auth.uid() = student or public.is_adviser_for(student) or public.is_guardian_of(student);
$$;

-- New sign-ups get a profile. Role comes from sign-up metadata; only 'student' or 'parent'
-- can self-select. Advisers and admins are promoted by an admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, display_name)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'parent' then 'parent' else 'student' end,
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.guardian_links enable row level security;
alter table public.questionnaire_sessions enable row level security;
alter table public.results enable row level security;
alter table public.plans enable row level security;
alter table public.occupations enable row level security;
alter table public.occupation_outlook enable row level security;

create policy "schools readable by signed-in users" on public.schools
  for select to authenticated using (true);

create policy "view own or permitted profiles" on public.profiles
  for select to authenticated using (public.can_view_student(id) or id = auth.uid());
-- Users may edit their own name, year and state, but not their role or school (column grants below).
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, year_level, state, updated_at) on public.profiles to authenticated;

create policy "see own guardian links" on public.guardian_links
  for select to authenticated using (student_id = auth.uid() or guardian_id = auth.uid());
-- Links are created only by the server (service role) when a student invites a parent,
-- so nobody can attach themselves to a student. The guardian then grants or withdraws consent.
create policy "guardians give or withdraw consent" on public.guardian_links
  for update to authenticated using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());
revoke update on public.guardian_links from authenticated;
grant update (consent_status, consented_at) on public.guardian_links to authenticated;

create policy "students manage own sessions" on public.questionnaire_sessions
  for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "advisers and guardians view sessions" on public.questionnaire_sessions
  for select to authenticated using (public.can_view_student(student_id));

-- Results and plans are written by the server (service role) after scoring, so students can't edit them.
create policy "view permitted results" on public.results
  for select to authenticated using (public.can_view_student(student_id));
create policy "view permitted plans" on public.plans
  for select to authenticated using (public.can_view_student(student_id));
create policy "advisers mark plans reviewed" on public.plans
  for update to authenticated using (public.is_adviser_for(student_id)) with check (public.is_adviser_for(student_id));
-- Advisers can only set the review fields, never change the plan itself.
revoke update on public.plans from authenticated;
grant update (adviser_reviewed_by, adviser_reviewed_at) on public.plans to authenticated;

create policy "reference data is public" on public.occupations for select using (true);
create policy "outlook data is public" on public.occupation_outlook for select using (true);

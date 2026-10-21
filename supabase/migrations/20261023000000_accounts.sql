-- Bcome accounts: school-registered student and careers adviser accounts, sessions, trusted
-- devices, one-time email codes, assessment history and an audit log.
--
-- Bcome now runs its own sign-in (username + password, email codes for new devices and for every
-- adviser sign-in) instead of Supabase Auth. Only the server talks to these tables, with the
-- service role key. The browser never queries them: RLS is on with no policies, and anon and
-- authenticated roles have no privileges at all (deny by default, ST4S A13).
--
-- This replaces the earlier pre-launch tables tied to Supabase Auth (profiles, guardian links,
-- questionnaire sessions, results, plans, match results, feedback). They held no production data.

drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.career_feedback, public.match_results, public.plans, public.results,
  public.questionnaire_sessions, public.guardian_links, public.profiles, public.schools cascade;
drop function if exists public.handle_new_user(), public.can_view_student(uuid), public.is_guardian_of(uuid),
  public.is_adviser_for(uuid), public.current_role_is(text);

-- ---------------------------------------------------------------------------
-- Schools
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 120),
  state text not null check (state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
  -- Domains students sign up with. Several schools can share a state system domain; the join code tells them apart.
  student_domains text[] not null check (cardinality(student_domains) between 1 and 5),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  -- New schools wait for a Bcome operator to confirm them (scripts/school-admin.ts).
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  -- AI-written plans are off until the school turns them on. Only de-identified scores are sent.
  allow_ai_plans boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- People. Only what the school and Bcome need: name, school email, username, school, and for
-- students their year level and month and year of birth. No full date of birth, address,
-- phone number, gender or other identifiers.
-- ---------------------------------------------------------------------------

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  role text not null check (role in ('student','adviser')),
  username text not null check (username = lower(username) and username ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'),
  email text not null check (email = lower(email) and length(email) <= 254 and position('@' in email) > 1),
  first_name text not null check (length(first_name) between 1 and 60),
  last_name text not null check (length(last_name) between 1 and 60),
  year_level smallint,
  birth_year smallint,
  birth_month smallint,
  -- scrypt (N=2^17, r=8, p=1), salted, with parameters stored in the hash (OWASP).
  password_hash text not null check (password_hash like 'scrypt$%'),
  email_verified_at timestamptz,
  failed_logins smallint not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint app_users_username_key unique (username),
  constraint app_users_email_key unique (email),
  constraint student_fields check (
    (role = 'student' and year_level is not null and birth_year is not null and birth_month is not null
       and year_level in (10, 11, 12) and birth_year between 1990 and 2030 and birth_month between 1 and 12)
    or (role = 'adviser' and year_level is null and birth_year is null and birth_month is null)
  )
);
create index on public.app_users (school_id, role);

-- ---------------------------------------------------------------------------
-- Sign-in state. Tokens are random 256-bit values; only their SHA-256 hashes are stored.
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  token_hash text not null unique,
  remember boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on public.sessions (user_id);

create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  token_hash text not null,
  label text not null check (length(label) <= 60),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (user_id, token_hash)
);

create table public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  purpose text not null check (purpose in ('verify_email','login','reset_password')),
  -- HMAC-SHA256 of the six-digit code with a server secret.
  code_hash text not null,
  token_hash text not null unique,
  attempts smallint not null default 0,
  sent_count smallint not null default 1,
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  remember boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.auth_challenges (user_id, purpose);

create table public.adviser_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  email text not null check (email = lower(email)),
  token_hash text not null unique,
  invited_by uuid references public.app_users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.adviser_invites (school_id);

-- ---------------------------------------------------------------------------
-- Assessment history: every completed Career Profile is kept on the student's account.
-- ---------------------------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  completed_at timestamptz not null default now(),
  instrument_version text not null,
  algorithm_version text not null,
  year_level smallint,
  holland_code text not null,
  top_osca text,
  top_title text,
  answers jsonb not null,
  profile jsonb not null,
  dna jsonb not null,
  matches jsonb not null,
  plan jsonb not null
);
create index on public.assessments (user_id, completed_at desc);
create index on public.assessments (school_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Audit log (ST4S L1): sign-ins, failures, lockouts, code checks, account and school changes.
-- No foreign keys, so entries survive account deletion. Kept for 400 days.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  event text not null,
  actor_id uuid,
  school_id uuid,
  target_id uuid,
  ip inet,
  detail jsonb not null default '{}'::jsonb
);
create index on public.audit_log (school_id, at desc);
create index on public.audit_log (actor_id, at desc);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);

-- Counts a hit in a fixed window and returns the count so far, atomically.
create or replace function public.rate_limit_hit(p_key text, p_window_ms integer) returns integer
language sql volatile set search_path = public as $$
  insert into rate_limits as r (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_ms / 1000.0) then now() else r.window_start end,
    count = case when r.window_start <= now() - make_interval(secs => p_window_ms / 1000.0) then 1 else r.count + 1 end
  returning count;
$$;

-- Removes expired sign-in state and old audit entries. Schedule daily with pg_cron:
--   select cron.schedule('bcome-purge', '17 3 * * *', 'select public.purge_expired()');
create or replace function public.purge_expired() returns void
language sql volatile set search_path = public as $$
  delete from sessions where expires_at < now();
  delete from trusted_devices where expires_at < now();
  delete from auth_challenges where expires_at < now() - interval '1 day';
  delete from adviser_invites where accepted_at is null and expires_at < now() - interval '30 days';
  delete from rate_limits where window_start < now() - interval '1 day';
  delete from audit_log where at < now() - interval '400 days';
$$;

-- ---------------------------------------------------------------------------
-- Deny by default: no policies, no privileges for browser roles.
-- ---------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.app_users enable row level security;
alter table public.sessions enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.auth_challenges enable row level security;
alter table public.adviser_invites enable row level security;
alter table public.assessments enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.schools, public.app_users, public.sessions, public.trusted_devices, public.auth_challenges,
  public.adviser_invites, public.assessments, public.audit_log, public.rate_limits from anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer), public.purge_expired() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer), public.purge_expired() to service_role;

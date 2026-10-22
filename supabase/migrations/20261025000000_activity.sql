-- Student activity after the Career Profile: the Skills Evidence Portfolio, Weekly Career
-- Missions, Real-World Action Cards and each school's opportunity calendar.
--
-- Like the account tables, only the server reads and writes these, with the service role key.
-- RLS is on with no policies and browser roles have no privileges (deny by default, ST4S A13).
-- Everything about a student is removed with their account (on delete cascade), and everything
-- about a school with the school.

-- ---------------------------------------------------------------------------
-- Skills Evidence Portfolio: what a student did at school, in sport, at work or volunteering.
-- Free text is length-limited; the form asks students not to include contact or health details.
-- ---------------------------------------------------------------------------

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  category text not null check (category in ('school','sport','work','volunteering','other')),
  title text not null check (length(title) between 2 and 120),
  organisation text check (length(organisation) <= 120),
  start_month text not null check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  end_month text check (end_month ~ '^\d{4}-(0[1-9]|1[0-2])$' and end_month >= start_month),
  description text not null check (length(description) between 10 and 1200),
  skills text[] not null default '{}' check (cardinality(skills) <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.evidence_items (user_id, start_month desc);
create index on public.evidence_items (school_id);

-- ---------------------------------------------------------------------------
-- Weekly Career Missions: one per student per week (ISO week in the school's time zone).
-- ---------------------------------------------------------------------------

create table public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  mission_id text not null,
  title text not null,
  career_osca text,
  career_title text,
  reflection text not null check (length(reflection) between 10 and 600),
  points smallint not null check (points between 0 and 500),
  completed_at timestamptz not null default now(),
  unique (user_id, week)
);
create index on public.mission_completions (school_id, week);

-- ---------------------------------------------------------------------------
-- Opportunity calendar: open days, work experience, competitions and more, created by the
-- school's careers advisers and shown to its students.
-- ---------------------------------------------------------------------------

create table public.school_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  created_by uuid references public.app_users (id) on delete set null,
  kind text not null check (kind in ('open_day','work_experience','competition','expo','talk','workshop','deadline','other')),
  title text not null check (length(title) between 3 and 120),
  starts_on date not null,
  ends_on date check (ends_on >= starts_on),
  time text check (length(time) <= 60),
  location text check (length(location) <= 160),
  url text check (url ~ '^https?://' and length(url) <= 500),
  description text not null default '' check (length(description) <= 1500),
  year_levels smallint[] not null default '{}' check (year_levels <@ array[10,11,12]::smallint[]),
  families text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.school_events (school_id, starts_on);

-- Students marking an event as "interested", so advisers know who to follow up.
create table public.event_responses (
  user_id uuid not null references public.app_users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  event_id uuid not null references public.school_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index on public.event_responses (school_id, event_id);

-- Action cards are generated from each student's results and the calendar; only whether a
-- student has done or dismissed a card is stored.
create table public.action_card_states (
  user_id uuid not null references public.app_users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  card_key text not null check (length(card_key) <= 120),
  status text not null check (status in ('done','dismissed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, card_key)
);

-- ---------------------------------------------------------------------------
-- Deny by default.
-- ---------------------------------------------------------------------------

alter table public.evidence_items enable row level security;
alter table public.mission_completions enable row level security;
alter table public.school_events enable row level security;
alter table public.event_responses enable row level security;
alter table public.action_card_states enable row level security;

revoke all on public.evidence_items, public.mission_completions, public.school_events, public.event_responses,
  public.action_card_states from public, anon, authenticated;

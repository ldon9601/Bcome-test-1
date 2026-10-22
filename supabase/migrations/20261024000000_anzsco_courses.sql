-- ANZSCO coding with Jobs and Skills Australia occupation profiles, and specific university and
-- TAFE courses (ATARs, prerequisites and TAFE entry requirements). Reference data only, loaded
-- from /data by `npm run db:seed-sql`. Readable by anyone, written only by the service role.

alter table public.occupations
  add column if not exists anzsco_title text,
  add column if not exists anzsco_occupation text check (anzsco_occupation ~ '^\d{6}$'),
  add column if not exists anzsco_occupation_title text,
  add constraint occupations_anzsco_occupation_in_unit_group check (anzsco_occupation is null or left(anzsco_occupation, 4) = anzsco);
comment on column public.occupations.anzsco is 'ANZSCO 2022 unit group used by JSA for projections and occupation profiles (join to anzsco_profiles).';
comment on column public.occupations.anzsco_occupation is 'Closest 6-digit ANZSCO occupation, or null where the career spans several.';

create table public.anzsco_profiles (
  unit_group text primary key check (unit_group ~ '^\d{4}$'),
  title text not null,
  url text not null check (url like 'https://www.jobsandskills.gov.au/%'),
  employed integer check (employed >= 0),
  part_time_pct numeric check (part_time_pct between 0 and 100),
  female_pct numeric check (female_pct between 0 and 100),
  -- Full-time, before tax (ABS Survey of Employee Earnings and Hours, via JSA).
  median_weekly_earnings integer check (median_weekly_earnings > 0),
  median_age smallint,
  -- Change in employment over the past year, as shown by JSA. Not a projection.
  annual_growth integer,
  -- Highest-qualification shares, %: postgraduate, bachelor, diploma, certificate, year12, year11, year10OrBelow.
  qualifications jsonb not null,
  source text not null,
  retrieved date not null
);
comment on table public.anzsco_profiles is 'Jobs and Skills Australia occupation profile headline figures by ANZSCO unit group (CC BY 4.0, attribute JSA).';

create table public.course_sources (
  id text primary key,
  provider text not null,
  title text not null,
  url text not null check (url like 'https://%'),
  kind text not null check (kind in ('guaranteed', 'indicative', 'minimum', 'published', 'prerequisites')),
  entry_year smallint,
  note text not null
);

create table public.university_courses (
  id bigint generated always as identity primary key,
  qualification_id text not null references public.qualifications (id) on delete cascade,
  source_id text not null references public.course_sources (id),
  provider text not null,
  state text not null check (state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
  campus text,
  course text not null,
  atar_value numeric check (atar_value between 0 and 99.95),
  atar_display text,
  atar_kind text check (atar_kind in ('guaranteed', 'indicative', 'minimum', 'published')),
  atar_year smallint,
  prerequisites text[] not null default '{}',
  assumed_knowledge text[] not null default '{}',
  recommended text[] not null default '{}',
  other_requirements text[] not null default '{}',
  check ((atar_value is null) = (atar_kind is null))
);
create index on public.university_courses (qualification_id);
create index on public.university_courses (state);
comment on table public.university_courses is 'Specific university courses per Bcome qualification with the ATAR the university published and its basis (atar_kind, atar_year).';

create table public.tafe_courses (
  id bigint generated always as identity primary key,
  qualification_id text not null references public.qualifications (id) on delete cascade,
  provider text not null,
  state text not null check (state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
  course text not null,
  -- The code the provider enrols under now (can be a newer release than qualification_id).
  offered_code text not null,
  apprenticeship boolean not null default false,
  requirements text[] not null check (cardinality(requirements) > 0),
  url text not null check (url like 'https://%')
);
create index on public.tafe_courses (qualification_id);
comment on table public.tafe_courses is 'TAFE entry requirements per VET qualification, as published by the provider.';

alter table public.anzsco_profiles enable row level security;
alter table public.course_sources enable row level security;
alter table public.university_courses enable row level security;
alter table public.tafe_courses enable row level security;
create policy "ANZSCO profiles are public" on public.anzsco_profiles for select using (true);
create policy "course sources are public" on public.course_sources for select using (true);
create policy "university courses are public" on public.university_courses for select using (true);
create policy "TAFE courses are public" on public.tafe_courses for select using (true);
revoke insert, update, delete on public.anzsco_profiles, public.course_sources, public.university_courses, public.tafe_courses from anon, authenticated;

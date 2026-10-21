-- OSCA as the primary occupation identifier, plus a skills layer linking skills, qualifications
-- and occupations (structured to align with the JSA National Skills Taxonomy once it is published).
-- Reference tables only: students' results and plans store their matches as JSON and are untouched.

drop table if exists public.occupations cascade;

-- ---------------------------------------------------------------------------
-- Occupations (OSCA 2024)
-- ---------------------------------------------------------------------------

create table public.occupations (
  osca text primary key check (osca ~ '^\d{4}(\d{2})?$'),
  osca_level text not null check (osca_level in ('occupation', 'unitGroup')),
  osca_unit_group text not null check (osca_unit_group ~ '^\d{4}$'),
  osca_title text not null,
  title text not null,
  -- ANZSCO 2022 unit group: only used to join JSA projections, which are published on ANZSCO.
  anzsco text not null check (anzsco ~ '^\d{4}$'),
  riasec text not null check (riasec ~ '^[RIASEC]{3}$'),
  entry_competitiveness text not null check (entry_competitiveness in ('open', 'moderate', 'high')),
  salary_entry_min integer not null,
  salary_entry_max integer not null,
  salary_experienced_min integer not null,
  salary_experienced_max integer not null,
  qualify_years_min numeric not null,
  qualify_years_max numeric not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  check (osca_unit_group = left(osca, 4)),
  check (salary_entry_min <= salary_entry_max and salary_experienced_min <= salary_experienced_max),
  check (qualify_years_min <= qualify_years_max)
);
create index on public.occupations (anzsco);
comment on table public.occupations is 'Careers keyed by OSCA 2024 occupation (6-digit) or unit group (4-digit) code.';
comment on column public.occupations.salary_entry_min is 'Indicative AUD a year, full-time, before tax. Bcome estimate, not JSA data.';

comment on table public.occupation_outlook is 'JSA employment projections, keyed by ANZSCO 2022 unit group (join via occupations.anzsco).';

create table public.occupation_earnings (
  -- OSCA occupation or unit group code, as published in JSA occupation profiles.
  osca text primary key check (osca ~ '^\d{4}(\d{2})?$'),
  name text,
  median_weekly numeric not null,
  source text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Skills (SKOS-style concepts, as in the National Skills Taxonomy data model)
-- ---------------------------------------------------------------------------

create table public.skill_clusters (
  id text primary key,
  pref_label text not null
);

create table public.skills (
  id text primary key,
  pref_label text not null,
  broader text not null references public.skill_clusters (id),
  type text not null check (type in ('specialist', 'core')),
  -- National Skills Taxonomy concept IRI, once JSA publishes it.
  nst_exact_match text,
  asc_match text
);

-- ---------------------------------------------------------------------------
-- Qualifications (training.gov.au codes for VET, ASCED fields for higher education)
-- ---------------------------------------------------------------------------

create table public.qualifications (
  id text primary key,
  title text not null,
  sector text not null check (sector in ('vet', 'higher-ed')),
  aqf_level smallint not null check (aqf_level between 1 and 10),
  duration_years_min numeric not null,
  duration_years_max numeric not null,
  tga_code text,
  asced_field text,
  verify_code boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Links: skills ↔ occupations, skills ↔ qualifications, qualifications → occupations
-- ---------------------------------------------------------------------------

create table public.occupation_skills (
  osca text not null references public.occupations (osca) on delete cascade,
  skill_id text not null references public.skills (id) on delete cascade,
  primary key (osca, skill_id)
);
create index on public.occupation_skills (skill_id);

create table public.qualification_skills (
  qualification_id text not null references public.qualifications (id) on delete cascade,
  skill_id text not null references public.skills (id) on delete cascade,
  primary key (qualification_id, skill_id)
);
create index on public.qualification_skills (skill_id);

create table public.occupation_pathways (
  id bigint generated always as identity primary key,
  osca text not null references public.occupations (osca) on delete cascade,
  route text not null check (route in ('university', 'vet', 'apprenticeship', 'traineeship', 'cadetship', 'other')),
  qualification_id text references public.qualifications (id),
  description text not null,
  years_min numeric not null,
  years_max numeric not null
);
create index on public.occupation_pathways (osca);
create index on public.occupation_pathways (qualification_id);

-- Which skills a qualification builds for each job it leads to. Handy for advisers and reporting.
create view public.pathway_skills with (security_invoker = true) as
select p.osca, o.title as occupation, p.route, q.id as qualification_id, q.title as qualification, q.aqf_level,
       s.id as skill_id, s.pref_label as skill
from public.occupation_pathways p
join public.occupations o on o.osca = p.osca
join public.qualifications q on q.id = p.qualification_id
join public.qualification_skills qs on qs.qualification_id = q.id
join public.occupation_skills os on os.osca = p.osca and os.skill_id = qs.skill_id
join public.skills s on s.id = qs.skill_id;

-- ---------------------------------------------------------------------------
-- Row Level Security: reference data is public, written only by the service role.
-- ---------------------------------------------------------------------------

alter table public.occupations enable row level security;
alter table public.occupation_earnings enable row level security;
alter table public.skill_clusters enable row level security;
alter table public.skills enable row level security;
alter table public.qualifications enable row level security;
alter table public.occupation_skills enable row level security;
alter table public.qualification_skills enable row level security;
alter table public.occupation_pathways enable row level security;

create policy "reference data is public" on public.occupations for select using (true);
create policy "earnings are public" on public.occupation_earnings for select using (true);
create policy "skill clusters are public" on public.skill_clusters for select using (true);
create policy "skills are public" on public.skills for select using (true);
create policy "qualifications are public" on public.qualifications for select using (true);
create policy "occupation skills are public" on public.occupation_skills for select using (true);
create policy "qualification skills are public" on public.qualification_skills for select using (true);
create policy "pathways are public" on public.occupation_pathways for select using (true);

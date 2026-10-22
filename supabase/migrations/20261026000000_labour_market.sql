-- Labour market data from Jobs and Skills Australia, and careers for every ANZSCO unit group in
-- the JSA 2025 Employment Projections. Reference data only, loaded from /data by
-- `npm run db:seed-sql`. Readable by anyone, written only by the service role.

-- Careers generated from a JSA unit group are keyed "A" + ANZSCO code until their OSCA code is mapped.
alter table public.occupations drop constraint if exists occupations_osca_check;
alter table public.occupations drop constraint if exists occupations_osca_level_check;
alter table public.occupations drop constraint if exists occupations_osca_unit_group_check;
alter table public.occupations drop constraint if exists occupations_check;
alter table public.occupations
  add constraint occupations_osca_check check (osca ~ '^(\d{4}(\d{2})?|A\d{4})$'),
  add constraint occupations_osca_level_check check (osca_level in ('occupation', 'unitGroup', 'anzsco')),
  add constraint occupations_osca_unit_group_check check (osca_unit_group ~ '^(\d{4}|A\d{4})$'),
  add constraint occupations_unit_group_matches check (osca_unit_group = left(osca, 4) or (osca_level = 'anzsco' and osca_unit_group = osca and osca = 'A' || anzsco)),
  add column if not exists skill_level smallint check (skill_level between 1 and 5),
  add column if not exists skill_levels smallint[] not null default '{}',
  add column if not exists anzsic_code text check (anzsic_code ~ '^\d{3}$'),
  add column if not exists origin text not null default 'bcome' check (origin in ('bcome', 'jsa-unit-group'));
comment on column public.occupations.skill_level is 'ANZSCO skill level (1 = bachelor or higher ... 5 = Certificate I or secondary), as listed by JSA.';
comment on column public.occupations.anzsic_code is 'Main employing industry, ANZSIC 2006 group (Bcome estimate).';

alter table public.occupation_outlook
  add column if not exists employed_2030k numeric,
  add column if not exists employed_2035k numeric,
  add column if not exists skill_levels smallint[] not null default '{}';

-- Employment by industry (ANZSIC division, subdivision and group), JSA trend.
create table public.anzsic_industries (
  code text primary key check (code ~ '^([A-S]\d{0,2}|\d{2,3})$'),
  level smallint not null check (level between 1 and 3),
  nfd boolean not null default false,
  title text not null,
  division text not null check (division ~ '^[A-S]$'),
  employed_k numeric,
  change_1y_pct numeric,
  change_5y_pct numeric,
  change_10y_pct numeric,
  share_pct numeric,
  female_pct numeric,
  part_time_pct numeric,
  median_age numeric,
  -- Employment ('000) each February from 2006, in order.
  series numeric[] not null default '{}',
  reference text not null,
  source text not null
);
comment on table public.anzsic_industries is 'JSA Labour Force Trending: National Industry Trend (ABS Labour Force Survey, trended).';

-- Total New Vacancies, quarterly, by ANZSCO major (1-digit) and sub-major (2-digit) group.
create table public.vacancies_tnv (
  occupation_code text not null check (occupation_code ~ '^\d{1,2}$'),
  occupation_level text not null,
  title text not null,
  quarter date not null,
  vacancies integer check (vacancies >= 0),
  primary key (occupation_code, quarter)
);
comment on table public.vacancies_tnv is 'JSA Total New Vacancies: new vacancies created each quarter, including unadvertised jobs.';

-- Internet Vacancy Index, monthly trend, by ANZSCO skill level and state.
create table public.vacancies_ivi (
  state text not null check (state in ('AUST','NSW','VIC','QLD','SA','WA','TAS','NT','ACT')),
  skill_level smallint not null check (skill_level between 0 and 5),
  month date not null,
  ads integer check (ads >= 0),
  primary key (state, skill_level, month)
);
comment on table public.vacancies_ivi is 'JSA Internet Vacancy Index by skill level and state (trend). Skill level 0 is all levels.';

-- Occupation Shortage List key findings: share of occupations in shortage.
create table public.shortage_summary (
  dimension text not null check (dimension in ('major_group', 'skill_level')),
  category text not null,
  year smallint not null,
  pct_in_shortage numeric,
  primary key (dimension, category, year)
);

alter table public.anzsic_industries enable row level security;
alter table public.vacancies_tnv enable row level security;
alter table public.vacancies_ivi enable row level security;
alter table public.shortage_summary enable row level security;
create policy "industries are public" on public.anzsic_industries for select using (true);
create policy "TNV is public" on public.vacancies_tnv for select using (true);
create policy "IVI is public" on public.vacancies_ivi for select using (true);
create policy "shortage summary is public" on public.shortage_summary for select using (true);
revoke insert, update, delete on public.anzsic_industries, public.vacancies_tnv, public.vacancies_ivi, public.shortage_summary from anon, authenticated;

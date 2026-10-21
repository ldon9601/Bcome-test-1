-- Career Profile v2: record which instrument and algorithm produced each result, and store each
-- recommended career's three scores so advisers can review them and weights can later be
-- calibrated against student feedback.

alter table public.results
  add column instrument_version text,
  add column algorithm_version text,
  add column dna jsonb;

create table public.match_results (
  id bigint generated always as identity primary key,
  result_id uuid not null references public.results (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  osca text not null,
  "group" text not null check ("group" in ('best', 'explore', 'wildcard')),
  rank smallint not null,
  personal_fit smallint not null check (personal_fit between 0 and 100),
  future_opportunity smallint not null check (future_opportunity between 0 and 100),
  pathway_feasibility smallint not null check (pathway_feasibility between 0 and 100),
  match_score smallint not null check (match_score between 0 and 100),
  confidence text not null check (confidence in ('High', 'Moderate', 'Low')),
  created_at timestamptz not null default now()
);
create index on public.match_results (result_id);
create index on public.match_results (osca);

-- Students' reactions to a recommendation ("How interested are you after learning about it?").
create table public.career_feedback (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  osca text not null,
  interest smallint check (interest between 1 and 5),
  what_changed text check (char_length(what_changed) <= 500),
  created_at timestamptz not null default now()
);

alter table public.match_results enable row level security;
alter table public.career_feedback enable row level security;

-- Written by the server after scoring; readable by the student, their school's advisers and consenting parents.
create policy "view permitted match results" on public.match_results
  for select to authenticated using (public.can_view_student(student_id));

create policy "students give feedback" on public.career_feedback
  for insert to authenticated with check (student_id = auth.uid());
create policy "view permitted feedback" on public.career_feedback
  for select to authenticated using (public.can_view_student(student_id));

-- "Careers you're already considering" (questionnaire Section F): the careers a student named,
-- checked against their profile, stored with each saved assessment so the student and their
-- adviser see them later. Nullable: assessments saved before this have none.
alter table public.assessments add column if not exists ideas jsonb;

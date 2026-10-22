-- Bcome platform administrators (ST4S A5 privileged access) and the API request log (ST4S L1).
--
-- Administrators are app_users with role 'admin' attached to one hidden schools row of kind
-- 'platform'. They are created only with `npm run admin -- create` (service role key), always need
-- an emailed code to sign in, and have 4-hour sessions with a 15-minute idle timeout.

-- Schools: the hidden platform record.
alter table public.schools add column kind text not null default 'school' check (kind in ('school', 'platform'));
create unique index schools_one_platform on public.schools (kind) where kind = 'platform';

-- Users: the admin role. Admins have no year level or birth date.
alter table public.app_users drop constraint app_users_role_check;
alter table public.app_users add constraint app_users_role_check check (role in ('student', 'adviser', 'admin'));
alter table public.app_users drop constraint student_fields;
alter table public.app_users add constraint student_fields check (
  (role = 'student' and year_level is not null and birth_year is not null and birth_month is not null
     and year_level in (10, 11, 12) and birth_year between 1990 and 2030 and birth_month between 1 and 12)
  or (role in ('adviser', 'admin') and year_level is null and birth_year is null and birth_month is null)
);

-- One-time "set your password" links that administrators email to new or locked-out accounts.
alter table public.auth_challenges drop constraint auth_challenges_purpose_check;
alter table public.auth_challenges add constraint auth_challenges_purpose_check
  check (purpose in ('verify_email', 'login', 'reset_password', 'set_password'));

-- API request log for monitoring: method, path (no query string), status, timing, IP and browser.
-- No request bodies, cookies or personal details. Kept 30 days.
create table public.request_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  method text not null check (length(method) <= 10),
  path text not null check (length(path) <= 200),
  status smallint not null,
  ms integer not null check (ms >= 0),
  ip inet,
  user_agent text check (length(user_agent) <= 300)
);
create index request_log_at on public.request_log (at desc);
create index request_log_ip on public.request_log (ip, at desc);
create index audit_log_ip on public.audit_log (ip, at desc);
create index audit_log_at on public.audit_log (at desc);

alter table public.request_log enable row level security;
revoke all on public.request_log from anon, authenticated;

create or replace function public.purge_expired() returns void
language sql volatile set search_path = public as $$
  delete from sessions where expires_at < now();
  delete from trusted_devices where expires_at < now();
  delete from auth_challenges where expires_at < now() - interval '1 day';
  delete from adviser_invites where accepted_at is null and expires_at < now() - interval '30 days';
  delete from rate_limits where window_start < now() - interval '1 day';
  delete from audit_log where at < now() - interval '400 days';
  delete from request_log where at < now() - interval '30 days';
$$;
revoke all on function public.purge_expired() from public, anon, authenticated;
grant execute on function public.purge_expired() to service_role;

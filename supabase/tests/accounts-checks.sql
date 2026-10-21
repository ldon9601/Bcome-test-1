-- Checks for the accounts migration. Run on plain Postgres after local-auth-stub.sql and all
-- migrations (see README). Each line prints PASS or FAIL.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_error(sql text, label text) returns text language plpgsql as $$
begin
  execute sql;
  return 'FAIL ' || label || ' (no error)';
exception when others then
  return 'PASS ' || label || ' (' || sqlstate || ')';
end $$;

insert into schools (id, name, state, student_domains, join_code, status)
values ('00000000-0000-0000-0000-00000000000a', 'Harbour High', 'NSW', '{students.harbour.nsw.edu.au}', 'K7PM-3QXD', 'active');

insert into app_users (id, school_id, role, username, email, first_name, last_name, year_level, birth_year, birth_month, password_hash)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'student', 'miachen',
        'mia.chen@students.harbour.nsw.edu.au', 'Mia', 'Chen', 11, 2010, 3, 'scrypt$17$8$1$abc$def');

select pg_temp.expect_error($$insert into app_users (school_id, role, username, email, first_name, last_name, year_level, birth_year, birth_month, password_hash)
  values ('00000000-0000-0000-0000-00000000000a','student','miachen','x@students.harbour.nsw.edu.au','A','B',11,2010,3,'scrypt$x')$$, 'duplicate username refused');
select pg_temp.expect_error($$insert into app_users (school_id, role, username, email, first_name, last_name, password_hash)
  values ('00000000-0000-0000-0000-00000000000a','student','noyear','y@students.harbour.nsw.edu.au','A','B','scrypt$x')$$, 'student without year level and birth month refused');
select pg_temp.expect_error($$insert into app_users (school_id, role, username, email, first_name, last_name, year_level, birth_year, birth_month, password_hash)
  values ('00000000-0000-0000-0000-00000000000a','student','Upper','z@students.harbour.nsw.edu.au','A','B',11,2010,3,'scrypt$x')$$, 'mixed-case username refused');
select pg_temp.expect_error($$insert into app_users (school_id, role, username, email, first_name, last_name, year_level, birth_year, birth_month, password_hash)
  values ('00000000-0000-0000-0000-00000000000a','student','plain','p@students.harbour.nsw.edu.au','A','B',11,2010,3,'hunter2')$$, 'unhashed password refused');
select pg_temp.expect_error($$insert into schools (name, state, student_domains, join_code) values ('No Domains','NSW','{}','AAAA-BBBB')$$, 'school without domains refused');

insert into assessments (user_id, school_id, instrument_version, algorithm_version, holland_code, answers, profile, dna, matches, plan)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '2.0.0', '2.0.0', 'ICR', '{}', '{}', '{}', '[]', '{}');
insert into sessions (user_id, token_hash, expires_at) values ('10000000-0000-0000-0000-000000000001', 'h1', now() + interval '1 hour');

-- Browser roles can't read or write anything.
set role anon;
select pg_temp.expect_error('select * from app_users', 'anon cannot read users');
select pg_temp.expect_error('select * from assessments', 'anon cannot read assessments');
select pg_temp.expect_error('select public.rate_limit_hit(''x'', 1000)', 'anon cannot call rate limiter');
reset role;
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select pg_temp.expect_error('select * from app_users', 'authenticated cannot read users');
select pg_temp.expect_error('select * from sessions', 'authenticated cannot read sessions');
select pg_temp.expect_error($$insert into audit_log (event) values ('forged')$$, 'authenticated cannot write audit log');
reset role;

-- Rate limiter counts within a window and resets after it.
select case when public.rate_limit_hit('k', 60000) = 1 and public.rate_limit_hit('k', 60000) = 2 then 'PASS rate limit counts' else 'FAIL rate limit counts' end;
update rate_limits set window_start = now() - interval '2 minutes' where key = 'k';
select case when public.rate_limit_hit('k', 60000) = 1 then 'PASS rate limit window resets' else 'FAIL rate limit window resets' end;

-- Deleting a student removes their sessions and assessment history; the audit trail stays.
insert into audit_log (event, actor_id, school_id) values ('login.success', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a');
delete from app_users where id = '10000000-0000-0000-0000-000000000001';
select case when (select count(*) from assessments) = 0 and (select count(*) from sessions) = 0 and (select count(*) from audit_log) = 1
  then 'PASS deletion cascades, audit kept' else 'FAIL deletion cascades, audit kept' end;

-- Purge removes expired state.
insert into rate_limits values ('old', now() - interval '3 days', 5);
select public.purge_expired();
select case when not exists (select 1 from rate_limits where key = 'old') then 'PASS purge' else 'FAIL purge' end;

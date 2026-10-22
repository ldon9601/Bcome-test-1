-- Checks for the platform administrator migration. Run on plain Postgres after
-- local-auth-stub.sql and all migrations. Each line prints PASS or FAIL.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_error(sql text, label text) returns text language plpgsql as $$
begin
  execute sql;
  return 'FAIL ' || label || ' (no error)';
exception when others then
  return 'PASS ' || label || ' (' || sqlstate || ')';
end $$;
create or replace function pg_temp.expect(ok boolean, label text) returns text language sql as $$
  select case when ok then 'PASS ' else 'FAIL ' end || label;
$$;

insert into schools (id, kind, name, state, student_domains, join_code, status)
values ('00000000-0000-0000-0000-0000000000a0', 'platform', 'Bcome platform administration', 'NSW', '{platform.bcome.invalid}', 'PLAT-F0RM', 'active');
select pg_temp.expect((select kind from schools where id = '00000000-0000-0000-0000-0000000000a0') = 'platform', 'platform school stored');
select pg_temp.expect(
  (select count(*) from schools where kind = 'school') = (select count(*) from schools where kind <> 'platform'),
  'existing schools default to kind school');
select pg_temp.expect_error($$insert into schools (kind, name, state, student_domains, join_code) values ('platform','Second platform','NSW','{x.invalid}','PLAT-0002')$$, 'only one platform record');
select pg_temp.expect_error($$insert into schools (kind, name, state, student_domains, join_code) values ('district','District','NSW','{x.invalid}','DIST-0001')$$, 'unknown school kind refused');

insert into app_users (school_id, role, username, email, first_name, last_name, password_hash)
values ('00000000-0000-0000-0000-0000000000a0', 'admin', 'luke.admin', 'luke@bcome.example', 'Luke', 'Admin', 'scrypt$17$8$1$abc$def');
select pg_temp.expect((select role from app_users where username = 'luke.admin') = 'admin', 'admin account stored');
select pg_temp.expect_error($$insert into app_users (school_id, role, username, email, first_name, last_name, password_hash, year_level, birth_year, birth_month)
  values ('00000000-0000-0000-0000-0000000000a0','admin','bad.admin','bad@bcome.example','B','A','scrypt$x',10,2010,1)$$, 'admin with a year level refused');
select pg_temp.expect_error($$insert into app_users (school_id, role, username, email, first_name, last_name, password_hash)
  values ('00000000-0000-0000-0000-0000000000a0','owner','x.owner','x@bcome.example','X','O','scrypt$x')$$, 'unknown role refused');

insert into auth_challenges (user_id, purpose, code_hash, token_hash, expires_at)
select id, 'set_password', 'link', 'set-pw-hash', now() + interval '3 days' from app_users where username = 'luke.admin';
select pg_temp.expect((select count(*) from auth_challenges where purpose = 'set_password') = 1, 'set_password link stored');

insert into request_log (at, method, path, status, ms, ip, user_agent) values
  (now(), 'POST', '/api/auth/sign-in', 200, 41, '203.0.113.7', 'Mozilla/5.0'),
  (now() - interval '31 days', 'POST', '/api/auth/sign-in', 401, 30, '203.0.113.8', null);
select pg_temp.expect_error($$insert into request_log (method, path, status, ms, ip) values ('GET','/x',200,1,'not-an-ip')$$, 'bad IP refused');
select pg_temp.expect_error($$insert into request_log (method, path, status, ms) values ('GET','/x',200,-5)$$, 'negative duration refused');
select public.purge_expired();
select pg_temp.expect((select count(*) from request_log) = 1, 'purge removes request log entries older than 30 days');
select pg_temp.expect((select relrowsecurity from pg_class where relname = 'request_log'), 'request_log has row level security');
select pg_temp.expect(not has_table_privilege('anon', 'public.request_log', 'select'), 'anon cannot read the request log');
select pg_temp.expect(not has_table_privilege('authenticated', 'public.request_log', 'insert'), 'authenticated cannot write the request log');

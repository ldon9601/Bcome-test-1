-- Checks for the activity migration (portfolio, missions, calendar, action cards). Run on plain
-- Postgres after local-auth-stub.sql and all migrations. Each line prints PASS or FAIL.
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

insert into schools (id, name, state, student_domains, join_code, status)
values ('00000000-0000-0000-0000-0000000000b1', 'Ridge High', 'QLD', '{students.ridge.qld.edu.au}', 'R1DG-3QXD', 'active');
insert into app_users (id, school_id, role, username, email, first_name, last_name, year_level, birth_year, birth_month, password_hash) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'student', 'kai.tran', 'kai@students.ridge.qld.edu.au', 'Kai', 'Tran', 10, 2011, 5, 'scrypt$17$8$1$abc$def'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'adviser', 'ms.lee', 'lee@ridge.qld.edu.au', 'Sam', 'Lee', null, null, null, 'scrypt$17$8$1$abc$def');

insert into evidence_items (user_id, school_id, category, title, start_month, description, skills)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'sport', 'Under-15 soccer', '2026-02', 'Played every Saturday.', '{Teamwork}');
select pg_temp.expect_error($$insert into evidence_items (user_id, school_id, category, title, start_month, description)
  values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','party','x x','2026-02','aaaaaaaaaaaa')$$, 'unknown evidence category refused');
select pg_temp.expect_error($$insert into evidence_items (user_id, school_id, category, title, start_month, end_month, description)
  values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','work','Job','2026-05','2026-01','aaaaaaaaaaaa')$$, 'evidence ending before it starts refused');
select pg_temp.expect_error($$insert into evidence_items (user_id, school_id, category, title, start_month, description)
  values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','work','Job','2026-13','aaaaaaaaaaaa')$$, 'bad month refused');

insert into mission_completions (user_id, school_id, week, mission_id, title, reflection, points)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '2026-W43', 'talk-adviser', 'Talk to your adviser', 'Talked about subjects.', 75);
select pg_temp.expect_error($$insert into mission_completions (user_id, school_id, week, mission_id, title, reflection, points)
  values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','2026-W43','x','Again','Trying again for points.',75)$$, 'second mission in the same week refused');

insert into school_events (id, school_id, created_by, kind, title, starts_on, year_levels, families)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000002', 'open_day', 'QUT Open Day', '2026-11-08', '{11,12}', '{health}');
select pg_temp.expect_error($$insert into school_events (school_id, kind, title, starts_on, ends_on) values ('00000000-0000-0000-0000-0000000000b1','expo','Expo','2026-11-08','2026-11-01')$$, 'event ending before it starts refused');
select pg_temp.expect_error($$insert into school_events (school_id, kind, title, starts_on, url) values ('00000000-0000-0000-0000-0000000000b1','expo','Expo','2026-11-08','javascript:alert(1)')$$, 'non-web event link refused');
select pg_temp.expect_error($$insert into school_events (school_id, kind, title, starts_on, year_levels) values ('00000000-0000-0000-0000-0000000000b1','expo','Expo','2026-11-08','{9}')$$, 'year 9 refused');

insert into event_responses (user_id, school_id, event_id) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001');
insert into action_card_states (user_id, school_id, card_key, status) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '2026-10:talk:254111', 'done');

-- Browser roles can't read anything.
set role anon;
select pg_temp.expect_error('select * from evidence_items', 'anon cannot read portfolios');
select pg_temp.expect_error('select * from school_events', 'anon cannot read events');
reset role;
set role authenticated;
select pg_temp.expect_error('select * from mission_completions', 'authenticated cannot read missions');
reset role;

-- Removing the adviser keeps the event; removing the student removes all their activity.
delete from app_users where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.expect((select created_by is null from school_events where id = '30000000-0000-0000-0000-000000000001'), 'event kept when its adviser is removed');
delete from app_users where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.expect((select count(*) = 0 from evidence_items) and (select count(*) = 0 from mission_completions)
  and (select count(*) = 0 from event_responses) and (select count(*) = 0 from action_card_states), 'student activity removed with the account');
delete from schools where id = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.expect((select count(*) = 0 from school_events), 'events removed with the school');

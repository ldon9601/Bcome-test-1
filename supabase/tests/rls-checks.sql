-- Row Level Security checks. Run on a database with local-auth-stub.sql, the migration and seed applied.
-- Each ERROR in the output is an attempt that should be blocked (role change, forged result, plan edit, re-pointing or forging a guardian link, writing reference data). Counts should read: student A 1 result, adviser 1, parent 0 before consent then 1, stranger 0; anon can read pathway skills; the occupation title stays "Electrician".
\set ON_ERROR_STOP 0
insert into schools (id,name,state) values ('00000000-0000-0000-0000-00000000000a','School X','NSW'),('00000000-0000-0000-0000-00000000000b','School Y','VIC');
insert into auth.users (id, raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000001','{"role":"student"}'),
 ('10000000-0000-0000-0000-000000000002','{"role":"student"}'),
 ('20000000-0000-0000-0000-000000000001','{"role":"admin"}'),
 ('30000000-0000-0000-0000-000000000001','{"role":"parent"}'),
 ('30000000-0000-0000-0000-000000000002','{"role":"parent"}');
-- trigger created profiles; admin self-select must have become student
select 'self-selected admin became', role from profiles where id='20000000-0000-0000-0000-000000000001';
update profiles set role='adviser', school_id='00000000-0000-0000-0000-00000000000a' where id='20000000-0000-0000-0000-000000000001';
update profiles set school_id='00000000-0000-0000-0000-00000000000a' where id='10000000-0000-0000-0000-000000000001';
update profiles set school_id='00000000-0000-0000-0000-00000000000b' where id='10000000-0000-0000-0000-000000000002';
insert into guardian_links (student_id, guardian_id) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
insert into questionnaire_sessions (id, student_id, bank_id, bank_version) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','riasec-au','1.0.0'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','riasec-au','1.0.0');
insert into results (id, session_id, student_id, holland_code, profile, matches) values
 ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','SIC','{}','[]'),
 ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','RIC','{}','[]');
insert into plans (result_id, student_id, plan, generated_by) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','{}','template'),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','{}','template');

set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select 'student A sees results:', count(*) from results;
select 'student A sees profiles:', count(*) from profiles;
update profiles set role='admin' where id = auth.uid();
update profiles set year_level = 11 where id = auth.uid();
select 'student A year level now', year_level, role from profiles where id = auth.uid();
insert into results (session_id, student_id, holland_code, profile, matches) values ('40000000-0000-0000-0000-000000000001', auth.uid(), 'AAA','{}','[]');

set request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
select 'adviser at X sees results:', count(*), string_agg(holland_code, ',') from results;
update plans set adviser_reviewed_by = auth.uid(), adviser_reviewed_at = now() where student_id = '10000000-0000-0000-0000-000000000001';
update plans set plan = '{"hacked":true}' where student_id = '10000000-0000-0000-0000-000000000001';

set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select 'parent before consent sees plans:', count(*) from plans;
update guardian_links set consent_status = 'granted', consented_at = now() where guardian_id = auth.uid();
select 'parent after consent sees plans:', count(*) from plans;
update guardian_links set student_id = '10000000-0000-0000-0000-000000000002' where guardian_id = auth.uid();

set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';
insert into guardian_links (student_id, guardian_id, consent_status) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'granted');
select 'stranger parent sees plans:', count(*) from plans;
reset role;
select 'plan still intact:', plan from plans where student_id='10000000-0000-0000-0000-000000000001';
select 'review recorded:', adviser_reviewed_by is not null from plans where student_id='10000000-0000-0000-0000-000000000001';

-- Reference data (OSCA occupations, skills, qualifications): anyone can read, nobody but the service role can write.
set role anon;
select 'anon reads pathway skills:', count(*) > 0 from pathway_skills;
insert into skills (id, pref_label, broader, type) values ('sk-hack', 'Hack', 'cluster-core', 'core');
update occupations set title = 'Hacked' where osca = '381231';
reset role;
select 'occupation title intact:', title from occupations where osca = '381231';

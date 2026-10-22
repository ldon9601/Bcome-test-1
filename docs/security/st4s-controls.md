# Safer Technologies 4 Schools (ST4S): how Bcome addresses the criteria

ST4S is a national assessment run by Education Services Australia (ESA). A product can't make itself "ST4S compliant". The supplier (Bcome) completes ESA's questionnaire, supplies evidence, and ESA publishes a report that schools and systems use. This document maps the ST4S criteria (Supplier Guide 2023.1, with the 2026 updates on personnel screening and AI controls) to what the code does, and lists what Bcome as an organisation still has to do before applying.

Criteria marked **#** are "critical": failing one gives a non-compliant result.

Status key:

- **Built**: implemented and tested in this repository.
- **Deploy**: needs the right setting when deploying (see `.env.example`).
- **Organisation**: a Bcome process or policy, not code.

## Authentication and access

| Criterion | What Bcome does | Status |
|---|---|---|
| A1# Unique authentication | Every student and adviser has their own username, school email and password. There are no shared accounts. | Built |
| A2# Passwords | At least 14 characters, with letters, a number and a symbol. Common passwords and ones containing the person's name, username or email are refused. Hashing is scrypt (N=2^17, r=8, p=1, 16-byte salt), as recommended by the OWASP Password Storage Cheat Sheet. Hashes are upgraded automatically if the settings are raised. | Built (`src/lib/auth/crypto.ts`, `validation.ts`) |
| A4 End-user MFA | Students confirm every new device with an emailed six-digit code; a device stays trusted for 90 days. Advisers confirm **every** sign-in by email code. | Built |
| A5# MFA for privileged accounts | Advisers (who can see a whole school's data) and Bcome platform administrators always use password + email code. Administrators can only be created from the command line with the service role key (`npm run admin`), have 4-hour sessions with a 15-minute idle timeout, can't be signed up for or invited, and every administrator action is logged as `admin.*`. Accounts an administrator creates get a one-time set-password link rather than a password anyone else knows. Bcome staff access to Supabase, Vercel, GitHub, AWS and email must use MFA. | Built / Organisation |
| A10# Inactivity lock | Adviser sessions end after 15 minutes without activity (8-hour maximum). Students' sessions end after 60 idle minutes, or after 30 days if they ticked "Remember me". | Built (`policy.ts`) |
| A11# Password resets | A reset needs a one-time code sent to the account's email (10 minutes, 5 attempts). Afterwards every session and trusted device is revoked, and a "password changed" email is sent. Requests always get the same answer, so they can't be used to find accounts. | Built |
| A13# Deny by default | All account and activity tables (`20261025000000_activity.sql`) have row level security turned on with no policies, and browser roles have no privileges. Only the server, using the service role key, can read them. Every page and API checks the session and role. | Built (`supabase/migrations/20261023000000_accounts.sql`, checked by `supabase/tests/accounts-checks.sql`) |
| Account lockout | Five wrong passwords lock the account for 15 minutes. Sign-in attempts are also rate-limited per username or email. The limit is per account rather than per IP, because whole schools share one IP address. | Built |
| A12/A14 SSO | Not yet. Many schools will want Google Workspace or Microsoft Entra sign-in. It's a natural next step and would replace passwords for schools that use it. | Not built |

## Data protection

| Criterion | What Bcome does | Status |
|---|---|---|
| S1#/S5# Encryption in transit | HTTPS only on Vercel (TLS 1.2+). HSTS is set for two years. Cookies are `Secure`, `HttpOnly`, `SameSite=Lax` and use the `__Host-` prefix. | Built / Deploy |
| S2# Encryption at rest | Supabase encrypts databases and backups with AES-256. | Deploy |
| S4# Tenant separation | Every query for student data is scoped to the signed-in adviser's school. The tests check that advisers can't see or remove another school's students. Join codes separate schools that share a state email domain. | Built (`tests/auth.test.ts`, `tests/adviser.test.ts`) |
| S13# No production data in test | The in-memory demo school uses invented people. Never copy production data to preview deployments. | Built / Organisation |
| Secrets | Session, device and invite tokens are 256-bit random values. Only their SHA-256 hashes are stored. Email codes are HMAC-SHA256 keyed with `AUTH_SECRET`. | Built |
| Web security | Content Security Policy (same-origin only), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a permissions policy. POST APIs reject cross-site requests (Origin check) and bodies over 16 KB. CSV exports neutralise spreadsheet formulas. | Built (`next.config.ts`, `src/lib/auth/route.ts`) |
| Weakness | The CSP still allows inline scripts, because Next.js needs them for hydration. Moving to nonce-based CSP in middleware would tighten this. | To do |

## Hosting and data location

| Criterion | What Bcome does | Status |
|---|---|---|
| H1 Data in Australia | Supabase project in Sydney (ap-southeast-2), Vercel functions pinned to `syd1` (`vercel.json`), and email through Amazon SES in Sydney (`EMAIL_PROVIDER=ses`). Resend is supported but processes email in the US. | Deploy |
| AI processing | AI-written plans are **off by default** for every school. An adviser can turn them on in School settings (ST4S 2026 AI controls). Only de-identified scores and career IDs are sent to Anthropic, never names, emails or the school. Plans otherwise come from the built-in templates. | Built |
| H5# Notice before moving data | Organisation commitment: tell schools before changing hosting region or providers. | Organisation |
| H6 IRAP | AWS Sydney is IRAP-assessed. Check the current status of Supabase and Vercel when applying, and record it. | Organisation |

## Logging

| Criterion | What Bcome does | Status |
|---|---|---|
| L1 Audit logging | The `audit_log` table records sign-ins, failures, lockouts, wrong codes, new-device checks, sign-outs, timeouts, password changes and resets, registrations, deletions, school setting changes, invitations, student views and exports, calendar event changes and completed missions. Each entry has a time, actor, target, school and IP address. Passwords and codes are never logged. Entries survive account deletion. | Built |
| L3 Logs on request | Advisers see their school's latest 100 events in School settings. A full export for a school is a query on `audit_log` by `school_id`. | Built |
| L2/L4 Monitoring and central logging | The administrator dashboard (`/admin`, `/admin/logs`) shows system health, API traffic, errors and response times, sign-in failures and lockouts, and incoming IP addresses (flagging any with five or more failures in 24 hours). The `request_log` table records each API request's time, method, path (no query string), status, duration, IP address and user agent, with no bodies or cookies. Still to do: send Vercel and Supabase logs to a central service (a log drain) and alert on spikes in `login.locked` and `code.failed`. | Built / Organisation |
| Retention | `purge_expired()` deletes expired sessions, codes and devices, audit entries older than 400 days and request log entries older than 30 days. Administrators can also run it from the dashboard. Schedule it daily with pg_cron (see the migration). | Deploy |

## Privacy

| Criterion | What Bcome does | Status |
|---|---|---|
| Data minimisation | Students: first and last name, school email, username, school, school year, and month and year of birth. Nothing else about the person. Assessment answers and results are kept so students and advisers can see change over time. Trusted devices store a coarse label ("Chrome on Windows"), not the user agent. The Skills Evidence Portfolio stores what the student enters (length-limited, with phone numbers and email addresses refused), mission notes, card and event choices. CV contact details are typed in the browser and never sent to Bcome (the Word file is built client-side). | Built |
| Collection notice (APP 5) | Shown on the sign-up form, which needs explicit acknowledgement, and in full at `/privacy`. **Have it reviewed by a privacy lawyer before launch**, and set `NEXT_PUBLIC_PRIVACY_EMAIL`. | Built (draft) |
| Access and correction | Students see all their details and results on their profile and can change their year level. Advisers can see everything for their school. | Built |
| Deletion | Students can delete their account, and all their assessments, portfolio entries, missions, card choices and event interest go with it (`supabase/tests/activity-checks.sql`). Advisers can remove students who have left, and other advisers. Deletion cascades in the database. | Built |
| P11 Advertising | No advertising, tracking cookies or third-party scripts. Fonts are self-hosted at build time. | Built |
| Guardians | The earlier parent-consent design was removed when accounts became school-registered. The school is the point of contact. If a school wants parental consent for students under 16, add it as a school setting. | Decision for Bcome |

## Organisation tasks before applying to ST4S

1. Written policies: information security, privacy, incident response (including Notifiable Data Breaches), and data retention and deletion at contract end.
2. MFA on every staff account (Supabase, Vercel, GitHub, AWS, domain registrar, email). Keep a list of who has production access, and screen staff and contractors who can reach student data (a 2026 focus).
3. An independent penetration test before launch, then yearly and after major changes.
4. Dependency updates (Dependabot) and a patching cadence.
5. A process for school approvals (`npm run school -- list`), so a school is confirmed by phone or website before it's activated.
6. Backups: confirm Supabase point-in-time recovery is on, and test a restore.
7. Complete ESA's ST4S readiness check, then the full assessment.

Sources: [ST4S Supplier Guide 2023.1](https://st4s.edu.au/wp-content/uploads/2024/05/Safer-Technologies-4-Schools-Supplier-Guide-2023.1-v1.2.pdf), [ST4S Readiness Check](https://st4s.edu.au/readiness-check/), [ESA: Safer Technologies 4 Schools](https://esa.edu.au/solutions/our-solutions/safer-technologies-4-schools), OWASP Password Storage and Session Management Cheat Sheets.

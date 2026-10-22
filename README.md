# Bcome

An AI-powered career navigation platform for Australian students in Years 10–12. Students complete the 36-question **Career Profile**. They first see their **Career DNA**, then careers grouped as best matches, careers worth exploring and a wildcard. Each career is scored on **personal fit**, **future opportunity** and **pathway feasibility**, and the student gets a year-by-year journey towards their top match.

Rules and structured data decide the recommendations. The AI only explains them and personalises the journey. It cannot assign scores, invent statistics, salaries or prerequisites, add careers, or tell a student they are unsuitable for a career.

## How it works

### 1. Career Profile (`data/questions/career-profile.json`, `src/lib/questionnaire/`)

Four non-scoring onboarding questions (year, state, current subjects, broad geographic preference), then 36 questions answered by every student in the same order:

| Section | Questions | Scale | Measures |
| --- | --- | --- | --- |
| A. Interests | 1–12 | Strongly dislike → Would love it | RIASEC, two items per type |
| B. Current skill confidence | 13–20 | Not confident yet → Very confident | Quantitative, communication, scientific, digital, spatial, practical, interpersonal, leadership |
| C. Work values | 21–28 | Not important → Extremely important | Purpose, income, security, autonomy, creativity, leadership, work-life, learning; **centred on each student's own mean** so "everything is important" carries no signal |
| D. Work environment | 29–33 | Rank + four sliders | People / Ideas / Data / Things; independent↔team, structured↔flexible, seated↔hands-on, regular↔varied |
| E. School and pathway | 34–36 | Matrix, multi-select, single | Enjoyment and confidence in 10 subject areas; paths they'd consider; how long they'd study |

The profile also gives seven **Career DNA** dimensions (analytical, creative, interpersonal, technical, entrepreneurial, structured working preference, continuous-learning appetite). It also produces a profile-quality measure: completeness drops for "not sure" answers, and consistency checks that each pair of interest items agrees and that the student didn't give the same answer to everything.

### 2. Career data

- **Occupations** (`data/occupations/occupations.json`): 357 careers. 63 are hand-written and keyed by **OSCA 2024** code. The other 294 cover every remaining ANZSCO unit group in the JSA 2025 Employment Projections (`origin: "jsa-unit-group"`); they're keyed `A` + ANZSCO code (e.g. `A2512`) until their OSCA codes are mapped. Three unit groups are left out on purpose: 1392 Senior Non-commissioned Defence Force Members (a promotion, not an entry career), 4518 Other Personal Service Workers (a mixed group including adult services) and 8997 Vending Machine Attendants. Every career has its JSA **skill level(s)** (1 to 5) and Bcome's estimate of its main **ANZSIC** industry group. Each career is also coded to its **ANZSCO 2022** unit group (as used by Jobs and Skills Australia) and, where one fits, the closest 6-digit ANZSCO occupation. The unit group joins JSA projections and the JSA occupation profile. Each career has a 0–100 profile on the questionnaire's own dimensions (interests, skill requirements, values, work environment), plus subject areas, pathways, time to qualify, a pay range, and opportunity indicators.
- **JSA occupation profiles** (`data/outlook/jsa-occupation-profiles.json`): headline figures from each career's [JSA occupation profile](https://www.jobsandskills.gov.au/data/occupation-and-industry-profiles/occupations-anzsco): employment, median full-time weekly earnings, past-year change, median age, % women, % part-time and the highest-qualification mix. They're shown as "The job in numbers" on results and in the career browser, and the median earnings feed the earnings part of future opportunity.
- **Courses** (`data/courses/offerings.json`): specific university courses (ATAR, its basis and year, prerequisites, assumed knowledge, other requirements and the source) and TAFE courses (entry requirements, apprenticeship or not, current code). Results show up to four universities and two TAFE courses per career, with the student's state first, TAFE first if they chose TAFE or an apprenticeship, and prerequisites they aren't studying flagged. `/explore` lists them all with state and "my matches" filters.
- **How the new careers are profiled**: each has its own title, summary, Holland code, skills, industry, pathway and shortage rating. Its skill, value and work-environment levels come from one of about 40 job archetypes (for example "building trade", "allied health professional", "retail"), and its interest profile from its Holland code. Pay ranges are estimates by archetype. They're matched exactly like the hand-written careers; results say when a career was added from JSA data. Review them with a careers adviser, starting with the ones students see most.
- **Labour market data** (`data/labour/`, `src/lib/labour.ts`), imported from the JSA workbooks with `scripts/import-labour-market.py`:
  - `vacancies.json`: Total New Vacancies (quarterly since 2016, by ANZSCO major and sub-major group, and by state) and the Internet Vacancy Index (monthly trend since 2006, by skill level and state).
  - `industries.json`: employment by ANZSIC division, subdivision and group (trend to February 2026), with gender, part-time and median age.
  - `shortage.json`: the 2025 Occupation Shortage List key findings (share of occupations in shortage by major group and skill level, applicants per vacancy).
  - `data/outlook/jsa-2025.json` now holds projections for all 358 unit groups, so every career's outlook uses its own JSA figure.
- **Vacancies on results**: each career in a result carries a snapshot taken when the assessment was completed (`labour` in the saved matches): skill level, ANZSCO and ANZSIC codes, new vacancies for its occupation group in the latest quarter at that time and Bcome's estimate for the job (its share of the group's employment), online ads for its skill level in the student's state, projected growth, industry employment and the shortage rate. The drill-down adds history charts from the latest data (`GET /api/careers/{osca}/labour?state=NSW`). Skill levels and ANZSIC have a "?" button with definitions.
- **Skills layer** (`data/skills/`): skills ↔ qualifications ↔ occupations, shaped like the JSA National Skills Taxonomy data model.

### 3. Scoring (`src/lib/careers/matching.ts`, requirements doc sections 6–13)

Similarity = 1 − Σwᵢ|sᵢ − oᵢ| / Σwᵢ, with dimensions that matter more to the occupation weighted more. Skills count unused strengths at half weight, and subject prerequisites count only shortfalls.

| Score | Formula |
| --- | --- |
| Personal fit | .35 interests + .20 skill affinity + .20 work values + .15 work environment + .10 subject affinity |
| Future opportunity | .30 employment growth (JSA) + .20 shortage + .15 regional breadth + .15 graduate outcomes + .10 earnings potential (JSA median full-time earnings where published) + .10 AI adaptability |
| AI adaptability | .50 (1 − automation) + .30 augmentation + .20 adaptation (skill portability). Kept separate from growth because JSA's projections exclude generative AI. |
| Pathway feasibility | .30 subject prerequisites + .25 academic readiness + .20 qualification pathway fit + .10 study-duration preference + .10 alternative pathway breadth + .05 geographic accessibility |
| **Match score** | **.60 personal fit + .25 future opportunity + .15 pathway feasibility** |
| Confidence | .40 completeness + .25 consistency + .35 data quality → High / Moderate / Low, naming what would improve it |

**Personal fit always comes first:**
- Only careers within 12 points of the student's best personal fit (and at least 55) are recommended. A great job outlook can't bring in a poor-fit career.
- Careers are ordered by personal fit. Opportunity and pathway only reorder careers whose fit is within 5 points of each other.
- The student's single best fit is always the first career shown.
- Entry-level jobs (skill level 4 or 5, under a year to start) can be recommended, but best matches stay mostly careers: none for a student planning uni, TAFE or an apprenticeship (and not "work and learn"), at most one for anyone else, and at most two across all recommendations. When one is shown, its explanation says it's a job you could start soon or alongside study.
- Identified positions for Aboriginal and Torres Strait Islander people are searchable but not recommended automatically, because Bcome doesn't ask about cultural identity.
- On each career card, personal fit is the headline number.
- The AI is told to lead every explanation with fit, and the app restores the engine's order whatever order the AI uses.

**Diversity and groups:**
- Display fit = personal fit − 8 × similarity to careers already chosen, so the list isn't five versions of the same job.
- *Best matches* are the five strongest fits.
- *Worth exploring* holds up to two more strong fits, preferring ones that need extra subjects, skills or study.
- The *Wildcard* is a strong fit from a different field.

**Explanations:**
- Every career shows its strong matches (+++ bars) and what the student would need to build. Gaps are never framed as unsuitability.
- Every career shows a future-outlook summary: employment, shortage, AI augmentation and automation, income and education requirement.
- Where it applies, a career also shows how feasibility could improve, e.g. "72 today, about 90 if you select Chemistry in Year 11".

### 4. Plan and journey (`src/lib/plan/`)

- The journey rules engine (`journey.ts`) builds the factual skeleton for the top match, period by period: the remaining school years, the summer after school, the study or training years, and the first two years of work.
- Each period covers subject choices, a skill goal (e.g. "Move your communication confidence from 3/5 towards 4/5", with an activity), exploration, applications through the state's admissions centre, a backup route and starting roles.
- With `ANTHROPIC_API_KEY` set, Claude personalises the prose. The response must keep the same careers and journey periods and must not call a student unsuitable; otherwise a deterministic template writes the plan. Scores, pay, durations and evidence are always attached from our data.

### 5. Accounts and storage (`src/lib/auth/`, `supabase/migrations/20261023000000_accounts.sql`)

- **Schools register first.** A careers adviser registers the school: name, state, the email domain(s) students use, and their own account. They confirm their email with a code. A Bcome operator then approves the school (`npm run school -- list`, then `approve <id>`), and the advisers are emailed the school's **join code**, e.g. `K7PM-3QXD`.
- **Students sign up** with the join code and a school email on one of the school's domains. Personal webmail is always refused. They give their first and last name, a username, a password, their school year, and their month and year of birth. That is all Bcome keeps about them. They confirm their email with a code before they can sign in.
- **Sign in** is with a username or school email and a password, on separate tiles for students and advisers (`/login`). Students get an emailed code the first time they use a device; they can trust it for 90 days, or untick that on shared computers. "Remember me" keeps them signed in for 30 days. Advisers get a code at every sign-in and are signed out after 15 minutes without activity.
- **Assessment history**: every Career Profile a signed-in student completes is saved on their account with its answers, profile, Career DNA, matches and plan (`assessments` table). Students see the history on `/account`, and advisers see it on each student's page.
- **Security**: scrypt password hashing, account lockout, rate limits, hashed tokens, an audit log, deny-by-default database access and security headers. See [`docs/security/st4s-controls.md`](docs/security/st4s-controls.md) for how this maps to Safer Technologies 4 Schools.
- Bcome runs its own sign-in rather than Supabase Auth, so it can do usernames, device codes and per-role timeouts. Only the server reads the account tables, with the service role key.

### 6. Screens (`src/app/`, `src/components/`)

- **Discover hub** (`/` for a signed-in student with results, `DiscoverHub.tsx`, `src/lib/activity/`): once a student has a Career Profile, Discover becomes their week. "Retake Career Profile" (`/?retake=1`) shows the questions again.
  - **Weekly Career Missions** (`missions.ts`, `data/missions/missions.json`): one practical task a week (talk to someone, research a course, try a mini project, plan work experience…), chosen from the 20 missions that fit the student's top careers, year level, state and study preference. It rotates through their top three careers and doesn't repeat a mission within six weeks. Completing it needs a short note on what they did, and can add it to the portfolio. Points: 50, 75 or 100 by effort, plus 10 for every week in a row (up to 50). Weeks run Monday to Sunday in the school's time zone, and one mission counts per week.
  - **Real-World Action Cards** (`cards.ts`): each month, prompts to talk to someone in their top career, investigate a specific course from their results, find out about their second career, and go to calendar events that suit their year level and career areas. Students mark cards done or "not now".
  - **Opportunity calendar** (`OpportunityCalendar.tsx`): a month view of the school's events (open days, work experience, competitions, expos, talks, workshops, key dates). Events that suit the student's career areas are starred, and students can mark "I'm interested". It's also on the student's profile.
  - **Skills Evidence Portfolio** (`Portfolio.tsx`, `evidence.ts`): entries from school, sport, work, volunteering and other activities, with dates, a description and up to eight skills (employability skills plus skills from their career matches). Phone numbers and email addresses are refused.
  - **CV** (`/account/cv`, `cv.ts`, `docx.ts`): turns the portfolio into a CV with a drafted career objective, education, key skills and experience sections. Students add contact details (kept in the browser only), edit the objective, choose sections, then download a Word file (built in the browser), print or save as PDF, or copy it as text.
- **Discover** (`/`, `Discover.tsx`): the questionnaire shows up to three questions per page within a section. It uses likert pills, colour-coded activity cards for the ranking, a five-point slider for the work-style questions and a grid for the subjects. A live RIASEC radar updates as the student answers, next to a "Today's Quest" card and a daily count.
- **Career Matches** (`/plan`, `PlanView.tsx`): the Career DNA is shown first. Then the #1 match appears as a feature card with a personal-fit ring, fit breakdown, highlight tags and "Why this matches you". The other matches follow as illustrated cards with a detail dialog and a shortlist button. The sidebar holds the RIASEC radar, the top profile types, an "Assessment Complete" badge and a shortlist challenge. Careers are always ordered by personal fit, and the ring shows personal fit; the overall match is secondary text.
- **Careers** (`/careers`): browse all 357 careers by area and skill level, 36 at a time, with a search that also matches ANZSCO and ANZSIC codes, and a detail dialog with the jobs market panel. `?career=OSCA` opens one directly; the header search links here.
- **Journey** (`/journey`): the year-by-year plan for the top match.
- **Explore Uni & TAFE** (`/explore`): the qualifications grouped by sector, each linked to the careers it leads to.
- **Occupation pictures** (`OccupationArt.tsx`): licence-free illustrations, one per career family (`family` in the occupation data). To use a real photo, add `"photo": { "src": "/careers/xyz.jpg", "credit": "…" }` to the occupation and put the file in `public/`. The photo then replaces the illustration everywhere.
- **Accounts**: `/login` (two tiles), `/signup`, `/register-school`, `/verify`, `/forgot-password`, `/invite/[token]`, `/privacy`.
- **My profile** (`/account`): the student's details, every saved assessment (each opens as a full results page), password change, trusted devices, sign out everywhere, and delete account.
- **School dashboard** (`/adviser`): students registered and completed, completion by year, the most recommended careers, career areas, RIASEC interest types, pathways and study length, values, enjoyed subjects, students worth a conversation and why, and a searchable student list with CSV export. It filters by year. It also shows missions done this week, students with portfolios and upcoming events. Each student page shows their assessment history, full results, portfolio, completed missions with their notes, and the events they're interested in. **Opportunity calendar** (`/adviser/events`): advisers add, edit and delete events, choose the year levels and career areas they suit, and see how many students are interested. **School settings** (`/adviser/settings`) covers the join code, student email domains, the AI-plans switch, inviting or removing advisers, and the activity log.
- **Progress, XP, levels and streaks** (`src/lib/progress/gamification.ts`): these come only from questions actually answered and days actually visited. They are stored in the student's browser (localStorage), so they don't follow a student between devices yet.

## About the data

- **OSCA codes:** `oscaSource: "abs"` marks codes seen in the ABS OSCA 2024 publication itself. `"correspondence"` marks codes taken from the ABS ANZSCO–OSCA correspondence table as republished at ozlinks.au. Check them against [the ABS data downloads](https://www.abs.gov.au/statistics/classifications/osca-occupation-standard-classification-australia/2024-version-1-0/data-downloads) before launch. The ABS is consulting on an updated OSCA draft (August 2026), so codes may change.
- **National Skills Taxonomy:** JSA hasn't published taxonomy data yet; it's still in consultation. The skills scheme follows the data model JSA has described: SKOS-style concepts with a preferred label and broader grouping, linked to OSCA occupations and qualifications. Each skill has an empty `nstExactMatch` field ready for the official concept ID, so the taxonomy can be swapped in without changing the app.
- **ANZSCO and JSA profiles:** retrieved 22 October 2026 from jobsandskills.gov.au (CC BY 4.0, attribute JSA; ABS source data). 6-digit codes were checked against the ABS ANZSCO 2022 pages. Past-year change is not a projection. Refresh the JSON when JSA updates its profiles and run `npm run data:validate`.
- **ATARs:** taken from each university's own published page or guide, with what the number means kept alongside it (`guaranteed`, `indicative` selection rank, `minimum`, or just `published`). Sources: University of Sydney 2027 admission guide (indicative), Monash and UQ and QUT guaranteed ATARs 2027, Deakin's find-a-course-by-ATAR page (year not stated), Curtin course pages, and TISC 2026 prerequisites for WA. There's no SA, TAS, ACT or NT data yet. ATARs change every year, so refresh before each admissions round.
- **TAFE requirements:** from TAFE NSW course pages only. Other states' TAFEs set their own; students in other states see a note saying so.
- **Pay:** indicative ranges for full-time work before tax, excluding super. They are Bcome editorial estimates from typical 2025 award and market rates, not JSA or ABS data. Import JSA median earnings (below) and plans will show them alongside.
- **Time to qualify:** the typical full-time range on the most common route.
- **Qualification codes:** VET codes marked `verifyCode: true` may have been superseded; check them on training.gov.au.
- **Editorial content:** the occupation profiles (interests, skills, values, environment), Holland codes, subjects, skills, pathways and entry competitiveness are judgements for guidance and should be reviewed by a careers professional.
- **Opportunity indicators:** shortage, regional breadth, graduate outcomes, and AI automation and augmentation are Bcome estimates for now. Each career's `evidence` field names its source and the dataset that should replace it: the JSA Occupation Shortage List, JSA NERO, QILT/NCVER outcomes, and the JSA Gen AI Transition study. The app shows these sources on each career card.
- **Weights:** the weights follow the requirements document. They should be tested and, once there's enough student feedback, calibrated.

## Getting started

Requires Node 22.18 or later.

```bash
npm install
cp .env.example .env.local   # fill in Supabase and (optionally) Anthropic keys
npm run dev                  # http://localhost:3000
```

Without Supabase, `npm run dev` keeps accounts in memory and loads a **demo school** with 28 invented students and their assessments. The sign-in details are printed in the terminal (adviser `demo.adviser`, student `demo.student`, password `Careers demo 2026!`, school code `DEMO-2026`). Email codes are printed there too instead of being sent. The demo school also has sample calendar events, portfolios and a few weeks of missions. Data is lost when the server restarts.

### A test school in your real database

To try the school administrator side on a deployed site, create a test school in Supabase:

```bash
npm run school -- create-test --email you@example.com
```

It makes an active school, `test.adviser` (codes go to your email), `test.student` (codes go to `you+teststudent@…`; use `--student-email` if your email provider doesn't support plus addressing), 27 made-up classmates with results, portfolios and missions, and sample calendar events. It prints the usernames, a generated password (or pass `--password`) and the join code. Remove it afterwards with `npm run school -- delete-test <id>`, which only deletes schools named "Bcome Test School".

### Supabase and email

1. Create a Supabase project in the **Sydney (ap-southeast-2)** region.
2. Run the migrations in `supabase/migrations/` in order, then `supabase/seed.sql` (SQL editor or `supabase db push`). The accounts migration replaces the earlier Supabase-Auth tables, which held no data.
3. Schedule the clean-up job: `select cron.schedule('bcome-purge', '17 3 * * *', 'select public.purge_expired()');`
4. Set `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET` (`openssl rand -base64 48`) and `APP_URL`.
5. Email: verify your sending domain in Amazon SES (Sydney), create an IAM key limited to `ses:SendEmail`, and set `EMAIL_PROVIDER=ses` with the AWS variables. Request SES production access so you can email any address.
6. Deploy to Vercel. `vercel.json` pins functions to Sydney.

The browser never reads the account or activity tables: row level security is on with no policies, and anon and authenticated roles have no privileges. `supabase/tests/accounts-checks.sql` and `activity-checks.sql` check this and the constraints on plain Postgres:

```bash
psql -d test -f supabase/tests/local-auth-stub.sql $(for f in supabase/migrations/*.sql; do echo "-f $f"; done) -f supabase/tests/accounts-checks.sql -f supabase/tests/activity-checks.sql
```

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (questionnaire, scores, skills graph, outlook, plan validation, importers, accounts and sign-in, adviser dashboard, missions, portfolio, calendar and CV) |
| `npm run school -- list` | Schools waiting for approval; `approve <id>`, `suspend <id>`, `activate <id>`, `create-test --email …`, `delete-test <id>` |
| `npm run test:profiles` | Runs six imaginary students through the whole pipeline and writes their plans to `test-output/` |
| `npm run data:validate` | Checks the JSON in `data/` after edits |
| `npm run data:import-labour -- --projections <xlsx> --tnv <xlsx> --ivi <xlsx> --industry <xlsx> --osl <xlsx>` | Imports the JSA workbooks into `data/` (needs Python 3 with `openpyxl`) |
| `npm run data:import-jsa -- <file.xlsx>` | Older importer for projections only (needs the `xlsx` package) |
| `npm run data:import-earnings -- <file.csv>` | Loads JSA median weekly earnings by OSCA code |
| `npm run db:seed-sql` | Rebuilds `supabase/seed.sql` from `data/` |

### Refreshing the JSA labour market data

The data in `data/outlook/jsa-2025.json` and `data/labour/` comes from these Jobs and Skills Australia workbooks: Employment Projections (May 2025 to May 2035), Total New Vacancies, Internet Vacancies by ANZSCO skill level and state, Labour Force Trending: National Industry Trend, and the Occupation Shortage List key findings. When JSA publishes new editions:

1. Download them into `data/raw/` (not committed).
2. `pip install openpyxl`, then run `npm run data:import-labour -- --projections data/raw/<projections>.xlsx --tnv data/raw/<tnv>.xlsx --ivi data/raw/<ivi>.xlsx --industry data/raw/<industry>.xlsx --osl data/raw/<osl>.xlsx` (any subset works).
3. Run `npm run data:validate`, `npm test` and `npm run db:seed-sql`, then re-run the seed.

New saved results take their vacancy snapshot from whatever data is loaded when the student finishes; older results keep the figures they were saved with.

### Loading JSA median earnings

1. From the JSA occupation profiles (OSCA edition), make a CSV with the columns `osca,medianWeekly,name`. Use 6-digit occupation or 4-digit unit group codes.
2. Run `npm run data:import-earnings -- data/raw/earnings.csv`. Plans will then show "JSA median about $X" next to the indicative range.

## Editing content

Careers advisers can edit content without touching code:

- **Questions** (`data/questions/career-profile.json`): wording, scales and options. Keep 36 numbered questions so results stay comparable, and bump `version` when wording changes.
- **Occupations** (`data/occupations/occupations.json`): OSCA code, profile (interests, skills, values, environment), market indicators with evidence, subjects, skills, pathways, time to qualify, pay range and entry competitiveness.
- **Skills and qualifications** (`data/skills/skills.json`, `data/skills/qualifications.json`).
- **Weekly missions** (`data/missions/missions.json`): mission wording, steps, effort and who they suit (`requires`, `years`, `lead`), the points, and a mini-project idea for each career area. Placeholders like `{career}` and `{course}` are filled from each student's results.
- **Courses** (`data/courses/offerings.json`): to add a university, add a `sources` entry (provider, URL, `kind`, year), then `university` entries pointing at a Bcome `qualificationId` (a `higher-ed` qualification). Write prerequisites the way the state names its subjects ("Mathematics Methods", "Chemistry"); Bcome matches common ones to the student's subjects and never flags ones it can't read. TAFE entries need a `vet` qualification, the provider's code and URL, and at least one requirement. Then run `npm run db:seed-sql` to refresh the database seed.

Run `npm run data:validate` after any edit.

## Sample output

`docs/sample-plans/` has the full output for the six test students (Career DNA, grouped careers with all three scores, explanations and journey), generated by the template writer. They're the quickest way to review matching quality.

## Known limitations

- Not yet built from the requirements document:
  - the six-monthly "What's changed?" check-in;
  - the career explorer ("What would my life look like if I chose this?"); `/careers` is a simple browser for now;
  - a district or system-level view across several schools (each school has its own adviser dashboard);
  - the Azure / Python (FastAPI) architecture the document recommends. This build stays on Next.js + Supabase; the scoring logic is self-contained and can be ported.

- The 294 careers generated from JSA unit groups have estimated profiles and pay, and no OSCA code yet. Attach the ABS ANZSCO–OSCA correspondence file to map them.
- Vacancies are published for occupation groups, not single jobs; the per-job number is Bcome's estimate from employment shares. Industry data is national and the industry for each career is an estimate of where most people in that job work.
- Pay ranges are estimates until JSA earnings are imported; scoring already uses JSA profile median earnings.
- Course data covers NSW, VIC, QLD and WA universities and TAFE NSW only. Some prerequisites are generic ("Mathematics prerequisite") where the source didn't give the band or level.
- Subject names are generic; NSW, VIC and QLD course names differ. State-specific subject lists are a good next step.
- Sign-in is username and password plus email codes; Google or Microsoft single sign-on for schools isn't built yet.
- The privacy notice (`/privacy`) is a draft and needs legal review before launch.
- The Next.js app hasn't yet been built against installed packages in CI. Run `npm run build` after `npm install` and fix anything it flags.

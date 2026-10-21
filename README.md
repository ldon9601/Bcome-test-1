# Bcome

An automated career advisor for Australian students in Years 10–12. Students answer an adaptive RIASEC (Holland) questionnaire. Bcome scores every career on **personal fit**, **future opportunity** and **pathway feasibility**, using Jobs and Skills Australia (JSA) employment projections and a skills layer that links qualifications to the jobs they lead to. Each student gets a plan for the rest of school, study or training, and their first years at work, with rough pay ranges and time to qualify.

## How it works

1. **Adaptive questionnaire** (`src/lib/questionnaire/`, questions in `data/questions/riasec-au.json`). Everyone answers 18 interest items (3 per RIASEC type), 10 work-value items, subjects and plans. Deeper interest items are only asked for the types whose ranking is still unclear. A student with clear interests answers about 35 questions; a mixed profile answers up to 65.
2. **Occupations on OSCA** (`data/occupations/occupations.json`). Each of the 63 careers is identified by its ABS **OSCA 2024** code: a 6-digit occupation, or a 4-digit unit group for broad careers such as Registered Nurse (2654). The ANZSCO 2022 unit group is kept only to join JSA's 2025 projections, which are still published on ANZSCO.
3. **Skills layer** (`data/skills/`, `src/lib/careers/skills.ts`). It connects **skills ↔ qualifications ↔ occupations**:
   - 75 specialist skills in 8 clusters, plus the 10 Australian Skills Classification core competencies.
   - 76 qualifications. VET entries use their training.gov.au code (e.g. UEE30820) and AQF level; university entries are course types with an ASCED field of education code.
   - Every career lists its skills and its pathways (university, TAFE/VET, apprenticeship, traineeship, cadetship or other), each pathway linked to a qualification.
   - From these links Bcome works out which skills a course builds for a job, which careers share skills, and how *portable* a career's skills are.
4. **Three scores** (`src/lib/careers/matching.ts`), each 0–100 with the reasons and cautions behind it:

   | Score | What it measures | Made up of |
   | --- | --- | --- |
   | Personal fit | How well the work suits the student | Interests 65%, values 20%, subjects they enjoy or are strong in 15% |
   | Future opportunity | How the job market is likely to treat the career over 5–15 years | JSA-based outlook (10-year band and indicative 15-year band) 75%, skill portability to other growing careers 25% |
   | Pathway feasibility | How realistic the way in is for this student now | Matches their preferred route 35%, prerequisite subjects for their year level 25%, competition for places 20%, time to qualify 10%, number of routes 10% |

   The overall match ranks careers: personal fit 50%, future opportunity 25%, pathway feasibility 25%.
5. **Outlook** (`src/lib/careers/outlook.ts`):
   - **5 and 10 years:** JSA projections to May 2035. Where an occupation's own figure isn't loaded, it's estimated from its major group adjusted for industry growth, labelled as an estimate, and never rated above "good".
   - **15 years:** an indicative scenario, not a forecast. The 10-year band moves up for long-run demand drivers and down for high exposure to AI and automation.
6. **Career facts** (`src/lib/careers/facts.ts`):
   - **Pay:** a rough AUD range, starting and experienced.
   - **Time to qualify:** years after Year 12, and from now.
   - **Pathways:** each with its qualification, AQF level and the skills it builds.
   - **Related careers:** careers that share the same skills.

   These facts come from `/data` and are attached to the plan after it is written, so the AI never makes up a salary or a duration.
7. **Plan** (`src/lib/plan/`). With `ANTHROPIC_API_KEY` set, Claude writes the plan from the matched data only. The response is validated: it must have the right shape and may only name careers we supplied. If validation fails, or there's no key, a deterministic template writes the plan instead, so students always get one.

## About the data

- **OSCA codes:** `oscaSource: "abs"` marks codes seen in the ABS OSCA 2024 publication itself. `"correspondence"` marks codes taken from the ABS ANZSCO–OSCA correspondence table as republished at ozlinks.au. Check them against [the ABS data downloads](https://www.abs.gov.au/statistics/classifications/osca-occupation-standard-classification-australia/2024-version-1-0/data-downloads) before launch. The ABS is consulting on an updated OSCA draft (August 2026), so codes may change.
- **National Skills Taxonomy:** JSA hasn't published taxonomy data yet; it's still in consultation. The skills scheme follows the data model JSA has described: SKOS-style concepts with a preferred label and broader grouping, linked to OSCA occupations and qualifications. Each skill has an empty `nstExactMatch` field ready for the official concept ID, so the taxonomy can be swapped in without changing the app.
- **Pay:** indicative ranges for full-time work before tax, excluding super. They are Bcome editorial estimates from typical 2025 award and market rates, not JSA or ABS data. Import JSA median earnings (below) and plans will show them alongside.
- **Time to qualify:** the typical full-time range on the most common route.
- **Qualification codes:** VET codes marked `verifyCode: true` may have been superseded; check them on training.gov.au.
- **Editorial content:** Holland codes, values, subjects, skills, pathways, AI exposure and entry competitiveness are judgements for guidance and should be reviewed by a careers professional.

## Getting started

Requires Node 22.18 or later.

```bash
npm install
cp .env.example .env.local   # fill in Supabase and (optionally) Anthropic keys
npm run dev                  # http://localhost:3000
```

The questionnaire and plans work without Supabase. Accounts and saving switch on once the Supabase variables are set.

### Supabase

1. Create a project in the **Sydney (ap-southeast-2)** region.
2. Run the migrations in `supabase/migrations/` in order, then `supabase/seed.sql`. Use the SQL editor or `supabase db push`.
3. In Auth settings, enable email sign-in and add `<your-site>/auth/callback` as a redirect URL.

Row Level Security:
- Students see their own data.
- Careers advisers see students at their school.
- Parents see their child's plans only after the server links them (when a student invites them) and the parent consents.
- Advisers can mark a plan reviewed but can't edit it.
- Reference data (occupations, skills, qualifications, pathways) is readable by anyone and writable only by the service role.

`supabase/tests/rls-checks.sql` exercises these rules on plain Postgres. The `pathway_skills` view lists which skills each qualification builds for each job.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (questionnaire, scores, skills graph, outlook, plan validation, importers) |
| `npm run test:profiles` | Runs six imaginary students through the whole pipeline and writes their plans to `test-output/` |
| `npm run data:validate` | Checks the JSON in `data/` after edits |
| `npm run data:import-jsa -- <file.xlsx>` | Loads occupation-level JSA projections |
| `npm run data:import-earnings -- <file.csv>` | Loads JSA median weekly earnings by OSCA code |
| `npm run db:seed-sql` | Rebuilds `supabase/seed.sql` from `data/` |

### Loading the full JSA projections

`data/outlook/jsa-2025.json` holds the published summary figures: major groups, industries, skill levels and seven named occupations. To use projections for every occupation:

1. Download *Employment Projections – May 2025 to May 2035.xlsx* from <https://www.jobsandskills.gov.au/data/employment-projections> into `data/raw/`.
2. Run `npm run data:import-jsa -- data/raw/<file>.xlsx --dry-run` to check the columns it found, then run it again without `--dry-run`.
3. Run `npm run db:seed-sql` and re-run the seed.

### Loading JSA median earnings

1. From the JSA occupation profiles (OSCA edition), make a CSV with the columns `osca,medianWeekly,name`. Use 6-digit occupation or 4-digit unit group codes.
2. Run `npm run data:import-earnings -- data/raw/earnings.csv`. Plans will then show "JSA median about $X" next to the indicative range.

## Editing content

Careers advisers can edit content without touching code:

- **Questions** (`data/questions/riasec-au.json`): tier 1 items are always asked; tier 2 and 3 only when needed. Conditional questions use `showIf`.
- **Occupations** (`data/occupations/occupations.json`): OSCA code, Holland code, values, subjects, skills, pathways, time to qualify, pay range, entry competitiveness, AI exposure and demand drivers.
- **Skills and qualifications** (`data/skills/skills.json`, `data/skills/qualifications.json`).

Run `npm run data:validate` after any edit.

## Sample output

`docs/sample-plans/` has plans for the six test students, generated by the template writer, with all three scores, pay, years and skills. They're the quickest way to review matching quality.

## Known limitations

- Only the 7 occupations JSA names in its summary have occupation-level projections until the full file is imported; the rest use labelled estimates.
- Pay ranges are estimates until JSA earnings are imported.
- Subject names are generic; NSW, VIC and QLD course names differ. State-specific subject lists are a good next step.
- The Next.js app hasn't yet been built against installed packages in CI. Run `npm run build` after `npm install` and fix anything it flags.

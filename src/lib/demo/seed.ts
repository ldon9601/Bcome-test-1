import { advise, resultPayload } from "../advise.ts";
import { localDate, missionForWeek, mondayOf, shiftWeek, weekOf } from "../activity/missions.ts";
import { studentContext } from "../activity/student.ts";
import type { EventInput, EvidenceInput, MissionCompletion } from "../activity/types.ts";
import { hashPassword } from "../auth/crypto.ts";
import type { AuthService } from "../auth/service.ts";
import type { AuState } from "../auth/validation.ts";
import { ALGORITHM_VERSION } from "../careers/matching.ts";
import { questionBank, subjectLabels } from "../data.ts";
import { PERSONAS, simulate, type Persona } from "./personas.ts";

/**
 * A made-up school with students, assessments, portfolios, missions and calendar events, so the
 * adviser dashboard and the student Discover hub can be tried out. Used automatically with the
 * in-memory store (local development), and by `npm run school -- create-test` to make a test
 * school in a real database.
 */

export const DEMO = {
  schoolName: "Demo Secondary College",
  adviserUsername: "demo.adviser",
  studentUsername: "demo.student",
  password: "Careers demo 2026!",
  domain: "students.demo.nsw.edu.au",
} as const;

export interface SeedOptions {
  students?: number;
  now?: Date;
  school?: { name: string; state: AuState; joinCode: string; studentDomains: string[] };
  adviser?: { username: string; email: string; firstName: string; lastName: string };
  /** The student account to sign in as. */
  student?: { username: string; email: string; firstName: string; lastName: string };
  password?: string;
  /** Domain for the made-up classmates' email addresses (they never sign in). */
  classmateDomain?: string;
  /** Prefix for the made-up classmates' usernames, so they can't clash with real accounts. */
  classmatePrefix?: string;
}

const FIRST = ["Olivia", "Noah", "Charlotte", "Jack", "Amelia", "Leo", "Isla", "Oliver", "Mia", "William", "Ava", "Henry", "Grace", "Thomas", "Zara", "Lucas", "Chloe", "Ethan", "Ruby", "Arjun", "Mei", "Kai", "Sienna", "Hamish", "Priya", "Tane", "Layla", "Finn", "Aisha", "Sam"];
const LAST = ["Nguyen", "Smith", "Patel", "Williams", "Chen", "Brown", "Kaur", "Jones", "Wilson", "Taylor", "Singh", "Martin", "Lee", "Anderson", "Walker", "Kelly", "Tran", "Ryan", "Murphy", "Hughes", "Ali", "Campbell", "Wright", "Roberts", "Khan", "Davies", "Lim", "Morgan", "Cooper", "Ward"];

const SAMPLE_EVIDENCE: EvidenceInput[] = [
  { category: "work", title: "Casual café attendant", organisation: "Local café", startMonth: "", endMonth: null, description: "Serve customers, take orders and payments, and help close the café on weekends. Trained two new starters on the coffee machine.", skills: ["Customer service", "Teamwork", "Reliability", "Working with numbers"] },
  { category: "volunteering", title: "Junior volunteer, community food pantry", organisation: "Community centre", startMonth: "", endMonth: null, description: "Sort donations and pack food hampers once a fortnight. Helped organise a school food drive that collected over 300 items.", skills: ["Organisation and time management", "Teamwork", "Initiative"] },
  { category: "school", title: "Student Representative Council member", organisation: null, startMonth: "", endMonth: null, description: "Represent my year group at fortnightly meetings and helped run the school's mental health awareness week.", skills: ["Communication", "Leadership", "Organisation and time management"] },
  { category: "sport", title: "Captain, under-16 netball team", organisation: "Local netball club", startMonth: "", endMonth: null, description: "Lead warm-ups, talk with the umpires and help newer players settle in. Our team made the semi-finals this season.", skills: ["Leadership", "Teamwork", "Resilience"] },
  { category: "school", title: "Science competition entry", organisation: null, startMonth: "", endMonth: null, description: "Designed and ran an experiment on how water temperature affects seed germination, and presented the results to judges.", skills: ["Problem solving", "Working with numbers", "Communication"] },
  { category: "other", title: "Built a website for my family's small business", organisation: null, startMonth: "", endMonth: null, description: "Taught myself HTML and CSS with free tutorials and built a simple site with opening hours, prices and a contact form.", skills: ["Working with technology", "Learning new things quickly", "Initiative"] },
];

const REFLECTIONS = [
  "I found out the course needs Maths Advanced, so I'm going to talk to my adviser about switching next year.",
  "Watched two videos. I'd enjoy working with patients but not sure about night shifts.",
  "My aunt's friend works in this job. She said the first year is hard but she loves the variety.",
  "Added my weekend job to my portfolio and tagged customer service and teamwork.",
  "Made a list of three places that take work experience students and asked my mum to check my email.",
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function vary(p: Persona, r: () => number, yearLevel: 10 | 11 | 12): Persona {
  const j = <K extends string>(o: Record<K, number>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.max(1, Math.min(5, (v as number) + Math.round((r() - 0.5) * 2.2)))])) as Record<K, number>;
  return { ...p, yearLevel, interests: j(p.interests), skills: j(p.skills), values: j(p.values), styles: j(p.styles) };
}

const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
const addMonths = (ym: string, n: number) => {
  const d = new Date(`${ym}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

/** Sample calendar events around today, so the opportunity calendar has something to show. */
export function sampleEvents(today: string): EventInput[] {
  const d = (n: number) => addDays(today, n);
  const note = "Sample event added for testing. Edit or delete it from the Opportunity calendar page.";
  return [
    { kind: "open_day", title: "University open day", startsOn: d(9), endsOn: null, time: "9am to 4pm", location: "Main campus", url: null, description: `Tour the campus, sit in on mini lectures and talk to current students. ${note}`, yearLevels: [11, 12], families: [] },
    { kind: "talk", title: "Health careers talk with local hospital staff", startsOn: d(4), endsOn: null, time: "Lunchtime, Library", location: "School library", url: null, description: `A nurse, a paramedic and a physiotherapist talk about their jobs and how they got there. ${note}`, yearLevels: [], families: ["health", "care", "fitness"] },
    { kind: "competition", title: "Engineering challenge day", startsOn: d(16), endsOn: null, time: "All day", location: "School hall", url: null, description: `Teams design and build a bridge from limited materials. Sign up with your science teacher. ${note}`, yearLevels: [10, 11], families: ["engineering", "tech", "science", "data", "built"] },
    { kind: "work_experience", title: "Year 10 work experience week", startsOn: d(23), endsOn: d(27), time: null, location: null, url: null, description: `Placements must be confirmed with the careers office two weeks before. ${note}`, yearLevels: [10], families: [] },
    { kind: "workshop", title: "Trades taster day at TAFE", startsOn: d(30), endsOn: null, time: "9am to 2pm", location: "Local TAFE campus", url: null, description: `Try carpentry, electrotechnology and automotive in hands-on sessions. Bus leaves at 8.15am. ${note}`, yearLevels: [10, 11], families: ["trades", "workshop", "built", "engineering", "transport"] },
    { kind: "expo", title: "Regional careers expo", startsOn: d(37), endsOn: null, time: "10am to 2pm", location: "Showground pavilion", url: null, description: `Universities, TAFEs, employers and the Defence Force in one place. ${note}`, yearLevels: [], families: [] },
    { kind: "deadline", title: "Subject selection forms due", startsOn: d(12), endsOn: null, time: null, location: null, url: null, description: `Check your subjects against the prerequisites for courses you're interested in first. ${note}`, yearLevels: [10, 11], families: [] },
    { kind: "talk", title: "Creative industries panel", startsOn: d(-12), endsOn: null, time: "Period 5", location: "Drama room", url: null, description: `A graphic designer, a sound engineer and a marketing manager. ${note}`, yearLevels: [], families: ["creative", "performing", "business"] },
  ];
}

export async function seedDemoSchool(service: AuthService, opts: SeedOptions = {}) {
  const { store } = service;
  const now = opts.now ?? service.now();
  const r = rng(20261022);
  // Activity uses its own sequence so the assessments are the same as before activity existed.
  const ra = rng(20261025);
  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 3600e3).toISOString();
  const schoolSpec = opts.school ?? { name: DEMO.schoolName, state: "NSW" as AuState, joinCode: "DEMO-2026", studentDomains: [DEMO.domain] };
  const school = await store.createSchool({ ...schoolSpec, status: "active", allowAiPlans: false, createdAt: iso(240), approvedAt: iso(239) });
  const password = opts.password ?? DEMO.password;
  const passwordHash = await hashPassword(password, service.hashCost);
  const base = { passwordHash, failedLogins: 0, lockedUntil: null, lastLoginAt: null, schoolId: school.id };
  const adviserSpec = opts.adviser ?? { username: DEMO.adviserUsername, email: "demo.adviser@demo.nsw.edu.au", firstName: "Jordan", lastName: "Reid" };
  const adviser = await store.createUser({ ...base, ...adviserSpec, role: "adviser", yearLevel: null, birthYear: null, birthMonth: null, emailVerifiedAt: iso(239), createdAt: iso(239) });
  const studentSpec = opts.student ?? { username: DEMO.studentUsername, email: `${DEMO.studentUsername}@${DEMO.domain}`, firstName: FIRST[0], lastName: LAST[0] };
  const classmates = opts.classmateDomain ?? schoolSpec.studentDomains[0];
  const today = localDate(now, schoolSpec.state);
  const week = weekOf(today);

  // Calendar
  const events = [];
  for (const e of sampleEvents(today)) events.push(await store.createEvent({ ...e, schoolId: school.id, createdBy: adviser.id, createdAt: iso(20), updatedAt: iso(20) }));

  const total = opts.students ?? 28;
  for (let i = 0; i < total; i++) {
    const drawnYear = ([10, 11, 12] as const)[Math.floor(r() * 3)];
    const yearLevel = i === 0 ? 11 : drawnYear;
    const first = i === 0 ? studentSpec.firstName : FIRST[i % FIRST.length];
    const last = i === 0 ? studentSpec.lastName : LAST[(i * 7) % LAST.length];
    const username = i === 0 ? studentSpec.username : `${opts.classmatePrefix ? `${opts.classmatePrefix}.` : ""}${first}.${last}${i}`.toLowerCase().slice(0, 30);
    const user = await store.createUser({
      ...base,
      role: "student",
      username,
      email: i === 0 ? studentSpec.email : `${username}@${classmates}`,
      firstName: first,
      lastName: last,
      yearLevel,
      birthYear: now.getUTCFullYear() - (yearLevel + 5) - (r() < 0.35 ? 1 : 0),
      birthMonth: 1 + Math.floor(r() * 12),
      emailVerifiedAt: iso(200),
      createdAt: iso(200),
    });
    // About one in six students hasn't done the questions yet; some have done them twice.
    if (i > 0 && r() < 0.17) continue;
    const runs = r() < 0.25 ? 2 : 1;
    let latest: { matches: unknown[]; profile: unknown } | null = null;
    for (let k = 0; k < runs; k++) {
      const drawn = PERSONAS[Math.floor(r() * PERSONAS.length)];
      const persona = vary(i === 0 ? PERSONAS[0] : drawn, r, yearLevel);
      const { answers } = simulate(questionBank, persona);
      const result = await advise(answers);
      const completedAt = iso(k === 0 && runs === 2 ? 190 + Math.floor(r() * 20) : Math.floor(r() * 120));
      const payload = resultPayload(result, new Date(completedAt));
      await store.saveAssessment({
        userId: user.id,
        schoolId: school.id,
        completedAt,
        instrumentVersion: result.profile.instrumentVersion,
        algorithmVersion: ALGORITHM_VERSION,
        yearLevel,
        hollandCode: result.profile.riasec.code,
        topOsca: payload.matches[0]?.osca ?? null,
        topTitle: payload.matches[0]?.title ?? null,
        answers,
        profile: result.profile,
        dna: payload.dna,
        matches: payload.matches,
        plan: result.plan,
        ideas: payload.ideas,
      });
      latest = { matches: payload.matches, profile: result.profile };
    }

    // Activity: some portfolio entries, a few weeks of missions and interest in events.
    const ctx = studentContext(user, { state: schoolSpec.state }, latest, subjectLabels);
    const nEvidence = i === 0 ? 3 : ra() < 0.45 ? 1 + Math.floor(ra() * 3) : 0;
    for (let k = 0; k < nEvidence; k++) {
      const sample = SAMPLE_EVIDENCE[(i + k * 2) % SAMPLE_EVIDENCE.length];
      const start = addMonths(today.slice(0, 7), -(3 + Math.floor(ra() * 14)));
      const ended = sample.category === "school" && ra() < 0.5;
      await store.createEvidence({ ...sample, startMonth: start, endMonth: ended ? addMonths(start, 2) : null, userId: user.id, schoolId: school.id, createdAt: iso(30), updatedAt: iso(30) });
    }
    const weeksDone = i === 0 ? 3 : ra() < 0.5 ? Math.floor(ra() * 5) : 0;
    const done: MissionCompletion[] = [];
    const thisWeekToo = i > 0 && weeksDone > 0 && ra() < 0.5;
    for (let k = weeksDone; k >= (thisWeekToo ? 0 : 1); k--) {
      const w = shiftWeek(week, -k);
      const m = missionForWeek(ctx, w, done);
      if (!m) break;
      const c = await store.createMissionCompletion({
        userId: user.id,
        schoolId: school.id,
        week: w,
        missionId: m.id,
        title: m.title,
        careerOsca: m.career?.osca ?? null,
        careerTitle: m.career?.title ?? null,
        reflection: REFLECTIONS[(i + k) % REFLECTIONS.length],
        points: m.points,
        completedAt: k === 0 ? iso(0) : new Date(`${addDays(mondayOf(w), 3)}T05:00:00Z`).toISOString(),
      });
      if (c) done.push(c);
    }
    for (const e of events) {
      if (e.startsOn < today) continue;
      if ((!e.yearLevels.length || e.yearLevels.includes(yearLevel)) && ra() < (i === 0 ? 0 : 0.3)) {
        await store.setEventResponse({ userId: user.id, schoolId: school.id, eventId: e.id, createdAt: iso(5) }, true);
      }
    }
  }
  return {
    school,
    password,
    adviserUsername: adviserSpec.username,
    adviserEmail: adviserSpec.email,
    studentUsername: studentSpec.username,
    studentEmail: studentSpec.email,
    domain: schoolSpec.studentDomains[0],
  };
}


export const DEMO_ADMIN = { username: "demo.admin", email: "admin@bcome.local", password: DEMO.password } as const;

/**
 * Local development only: a platform administrator, plus a day of made-up API traffic and
 * sign-in events (from documentation-only IP ranges) so the monitoring dashboard has something
 * to show. Never used with a real database.
 */
export async function seedDemoAdmin(service: AuthService, now = service.now()) {
  const r = await service.createPlatformAdmin({ firstName: "Platform", lastName: "Administrator", email: DEMO_ADMIN.email, username: DEMO_ADMIN.username, password: DEMO_ADMIN.password, emailVerified: true });
  if (!r.ok) throw new Error(r.error);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ips = ["203.0.113.14", "203.0.113.52", "198.51.100.23", "198.51.100.77", "192.0.2.41", "203.0.113.90", "2001:db8::1a"];
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  ];
  const paths: [string, string, number][] = [
    ["POST", "/api/auth/sign-in", 0.18],
    ["POST", "/api/auth/verify", 0.08],
    ["POST", "/api/plan", 0.12],
    ["GET", "/api/careers/A2544/labour", 0.2],
    ["GET", "/api/careers/261313/labour", 0.14],
    ["POST", "/api/activity/mission", 0.1],
    ["POST", "/api/activity/evidence", 0.1],
    ["POST", "/api/adviser/join-code", 0.03],
    ["POST", "/api/account/year-level", 0.05],
  ];
  const pick = () => {
    let x = rand();
    for (const p of paths) if ((x -= p[2]) <= 0) return p;
    return paths[0];
  };
  const entries = [];
  for (let i = 0; i < 520; i++) {
    // Busier in school hours (Sydney), quieter overnight.
    const hoursAgo = rand() * 24;
    const hourSyd = (now.getUTCHours() + 11 - hoursAgo + 48) % 24;
    if ((hourSyd < 7 || hourSyd > 21) && rand() < 0.8) continue;
    const [method, path] = pick();
    const ip = ips[Math.floor(rand() ** 1.6 * ips.length)];
    const status = rand() < 0.012 ? 500 : path.endsWith("sign-in") && rand() < 0.15 ? 401 : 200;
    entries.push({ at: new Date(now.getTime() - hoursAgo * 3600e3).toISOString(), method, path, status, ms: Math.round(25 + rand() ** 3 * (path === "/api/plan" ? 2400 : 400)), ip, userAgent: agents[Math.floor(rand() * agents.length)] });
  }
  for (const e of entries.sort((a, b) => a.at.localeCompare(b.at))) await service.store.logRequest(e);
  // Someone trying passwords from one address.
  for (let i = 0; i < 7; i++) {
    const at = new Date(now.getTime() - (3 * 3600e3 - i * 40e3)).toISOString();
    await service.store.logRequest({ at, method: "POST", path: "/api/auth/sign-in", status: 401, ms: 310, ip: "198.51.100.200", userAgent: "python-requests/2.32" });
    await service.store.audit({ at, event: "login.failed", actorId: null, schoolId: null, targetId: null, ip: "198.51.100.200", detail: { username: "demo.adviser" } });
  }
  return DEMO_ADMIN;
}

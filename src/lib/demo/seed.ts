import { advise, resultPayload } from "../advise.ts";
import { hashPassword } from "../auth/crypto.ts";
import type { AuthService } from "../auth/service.ts";
import { ALGORITHM_VERSION } from "../careers/matching.ts";
import { questionBank } from "../data.ts";
import { PERSONAS, simulate, type Persona } from "./personas.ts";

/**
 * A made-up school with students and assessments, so the adviser dashboard can be tried locally
 * without a database. Only used with the in-memory store; never in production.
 */

export const DEMO = {
  schoolName: "Demo Secondary College",
  adviserUsername: "demo.adviser",
  studentUsername: "demo.student",
  password: "Careers demo 2026!",
  domain: "students.demo.nsw.edu.au",
} as const;

const FIRST = ["Olivia", "Noah", "Charlotte", "Jack", "Amelia", "Leo", "Isla", "Oliver", "Mia", "William", "Ava", "Henry", "Grace", "Thomas", "Zara", "Lucas", "Chloe", "Ethan", "Ruby", "Arjun", "Mei", "Kai", "Sienna", "Hamish", "Priya", "Tane", "Layla", "Finn", "Aisha", "Sam"];
const LAST = ["Nguyen", "Smith", "Patel", "Williams", "Chen", "Brown", "Kaur", "Jones", "Wilson", "Taylor", "Singh", "Martin", "Lee", "Anderson", "Walker", "Kelly", "Tran", "Ryan", "Murphy", "Hughes", "Ali", "Campbell", "Wright", "Roberts", "Khan", "Davies", "Lim", "Morgan", "Cooper", "Ward"];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function vary(p: Persona, r: () => number, yearLevel: 10 | 11 | 12): Persona {
  const j = <K extends string>(o: Record<K, number>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.max(1, Math.min(5, (v as number) + Math.round((r() - 0.5) * 2.2)))])) as Record<K, number>;
  return { ...p, yearLevel, interests: j(p.interests), skills: j(p.skills), values: j(p.values), styles: j(p.styles) };
}

export async function seedDemoSchool(service: AuthService, opts: { students?: number; now?: Date } = {}) {
  const { store } = service;
  const now = opts.now ?? service.now();
  const r = rng(20261022);
  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 3600e3).toISOString();
  const school = await store.createSchool({
    name: DEMO.schoolName,
    state: "NSW",
    studentDomains: [DEMO.domain],
    joinCode: "DEMO-2026",
    status: "active",
    allowAiPlans: false,
    createdAt: iso(240),
    approvedAt: iso(239),
  });
  const passwordHash = await hashPassword(DEMO.password, service.hashCost);
  const base = { passwordHash, failedLogins: 0, lockedUntil: null, lastLoginAt: null, schoolId: school.id };
  await store.createUser({
    ...base,
    role: "adviser",
    username: DEMO.adviserUsername,
    email: "demo.adviser@demo.nsw.edu.au",
    firstName: "Jordan",
    lastName: "Reid",
    yearLevel: null,
    birthYear: null,
    birthMonth: null,
    emailVerifiedAt: iso(239),
    createdAt: iso(239),
  });
  const total = opts.students ?? 28;
  for (let i = 0; i < total; i++) {
    const yearLevel = ([10, 11, 12] as const)[Math.floor(r() * 3)];
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    const username = i === 0 ? DEMO.studentUsername : `${first}.${last}${i}`.toLowerCase();
    const user = await store.createUser({
      ...base,
      role: "student",
      username,
      email: `${username}@${DEMO.domain}`,
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
    for (let k = 0; k < runs; k++) {
      const persona = vary(PERSONAS[Math.floor(r() * PERSONAS.length)], r, yearLevel);
      const { answers } = simulate(questionBank, persona);
      const result = await advise(answers);
      const payload = resultPayload(result);
      await store.saveAssessment({
        userId: user.id,
        schoolId: school.id,
        completedAt: iso(k === 0 && runs === 2 ? 190 + Math.floor(r() * 20) : Math.floor(r() * 120)),
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
      });
    }
  }
  return { school, ...DEMO };
}

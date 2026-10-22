import missionsJson from "../../../data/missions/missions.json" with { type: "json" };
import type { AuState } from "../auth/validation.ts";
import type { CareerRef, StudentContext } from "./student.ts";
import type { MissionCompletion } from "./types.ts";

/**
 * Weekly Career Missions: one practical task a week, chosen from the library for this student's
 * results and rotated through their top careers. Missions are worked out on the fly (nothing is
 * stored until a student completes one), so the same student sees the same mission all week.
 */

export type MissionKind = "talk" | "research" | "do" | "reflect" | "explore" | "apply";
export type Effort = "quick" | "standard" | "stretch";
type Requirement = "course" | "tafe" | "jsa" | "challenge";

export interface MissionTemplate {
  id: string;
  kind: MissionKind;
  effort: Effort;
  title: string;
  why: string;
  steps: string[];
  requires?: Requirement[];
  lead?: "university" | "tafe";
  years?: number[];
  link?: { label: string; url: string };
}

export interface MissionLibrary {
  version: string;
  points: { quick: number; standard: number; stretch: number; streakBonusPerWeek: number; streakBonusMax: number };
  missions: MissionTemplate[];
  projects: Record<string, string>;
}

export const missionLibrary = missionsJson as unknown as MissionLibrary;

export interface Mission {
  id: string;
  week: string;
  kind: MissionKind;
  effort: Effort;
  title: string;
  why: string;
  steps: string[];
  link: { label: string; url: string } | null;
  career: { osca: string; title: string } | null;
  /** Points for completing it this week, including any streak bonus. */
  points: number;
  basePoints: number;
  streakBonus: number;
}

// ---------------------------------------------------------------------------
// Weeks: ISO weeks (Monday to Sunday) in the school's time zone.
// ---------------------------------------------------------------------------

export const STATE_TIME_ZONE: Record<AuState, string> = {
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  VIC: "Australia/Melbourne",
  TAS: "Australia/Hobart",
  QLD: "Australia/Brisbane",
  SA: "Australia/Adelaide",
  NT: "Australia/Darwin",
  WA: "Australia/Perth",
};

/** "YYYY-MM-DD" for this instant in the state's time zone. */
export function localDate(now: Date, state: AuState): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STATE_TIME_ZONE[state], year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const DAY = 24 * 3600e3;
const utc = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** ISO week key, e.g. "2026-W43", for a "YYYY-MM-DD" date. */
export function weekOf(date: string): string {
  const d = utc(date);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(d.getTime() + (3 - dow) * DAY);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY);
  const n = Math.floor((thursday.getTime() - week1Monday.getTime()) / (7 * DAY)) + 1;
  return `${year}-W${String(n).padStart(2, "0")}`;
}

/** The Monday ("YYYY-MM-DD") that starts an ISO week. */
export function mondayOf(week: string): string {
  const [y, w] = week.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const week1Monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY);
  return ymd(new Date(week1Monday.getTime() + (w - 1) * 7 * DAY));
}

export function shiftWeek(week: string, by: number): string {
  return weekOf(ymd(new Date(utc(mondayOf(week)).getTime() + by * 7 * DAY)));
}

// ---------------------------------------------------------------------------
// Choosing the mission
// ---------------------------------------------------------------------------

/** Small, stable string hash (FNV-1a) so the choice doesn't change during the week. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const ADMISSIONS_CENTRE: Record<AuState, { name: string; url: string }> = {
  NSW: { name: "UAC", url: "https://www.uac.edu.au" },
  ACT: { name: "UAC", url: "https://www.uac.edu.au" },
  VIC: { name: "VTAC", url: "https://vtac.edu.au" },
  QLD: { name: "QTAC", url: "https://www.qtac.edu.au" },
  WA: { name: "TISC", url: "https://www.tisc.edu.au" },
  SA: { name: "SATAC", url: "https://www.satac.edu.au" },
  NT: { name: "SATAC", url: "https://www.satac.edu.au" },
  TAS: { name: "the University of Tasmania", url: "https://www.utas.edu.au" },
};

const FAMILY_NAMES: Record<string, string> = {
  health: "Health", care: "Care & community", education: "Education", tech: "Technology", data: "Data", engineering: "Engineering",
  built: "Built environment", environment: "Environment", science: "Science", animals: "Animals", business: "Business", creative: "Creative",
  performing: "Performing arts", trades: "Trades", workshop: "Workshop & making", hospitality: "Hospitality", safety: "Safety & defence",
  fitness: "Fitness", transport: "Transport",
};

function fits(m: MissionTemplate, c: CareerRef, s: StudentContext): boolean {
  if (m.years && !m.years.includes(s.yearLevel)) return false;
  if (m.lead && m.lead !== c.lead) return false;
  for (const r of m.requires ?? []) {
    if (r === "course" && !c.course) return false;
    if (r === "tafe" && !c.tafe) return false;
    if (r === "jsa" && !(c.jsa?.employed && c.jsa.medianWeeklyEarnings)) return false;
    if (r === "challenge" && !c.challenge) return false;
  }
  return true;
}

function lowerTitle(title: string): string {
  // "Registered Nurse" -> "registered nurse", but keep acronyms ("ICT Manager" -> "ICT manager").
  return title
    .replace(/\s*\([^)]*\)/g, "")
    .split(" ")
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(" ");
}

export function fill(text: string, c: CareerRef, s: StudentContext, lib: MissionLibrary = missionLibrary): string {
  const centre = ADMISSIONS_CENTRE[s.state];
  const values: Record<string, string> = {
    career: c.title,
    careerLower: lowerTitle(c.title),
    osca: c.osca,
    course: c.course?.course ?? "",
    provider: c.course?.provider ?? "",
    atar: c.course?.atar ?? "on the course page",
    tafeCourse: c.tafe?.course ?? "",
    tafeProvider: c.tafe?.provider ?? "",
    admissionsCentre: centre.name,
    admissionsUrl: centre.url,
    pay: c.jsa?.medianWeeklyEarnings ? `$${c.jsa.medianWeeklyEarnings.toLocaleString("en-AU")} a week` : "",
    employed: c.jsa?.employed ? c.jsa.employed.toLocaleString("en-AU") : "",
    challenge: c.challenge ?? "",
    project: lib.projects[c.family] ?? "Spend an hour learning one task this job involves, and make something that shows what you learned.",
    family: FAMILY_NAMES[c.family] ?? "the same area",
    year: String(s.yearLevel),
  };
  const out = text.replace(/\{(\w+)\}/g, (_m, k: string) => values[k] ?? "");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Consecutive weeks completed immediately before `week`. */
export function streakBefore(week: string, completions: Pick<MissionCompletion, "week">[]): number {
  const done = new Set(completions.map((c) => c.week));
  let n = 0;
  for (let w = shiftWeek(week, -1); done.has(w); w = shiftWeek(w, -1)) n++;
  return n;
}

export function pointsFor(effort: Effort, streak: number, lib: MissionLibrary = missionLibrary) {
  const base = lib.points[effort];
  const bonus = Math.min(lib.points.streakBonusMax, streak * lib.points.streakBonusPerWeek);
  return { base, bonus, total: base + bonus };
}

/**
 * This week's mission for a student, or null if they have no results yet. Rotates through their
 * top three careers week by week, skips missions done in the last six weeks, and picks the same
 * one all week.
 */
export function missionForWeek(s: StudentContext, week: string, completions: Pick<MissionCompletion, "week" | "missionId">[], lib: MissionLibrary = missionLibrary): Mission | null {
  if (!s.careers.length) return null;
  const weekNo = Number(week.slice(-2));
  const career = s.careers[weekNo % Math.min(3, s.careers.length)];
  const eligible = lib.missions.filter((m) => fits(m, career, s));
  const recent = new Set([...completions].sort((a, b) => b.week.localeCompare(a.week)).slice(0, 6).map((c) => c.missionId));
  const fresh = eligible.filter((m) => !recent.has(m.id));
  const pool = fresh.length ? fresh : eligible;
  if (!pool.length) return null;
  const t = pool[hash(`${s.userId}:${week}`) % pool.length];
  const p = pointsFor(t.effort, streakBefore(week, completions), lib);
  return {
    id: t.id,
    week,
    kind: t.kind,
    effort: t.effort,
    title: fill(t.title, career, s, lib),
    why: fill(t.why, career, s, lib),
    steps: t.steps.map((x) => fill(x, career, s, lib)),
    link: t.link ? { label: fill(t.link.label, career, s, lib), url: fill(t.link.url, career, s, lib) } : null,
    career: { osca: career.osca, title: career.title },
    points: p.total,
    basePoints: p.base,
    streakBonus: p.bonus,
  };
}

export interface PointsSummary {
  total: number;
  thisWeek: number;
  /** Weeks in a row with a mission done, counting this week if it's done. */
  streak: number;
  completed: number;
  /** The last eight weeks, oldest first. */
  history: { week: string; monday: string; points: number }[];
}

export function pointsSummary(week: string, completions: Pick<MissionCompletion, "week" | "points">[]): PointsSummary {
  const byWeek = new Map(completions.map((c) => [c.week, c.points]));
  const thisWeek = byWeek.get(week) ?? 0;
  const history = Array.from({ length: 8 }, (_, i) => {
    const w = shiftWeek(week, i - 7);
    return { week: w, monday: mondayOf(w), points: byWeek.get(w) ?? 0 };
  });
  return {
    total: completions.reduce((t, c) => t + c.points, 0),
    thisWeek,
    streak: streakBefore(week, completions) + (byWeek.has(week) ? 1 : 0),
    completed: completions.length,
    history,
  };
}

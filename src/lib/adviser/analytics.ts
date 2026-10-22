import { FAMILY_LABELS } from "../careers/families.ts";
import type { CareerFamily } from "../careers/types.ts";
import type { AssessmentForAnalytics, User } from "../auth/store.ts";
import { RIASEC, RIASEC_NAMES, SUBJECT_AREAS, VALUE_DIMS, VALUE_NAMES, type RiasecType, type StudentProfile, type SubjectArea, type ValueDim } from "../questionnaire/types.ts";

/**
 * School dashboard figures for careers advisers. Every figure uses each student's latest
 * assessment, so one student retaking the questions doesn't count twice.
 */

/** The parts of a saved match the dashboard reads. */
interface SavedMatch {
  osca: string;
  title: string;
  family: CareerFamily;
  group: "best" | "explore" | "wildcard";
  scores: { personalFit: { score: number }; futureOpportunity: { score: number }; pathwayFeasibility: { score: number } };
  confidence: { level: string };
  improvement: { to: number; action: string } | null;
}

export interface Labels {
  educationPaths: Record<string, string>;
  studyTolerance: Record<string, string>;
  subjects: Record<string, string>;
}

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  yearLevel: number | null;
  assessments: number;
  lastCompletedAt: string | null;
  latestAssessmentId: string | null;
  hollandCode: string | null;
  topCareers: { osca: string; title: string; personalFit: number }[];
  confidence: string | null;
  flags: string[];
}

export interface Count {
  key: string;
  label: string;
  count: number;
}

export interface SchoolAnalytics {
  totals: { registered: number; completed: number; notStarted: number; completionRate: number; assessments: number; last30Days: number; retaken: number };
  byYear: { year: number; registered: number; completed: number }[];
  students: StudentRow[];
  topCareers: { osca: string; title: string; family: CareerFamily; students: number; first: number; avgFit: number }[];
  families: Count[];
  riasecPrimary: Count[];
  riasecAverage: Record<RiasecType, number>;
  hollandPairs: Count[];
  educationPaths: Count[];
  studyTolerance: Count[];
  topValues: Count[];
  subjects: { key: SubjectArea; label: string; enjoy: number; avgEnjoyment: number; avgConfidence: number }[];
  followUp: { id: string; name: string; yearLevel: number | null; reasons: string[] }[];
}

const sortCounts = (m: Map<string, Count>) => [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
const bump = (m: Map<string, Count>, key: string, label: string, by = 1) => {
  const c = m.get(key) ?? { key, label, count: 0 };
  c.count += by;
  m.set(key, c);
};
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

export { FAMILY_LABELS };

/** Why an adviser might want to talk to a student, from their latest assessment. */
export function followUpReasons(profile: StudentProfile, matches: SavedMatch[], completedAt: string, now: Date): string[] {
  const reasons: string[] = [];
  if (profile.riasec.differentiation < 20) reasons.push("Interests not clear yet");
  if (profile.quality.completeness < 0.75) reasons.push("Lots of “not sure” answers");
  const top = matches[0];
  if (top?.improvement) reasons.push(`Top career needs a subject change (${top.title})`);
  if (top && top.scores.pathwayFeasibility.score < 60) reasons.push(`Pathway to ${top.title} looks hard right now`);
  if (profile.educationPaths.length === 1 && profile.educationPaths[0] === "unsure") reasons.push("Unsure about study after school");
  if (now.getTime() - Date.parse(completedAt) > 183 * 24 * 3600e3) reasons.push("Due for a six-month check-in");
  return reasons;
}

export function schoolAnalytics(
  users: User[],
  assessments: AssessmentForAnalytics[],
  labels: Labels,
  opts: { year?: number | null; now?: Date } = {},
): SchoolAnalytics {
  const now = opts.now ?? new Date();
  const students = users.filter((u) => u.role === "student" && (!opts.year || u.yearLevel === opts.year));
  const ids = new Set(students.map((s) => s.id));
  const mine = assessments.filter((a) => ids.has(a.userId));
  const byUser = new Map<string, AssessmentForAnalytics[]>();
  for (const a of mine) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);
  for (const list of byUser.values()) list.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const latest = [...byUser.values()].map((l) => l[0]);

  const careers = new Map<string, { osca: string; title: string; family: CareerFamily; students: number; first: number; fits: number[] }>();
  const families = new Map<string, Count>();
  const primary = new Map<string, Count>(RIASEC.map((t) => [t, { key: t, label: RIASEC_NAMES[t], count: 0 }]));
  const riasecSums = Object.fromEntries(RIASEC.map((t) => [t, [] as number[]])) as Record<RiasecType, number[]>;
  const pairs = new Map<string, Count>();
  const paths = new Map<string, Count>();
  const tolerance = new Map<string, Count>();
  const values = new Map<string, Count>();
  const subj = Object.fromEntries(SUBJECT_AREAS.map((s) => [s, { enjoy: 0, e: [] as number[], c: [] as number[] }])) as Record<SubjectArea, { enjoy: number; e: number[]; c: number[] }>;
  const followUp: SchoolAnalytics["followUp"] = [];
  const rows: StudentRow[] = [];

  for (const s of students) {
    const list = byUser.get(s.id) ?? [];
    const a = list[0];
    const row: StudentRow = {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      username: s.username,
      email: s.email,
      yearLevel: s.yearLevel,
      assessments: list.length,
      lastCompletedAt: a?.completedAt ?? null,
      latestAssessmentId: a?.id ?? null,
      hollandCode: a?.hollandCode ?? null,
      topCareers: [],
      confidence: null,
      flags: [],
    };
    if (a) {
      const profile = a.profile as StudentProfile;
      const matches = a.matches as SavedMatch[];
      row.topCareers = matches.slice(0, 3).map((m) => ({ osca: m.osca, title: m.title, personalFit: m.scores.personalFit.score }));
      row.confidence = matches[0]?.confidence.level ?? null;
      row.flags = followUpReasons(profile, matches, a.completedAt, now);
      if (row.flags.length) followUp.push({ id: s.id, name: `${s.firstName} ${s.lastName}`, yearLevel: s.yearLevel, reasons: row.flags });

      const best = matches.filter((m) => m.group === "best");
      best.forEach((m, i) => {
        const c = careers.get(m.osca) ?? { osca: m.osca, title: m.title, family: m.family, students: 0, first: 0, fits: [] };
        c.students += 1;
        if (i === 0) c.first += 1;
        c.fits.push(m.scores.personalFit.score);
        careers.set(m.osca, c);
      });
      for (const f of new Set(best.map((m) => m.family))) bump(families, f, FAMILY_LABELS[f] ?? f);

      const code = profile.riasec.code;
      if (profile.riasec.differentiation >= 20) {
        bump(primary, code[0], RIASEC_NAMES[code[0] as RiasecType]);
        bump(pairs, code.slice(0, 2), `${RIASEC_NAMES[code[0] as RiasecType]} + ${RIASEC_NAMES[code[1] as RiasecType]}`);
      } else bump(primary, "mixed", "No clear type yet");
      for (const t of RIASEC) riasecSums[t].push(profile.riasec.scores[t]);
      for (const p of profile.educationPaths) bump(paths, p, labels.educationPaths[p] ?? p);
      bump(tolerance, profile.studyTolerance.answer, labels.studyTolerance[profile.studyTolerance.answer] ?? profile.studyTolerance.answer);
      const topValue = [...VALUE_DIMS].sort((x, y) => profile.values[y] - profile.values[x])[0] as ValueDim;
      bump(values, topValue, VALUE_NAMES[topValue]);
      for (const area of SUBJECT_AREAS) {
        const sub = profile.subjects[area];
        if (!sub) continue;
        subj[area].e.push(sub.enjoyment);
        subj[area].c.push(sub.confidence);
        if (sub.enjoyment >= 75) subj[area].enjoy += 1;
      }
    }
    rows.push(row);
  }

  rows.sort((x, y) => (y.lastCompletedAt ?? "").localeCompare(x.lastCompletedAt ?? "") || x.lastName.localeCompare(y.lastName));
  const completed = latest.length;
  const years = [10, 11, 12].filter((y) => !opts.year || y === opts.year);
  if (!primary.get("mixed")) primary.delete("mixed");

  return {
    totals: {
      registered: students.length,
      completed,
      notStarted: students.length - completed,
      completionRate: students.length ? Math.round((completed / students.length) * 100) : 0,
      assessments: mine.length,
      last30Days: mine.filter((a) => now.getTime() - Date.parse(a.completedAt) <= 30 * 24 * 3600e3).length,
      retaken: [...byUser.values()].filter((l) => l.length > 1).length,
    },
    byYear: years.map((year) => ({
      year,
      registered: students.filter((s) => s.yearLevel === year).length,
      completed: students.filter((s) => s.yearLevel === year && byUser.has(s.id)).length,
    })),
    students: rows,
    topCareers: [...careers.values()]
      .map(({ fits, ...c }) => ({ ...c, avgFit: avg(fits) }))
      .sort((a, b) => b.students - a.students || b.first - a.first || b.avgFit - a.avgFit)
      .slice(0, 12),
    families: sortCounts(families),
    riasecPrimary: [...primary.values()],
    riasecAverage: Object.fromEntries(RIASEC.map((t) => [t, avg(riasecSums[t])])) as Record<RiasecType, number>,
    hollandPairs: sortCounts(pairs).slice(0, 6),
    educationPaths: sortCounts(paths),
    studyTolerance: sortCounts(tolerance),
    topValues: sortCounts(values),
    subjects: SUBJECT_AREAS.map((k) => ({ key: k, label: labels.subjects[k] ?? k, enjoy: subj[k].enjoy, avgEnjoyment: avg(subj[k].e), avgConfidence: avg(subj[k].c) })).sort(
      (a, b) => b.enjoy - a.enjoy || b.avgEnjoyment - a.avgEnjoyment,
    ),
    followUp: followUp.sort((a, b) => b.reasons.length - a.reasons.length || a.name.localeCompare(b.name)),
  };
}

/** CSV for the adviser's export. Quotes every field and neutralises spreadsheet formulas. */
export function studentsCsv(rows: StudentRow[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ["First name", "Last name", "Username", "Email", "Year", "Assessments", "Last completed", "Holland code", "Top career", "Second", "Third", "Confidence", "Follow up"];
  const lines = rows.map((r) =>
    [
      r.firstName,
      r.lastName,
      r.username,
      r.email,
      r.yearLevel,
      r.assessments,
      r.lastCompletedAt?.slice(0, 10),
      r.hollandCode,
      ...[0, 1, 2].map((i) => (r.topCareers[i] ? `${r.topCareers[i].title} (${r.topCareers[i].personalFit}% fit)` : "")),
      r.confidence,
      r.flags.join("; "),
    ]
      .map(cell)
      .join(","),
  );
  return [head.map(cell).join(","), ...lines].join("\r\n");
}

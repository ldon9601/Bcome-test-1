import type { AuState } from "../auth/validation.ts";

/**
 * What the missions, action cards and CV need from a student's latest saved results. Saved
 * assessments are JSON from whichever version of Bcome wrote them, so everything is read
 * defensively: older results without course or JSA data still work.
 */

export interface CareerRef {
  osca: string;
  title: string;
  family: string;
  personalFit: number;
  /** The student's preferred kind of study for this career, from their answers. */
  lead: "university" | "tafe";
  course: { qualificationId: string; course: string; provider: string; state: string; atar: string | null } | null;
  tafe: { qualificationId: string; course: string; provider: string; url: string; apprenticeship: boolean } | null;
  jsa: { url: string; employed: number | null; medianWeeklyEarnings: number | null } | null;
  challenge: string | null;
}

export interface StudentContext {
  userId: string;
  firstName: string;
  yearLevel: number;
  state: AuState;
  /** Career matches, best first (personal fit order, as shown on results). */
  careers: CareerRef[];
  /** Current-subject labels, for the CV. */
  subjects: string[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function careerRefs(matches: unknown[]): CareerRef[] {
  const out: CareerRef[] = [];
  for (const raw of matches) {
    const m = obj(raw);
    if (!m) continue;
    const osca = str(m.osca);
    const title = str(m.title);
    if (!osca || !title) continue;
    const courses = obj(m.courses);
    const uni = obj(arr(courses?.university)[0]);
    const tafe = obj(arr(courses?.tafe)[0]);
    const profile = obj(obj(m.anzsco)?.profile);
    out.push({
      osca,
      title,
      family: str(m.family) ?? "",
      personalFit: num(obj(obj(m.scores)?.personalFit)?.score) ?? 0,
      lead: courses?.lead === "tafe" ? "tafe" : "university",
      course:
        uni && str(uni.course) && str(uni.provider)
          ? {
              qualificationId: str(uni.qualificationId) ?? "",
              course: str(uni.course)!,
              provider: str(uni.provider)!,
              state: str(uni.state) ?? "",
              atar: str(obj(uni.atar)?.display),
            }
          : null,
      tafe:
        tafe && str(tafe.course) && str(tafe.provider)
          ? { qualificationId: str(tafe.qualificationId) ?? "", course: str(tafe.course)!, provider: str(tafe.provider)!, url: str(tafe.url) ?? "", apprenticeship: tafe.apprenticeship === true }
          : null,
      jsa: profile && str(profile.url) ? { url: str(profile.url)!, employed: num(profile.employed), medianWeeklyEarnings: num(profile.medianWeeklyEarnings) } : null,
      challenge: str(arr(m.challenges)[0]),
    });
  }
  return out;
}

export function studentContext(
  user: { id: string; firstName: string; yearLevel: number | null },
  school: { state: AuState },
  latest: { matches: unknown[]; profile?: unknown } | null,
  subjectLabels: Record<string, string> = {},
): StudentContext {
  const profile = obj(latest?.profile);
  const subjects = arr(profile?.currentSubjects)
    .map((s) => (typeof s === "string" ? (subjectLabels[s] ?? null) : null))
    .filter((s): s is string => !!s);
  const state = (str(profile?.state) as AuState | null) ?? school.state;
  return { userId: user.id, firstName: user.firstName, yearLevel: user.yearLevel ?? 10, state, careers: latest ? careerRefs(latest.matches) : [], subjects };
}

import type { CourseOfferingsData, CourseSource, Occupation, TafeOffering, UniversityOffering } from "./types.ts";

/**
 * Specific university and TAFE courses for a career, ordered for one student: courses in their
 * state first, and the kind of study they said they'd consider (university or TAFE) first.
 * Prerequisites are checked against the subjects the student is taking now.
 */

export interface StudentContext {
  state: string;
  currentSubjects: string[];
  educationPaths: string[];
}

/**
 * Which current-subject ids satisfy a prerequisite written in a state's subject names. Returns
 * null when we can't tell from the subject list (e.g. "three Band 5 results"), so it isn't flagged.
 */
export function subjectsSatisfying(prereq: string): string[] | null {
  const p = prereq.toLowerCase();
  const anyMaths = ["maths_general", "maths_advanced", "maths_extension"];
  const parts: string[][] = [];
  // Any maths course will do ("one of Applications, Methods or Specialist", WA Applications, NSW Standard).
  if (/one of mathematics|mathematics applications|mathematics standard|general mathematics/.test(p)) parts.push(anyMaths);
  else if (/extension|specialist/.test(p)) parts.push(["maths_extension"]);
  else if (/mathematics advanced|mathematics methods|maths methods|mathematical methods/.test(p)) parts.push(["maths_advanced", "maths_extension"]);
  else if (/^mathematics\b/.test(p)) parts.push(anyMaths);
  if (/chemistry/.test(p)) parts.push(["chemistry"]);
  if (/physics/.test(p)) parts.push(["physics"]);
  if (/biology/.test(p)) parts.push(["biology"]);
  if (/engineering studies/.test(p)) parts.push(["engineering_studies"]);
  if (/physical education/.test(p)) parts.push(["pdhpe"]);
  if (/one science/.test(p)) parts.push(["biology", "chemistry", "physics", "earth_env"]);
  if (!parts.length) return null;
  // "One of Chemistry, Physics or Engineering Studies" and "X or one science course" are either-or.
  if (/one of|\bor\b/.test(p)) return [...new Set(parts.flat())];
  // A single requirement naming one subject: all of its options are alternatives.
  return parts.length === 1 ? parts[0] : null;
}

export function unmet(requirements: string[], currentSubjects: string[]): string[] {
  return requirements.filter((r) => {
    const ok = subjectsSatisfying(r);
    return ok !== null && !ok.some((s) => currentSubjects.includes(s));
  });
}

export interface UniversityOption extends UniversityOffering {
  inState: boolean;
  /** Prerequisites the student isn't currently studying. */
  missingPrerequisites: string[];
  /** Assumed-knowledge subjects the student isn't currently studying (not required, but expected). */
  assumedGaps: string[];
  sourceInfo: Pick<CourseSource, "title" | "url" | "note">;
}

export interface TafeOption extends TafeOffering {
  inState: boolean;
}

export interface CourseOptions {
  /** Which list to show first, from the student's answer about study after school. */
  lead: "university" | "tafe";
  university: UniversityOption[];
  tafe: TafeOption[];
  /** Shown when nothing is listed for the student's state yet. */
  note: string | null;
}

const kindOrder = { guaranteed: 0, indicative: 1, minimum: 2, published: 3 } as const;

export function courseOptions(occ: Occupation, student: StudentContext, data: CourseOfferingsData, limit = { university: 4, tafe: 2 }): CourseOptions {
  const quals = new Set(occ.pathways.map((p) => p.qualification).filter((q): q is string => !!q));
  const uni = data.university
    .filter((o) => quals.has(o.qualificationId))
    .map<UniversityOption>((o) => ({
      ...o,
      inState: o.state === student.state,
      missingPrerequisites: unmet(o.prerequisites, student.currentSubjects),
      assumedGaps: unmet(o.assumedKnowledge, student.currentSubjects),
      sourceInfo: { title: data.sources[o.source]?.title ?? "", url: data.sources[o.source]?.url ?? "", note: data.sources[o.source]?.note ?? "" },
    }))
    .sort(
      (a, b) =>
        Number(b.inState) - Number(a.inState) ||
        Number(b.atar.value !== null) - Number(a.atar.value !== null) ||
        (kindOrder[a.atar.kind ?? "published"] ?? 9) - (kindOrder[b.atar.kind ?? "published"] ?? 9) ||
        (a.atar.value ?? 100) - (b.atar.value ?? 100) ||
        a.provider.localeCompare(b.provider),
    );
  // One course per provider, so the list shows a spread of universities.
  const seen = new Set<string>();
  const university = uni.filter((o) => (seen.has(o.provider) ? false : (seen.add(o.provider), true))).slice(0, limit.university);
  const tafe = data.tafe
    .filter((o) => quals.has(o.qualificationId))
    .map<TafeOption>((o) => ({ ...o, inState: o.state === student.state }))
    .sort((a, b) => Number(b.inState) - Number(a.inState))
    .slice(0, limit.tafe);
  const wantsUni = student.educationPaths.includes("university");
  const wantsTafe = student.educationPaths.some((p) => p === "vet" || p === "apprenticeship" || p === "work_learn");
  const lead: CourseOptions["lead"] = wantsTafe && !wantsUni ? "tafe" : !university.length && tafe.length ? "tafe" : "university";
  const anyInState = university.some((u) => u.inState) || tafe.some((t) => t.inState);
  const note =
    (university.length || tafe.length) && !anyInState
      ? `We don't have ${student.state} course details for this career yet, so these are from other states. Check your state's admissions centre for local options.`
      : null;
  return { lead, university, tafe, note };
}

/** "Guaranteed ATAR 2027", "Indicative selection rank 2027", "Minimum ATAR" */
export function atarLabel(kind: UniversityOffering["atar"]["kind"], year: number | null): string {
  const base = { guaranteed: "Guaranteed ATAR", indicative: "Indicative selection rank", minimum: "Minimum ATAR", published: "Published ATAR" }[kind ?? "published"];
  return year ? `${base} ${year}` : base;
}

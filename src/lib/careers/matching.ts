import { computeOutlook } from "./outlook.ts";
import type { JsaOutlookData, Occupation, Outlook } from "./types.ts";
import { RIASEC, RIASEC_NAMES, type RiasecType, type StudentProfile, type WorkValue } from "../questionnaire/types.ts";

/**
 * Rule-based matching from a student profile to occupations.
 * Deterministic and explainable: every match carries the reasons and cautions behind it,
 * which the plan generator must use rather than inventing its own.
 */

export const WEIGHTS = { interest: 0.5, values: 0.15, subjects: 0.1, pathway: 0.1, outlook: 0.15 } as const;

const VALUE_TEXT: Record<WorkValue, string> = {
  helping: "helping people",
  security: "a stable, secure job",
  creativity: "being creative",
  independence: "working your own way",
  teamwork: "working in a team",
  outdoors: "getting out of the office",
  variety: "variety",
  income: "good pay",
  impact: "making a difference",
  leadership: "leading and making decisions",
};

export interface Match {
  occupation: Occupation;
  outlook: Outlook;
  /** 0–100 overall fit. */
  score: number;
  components: Record<keyof typeof WEIGHTS, number>;
  reasons: string[];
  cautions: string[];
}

export interface MatchOptions {
  limit?: number;
  /** Subject id → display label, for readable reasons. */
  subjectLabels?: Record<string, string>;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function listText(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function interestFit(profile: StudentProfile, code: string): number {
  const s = profile.riasec.scores;
  const vals = RIASEC.map((t) => s[t]);
  const min = Math.min(...vals);
  const range = Math.max(...vals) - min || 1;
  const weights = [3, 2, 1];
  let abs = 0;
  let rel = 0;
  [...code].forEach((letter, i) => {
    const t = letter as RiasecType;
    abs += weights[i] * (s[t] / 100);
    rel += weights[i] * ((s[t] - min) / range);
  });
  // Blend absolute and relative so a student who rates everything low still gets sensible matches.
  return clamp01((0.5 * abs + 0.5 * rel) / 6);
}

function pathwayFit(profile: StudentProfile, occ: Occupation): number {
  const p = occ.pathways;
  switch (profile.studyPreference) {
    case "university":
      return p.university ? 1 : 0.4;
    case "vet":
      return p.vet ? 1 : p.apprenticeship ? 0.7 : 0.4;
    case "apprenticeship":
      if (!p.apprenticeship) return 0.3;
      return occ.apprenticeshipAreas.some((a) => profile.apprenticeshipAreas.includes(a)) ? 1 : 0.7;
    case "work":
      return occ.skillLevel >= 3 || p.apprenticeship ? 1 : 0.5;
    default:
      return 0.8;
  }
}

export function scoreOccupation(
  profile: StudentProfile,
  occ: Occupation,
  jsa: JsaOutlookData,
  subjectLabels: Record<string, string> = {},
): Match {
  const label = (id: string) => subjectLabels[id] ?? id;
  const outlook = computeOutlook(occ, jsa);
  const reasons: string[] = [];
  const cautions: string[] = [];

  // Interests
  const interest = interestFit(profile, occ.riasec);
  const studentTop = profile.riasec.code.slice(0, 3).split("") as RiasecType[];
  const shared = (occ.riasec.split("") as RiasecType[]).filter((t) => studentTop.includes(t));
  if (shared.length) {
    reasons.push(`Matches your top interests: ${listText(shared.map((t) => RIASEC_NAMES[t].split(" ")[0]))}.`);
  }

  // Values
  const values = occ.values.length
    ? occ.values.reduce((sum, v) => sum + profile.values[v], 0) / occ.values.length / 100
    : 0.5;
  const valueHits = occ.values.filter((v) => profile.topValues.includes(v));
  if (valueHits.length) reasons.push(`Offers what you value: ${listText(valueHits.map((v) => VALUE_TEXT[v]))}.`);

  // Subjects
  const mine = new Set([...profile.subjectsEnjoyed, ...profile.subjectsStrong]);
  const helpfulHits = occ.subjects.helpful.filter((s) => mine.has(s));
  let subjects = occ.subjects.helpful.length
    ? clamp01(helpfulHits.length / Math.min(3, occ.subjects.helpful.length))
    : 0.5;
  if (helpfulHits.length) reasons.push(`Builds on subjects you enjoy or do well in: ${listText(helpfulHits.map(label))}.`);
  const missingRequired = occ.subjects.oftenRequired.filter((s) => !mine.has(s));
  if (missingRequired.length) {
    const names = missingRequired.map(label).join(", ");
    if (profile.yearLevel === 10) {
      cautions.push(`Courses often require ${names}. Consider choosing it for Years 11 and 12.`);
    } else if (profile.yearLevel === 11) {
      subjects = clamp01(subjects - 0.15);
      cautions.push(`Courses often require ${names}. Check whether you can still take it, or look at bridging courses.`);
    } else {
      subjects = clamp01(subjects - 0.3);
      cautions.push(`Courses often require ${names}. Bridging courses or alternative entry pathways can help.`);
    }
  }

  // Pathway
  const pathway = pathwayFit(profile, occ);
  if (pathway >= 1 && profile.studyPreference !== "unsure") {
    const how = { university: "university", vet: "TAFE or VET", apprenticeship: "an apprenticeship", work: "starting work early", unsure: "" }[profile.studyPreference];
    reasons.push(`You can get in through ${how}, which fits your plans.`);
  }

  // Outlook
  if (outlook.band10 === "strong" || outlook.band10 === "good") reasons.push(outlook.summary);
  if (outlook.band10 === "limited" || outlook.band10 === "declining") cautions.push(outlook.summary);
  if (occ.aiExposure === "high") cautions.push("AI is likely to change much of this work; plan to build specialist and people skills alongside it.");

  const components = { interest, values, subjects, pathway, outlook: outlook.score };
  const score = Math.round(
    100 * (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + WEIGHTS[k] * components[k], 0),
  );
  return { occupation: occ, outlook, score, components, reasons, cautions };
}

export function matchCareers(
  profile: StudentProfile,
  occupations: Occupation[],
  jsa: JsaOutlookData,
  options: MatchOptions = {},
): Match[] {
  const { limit = 10, subjectLabels = {} } = options;
  return occupations
    .map((occ) => scoreOccupation(profile, occ, jsa, subjectLabels))
    .sort((a, b) => b.score - a.score || a.occupation.title.localeCompare(b.occupation.title))
    .slice(0, limit);
}

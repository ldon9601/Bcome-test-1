import { computeOutlook } from "./outlook.ts";
import type { SkillsGraph } from "./skills.ts";
import type { JsaOutlookData, Occupation, Outlook, Route } from "./types.ts";
import { RIASEC, RIASEC_NAMES, type RiasecType, type StudentProfile, type WorkValue } from "../questionnaire/types.ts";

/**
 * Rule-based matching from a student profile to occupations, scored three ways:
 *
 *   Personal fit         How well the work suits the student: interests, values, subjects they enjoy.
 *   Future opportunity   How the job market is likely to treat this career over 5–15 years, and how
 *                        well its skills carry over to other growing careers.
 *   Pathway feasibility  How realistic the route in is for this student: their preferred way of
 *                        studying, prerequisite subjects for their year level, competition for
 *                        places, time to qualify, and how many routes exist.
 *
 * Every score carries the reasons and cautions behind it, which the plan generator must use rather
 * than inventing its own. The overall match ranks careers and leans on personal fit.
 */

export const SCORE_WEIGHTS = { personalFit: 0.5, futureOpportunity: 0.25, pathwayFeasibility: 0.25 } as const;
export type ScoreName = keyof typeof SCORE_WEIGHTS;

export const PERSONAL_WEIGHTS = { interest: 0.65, values: 0.2, subjects: 0.15 } as const;
export const FUTURE_WEIGHTS = { outlook: 0.75, portability: 0.25 } as const;
export const FEASIBILITY_WEIGHTS = { route: 0.35, prerequisites: 0.25, competition: 0.2, time: 0.1, options: 0.1 } as const;

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

export interface ScoreDetail {
  /** 0–100. */
  score: number;
  /** The parts that make up the score, each 0–1. */
  parts: Record<string, number>;
  reasons: string[];
  cautions: string[];
}

export interface Match {
  occupation: Occupation;
  outlook: Outlook;
  /** 0–100 overall match, used for ranking. */
  score: number;
  scores: Record<ScoreName, ScoreDetail>;
  /** All reasons and cautions, in score order. */
  reasons: string[];
  cautions: string[];
}

export interface MatchOptions {
  limit?: number;
  /** Subject id → display label, for readable reasons. */
  subjectLabels?: Record<string, string>;
  /** Needed for skill portability; without it portability counts as neutral. */
  graph?: SkillsGraph;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pct = (n: number) => Math.round(100 * clamp01(n));
const EARN_WHILE_LEARN: Route[] = ["apprenticeship", "traineeship", "cadetship"];

function listText(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function weighted<K extends string>(weights: Record<K, number>, parts: Record<K, number>): number {
  return (Object.keys(weights) as K[]).reduce((s, k) => s + weights[k] * parts[k], 0);
}

// ---------------------------------------------------------------- personal fit

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

function personalFit(profile: StudentProfile, occ: Occupation, label: (id: string) => string): ScoreDetail {
  const reasons: string[] = [];
  const interest = interestFit(profile, occ.riasec);
  const studentTop = profile.riasec.code.split("") as RiasecType[];
  const shared = (occ.riasec.split("") as RiasecType[]).filter((t) => studentTop.includes(t));
  if (shared.length) reasons.push(`Matches your top interests: ${listText(shared.map((t) => RIASEC_NAMES[t].split(" ")[0]))}.`);

  const values = occ.values.length ? occ.values.reduce((sum, v) => sum + profile.values[v], 0) / occ.values.length / 100 : 0.5;
  const valueHits = occ.values.filter((v) => profile.topValues.includes(v));
  if (valueHits.length) reasons.push(`Offers what you value: ${listText(valueHits.map((v) => VALUE_TEXT[v]))}.`);

  const mine = new Set([...profile.subjectsEnjoyed, ...profile.subjectsStrong]);
  const helpfulHits = occ.subjects.helpful.filter((s) => mine.has(s));
  const subjects = occ.subjects.helpful.length ? clamp01(helpfulHits.length / Math.min(3, occ.subjects.helpful.length)) : 0.5;
  if (helpfulHits.length) reasons.push(`Builds on subjects you enjoy or do well in: ${listText(helpfulHits.map(label))}.`);

  const parts = { interest, values, subjects };
  return { score: pct(weighted(PERSONAL_WEIGHTS, parts)), parts, reasons, cautions: [] };
}

// ---------------------------------------------------------------- future opportunity

function futureOpportunity(occ: Occupation, outlook: Outlook, portability: number | null, graphSize: number): ScoreDetail {
  const reasons: string[] = [];
  const cautions: string[] = [];
  if (outlook.band10 === "strong" || outlook.band10 === "good") reasons.push(outlook.summary);
  if (outlook.band10 === "limited" || outlook.band10 === "declining") cautions.push(outlook.summary);
  if (outlook.band15 === "strong" && outlook.band10 !== "strong") reasons.push("Demand is likely to keep growing into the 2040s.");
  if (occ.aiExposure === "high") cautions.push("AI is likely to change much of this work; plan to build specialist and people skills alongside it.");
  if (portability !== null && graphSize > 1) {
    if (portability >= 0.75) reasons.push("Most of its skills are also used in other growing careers, so you'd have options if things change.");
    else if (portability < 0.4) cautions.push("Its skills are quite specialised, so switching careers later may mean more retraining.");
  }
  const parts = { outlook: outlook.score, portability: portability ?? 0.5 };
  return { score: pct(weighted(FUTURE_WEIGHTS, parts)), parts, reasons, cautions };
}

// ---------------------------------------------------------------- pathway feasibility

function routeFit(profile: StudentProfile, occ: Occupation): number {
  const routes = new Set(occ.pathways.map((p) => p.route));
  const has = (r: Route) => routes.has(r);
  const earnWhileLearn = EARN_WHILE_LEARN.some(has);
  const quickest = Math.min(...occ.pathways.map((p) => p.years[1]));
  switch (profile.studyPreference) {
    case "university":
      return has("university") ? 1 : has("cadetship") ? 0.7 : 0.4;
    case "vet":
      return has("vet") ? 1 : earnWhileLearn ? 0.8 : 0.4;
    case "apprenticeship":
      if (has("apprenticeship")) return occ.apprenticeshipAreas.some((a) => profile.apprenticeshipAreas.includes(a)) ? 1 : 0.75;
      if (has("traineeship") || has("cadetship")) return 0.7;
      return has("vet") ? 0.5 : 0.25;
    case "work":
      if (earnWhileLearn || has("other") || quickest <= 1) return 1;
      return has("vet") && quickest <= 2 ? 0.8 : 0.4;
    default:
      return 0.8;
  }
}

function timeFit(maxYears: number): number {
  if (maxYears <= 2) return 1;
  if (maxYears <= 4) return 0.9;
  if (maxYears <= 6) return 0.75;
  if (maxYears <= 9) return 0.6;
  return 0.5;
}

function pathwayFeasibility(profile: StudentProfile, occ: Occupation, label: (id: string) => string): ScoreDetail {
  const reasons: string[] = [];
  const cautions: string[] = [];

  const route = routeFit(profile, occ);
  if (route >= 1 && profile.studyPreference !== "unsure") {
    const how = { university: "university", vet: "TAFE or VET", apprenticeship: "an apprenticeship", work: "starting work early", unsure: "" }[profile.studyPreference];
    reasons.push(`You can get in through ${how}, which fits your plans.`);
  } else if (route <= 0.4) {
    cautions.push("The usual way in doesn't match how you said you'd like to study after school.");
  }

  const mine = new Set([...profile.subjectsEnjoyed, ...profile.subjectsStrong]);
  const missing = occ.subjects.oftenRequired.filter((s) => !mine.has(s));
  let prerequisites = 1;
  if (missing.length) {
    const names = missing.map(label).join(", ");
    if (profile.yearLevel === 10) {
      prerequisites = 0.85;
      cautions.push(`Courses often require ${names}. Consider choosing it for Years 11 and 12.`);
    } else if (profile.yearLevel === 11) {
      prerequisites = 0.6;
      cautions.push(`Courses often require ${names}. Check whether you can still take it, or look at bridging courses.`);
    } else {
      prerequisites = 0.35;
      cautions.push(`Courses often require ${names}. Bridging courses or alternative entry pathways can help.`);
    }
  }

  const strongHelpful = occ.subjects.helpful.some((s) => profile.subjectsStrong.includes(s));
  const competition = { open: 1, moderate: 0.85, high: strongHelpful ? 0.75 : 0.55 }[occ.entryCompetitiveness];
  if (occ.entryCompetitiveness === "high") {
    cautions.push(
      strongHelpful
        ? "Places are competitive, but your strengths in related subjects help."
        : "Places are competitive, so have a backup pathway ready.",
    );
  }

  const [, maxYears] = occ.timeToQualify.years;
  let time = timeFit(maxYears);
  if (profile.studyPreference === "work" && maxYears > 4) time = clamp01(time - 0.2);
  if (maxYears >= 8) cautions.push(`It usually takes ${occ.timeToQualify.years.join("–")} years after school to reach this role.`);
  else if (maxYears <= 2) reasons.push("You can be qualified within about two years of finishing school.");

  const routeCount = new Set(occ.pathways.map((p) => p.route)).size;
  const options = routeCount >= 3 ? 1 : routeCount === 2 ? 0.85 : 0.6;
  if (routeCount >= 2) reasons.push(`There are ${routeCount} different ways in, so you have options.`);

  const parts = { route, prerequisites, competition, time, options };
  return { score: pct(weighted(FEASIBILITY_WEIGHTS, parts)), parts, reasons, cautions };
}

// ---------------------------------------------------------------- matching

export function scoreOccupation(
  profile: StudentProfile,
  occ: Occupation,
  jsa: JsaOutlookData,
  options: { subjectLabels?: Record<string, string>; portability?: number | null; graphSize?: number; outlook?: Outlook } = {},
): Match {
  const label = (id: string) => options.subjectLabels?.[id] ?? id;
  const outlook = options.outlook ?? computeOutlook(occ, jsa);
  const scores = {
    personalFit: personalFit(profile, occ, label),
    futureOpportunity: futureOpportunity(occ, outlook, options.portability ?? null, options.graphSize ?? 0),
    pathwayFeasibility: pathwayFeasibility(profile, occ, label),
  };
  const score = Math.round(weighted(SCORE_WEIGHTS, {
    personalFit: scores.personalFit.score,
    futureOpportunity: scores.futureOpportunity.score,
    pathwayFeasibility: scores.pathwayFeasibility.score,
  }));
  const order: ScoreName[] = ["personalFit", "futureOpportunity", "pathwayFeasibility"];
  return {
    occupation: occ,
    outlook,
    score,
    scores,
    reasons: order.flatMap((k) => scores[k].reasons),
    cautions: order.flatMap((k) => scores[k].cautions),
  };
}

export function matchCareers(
  profile: StudentProfile,
  occupations: Occupation[],
  jsa: JsaOutlookData,
  options: MatchOptions = {},
): Match[] {
  const { limit = 10, subjectLabels = {}, graph } = options;
  const outlooks = new Map(occupations.map((o) => [o.osca, computeOutlook(o, jsa)]));
  const growing = (o: Occupation) => {
    const band = (outlooks.get(o.osca) ?? computeOutlook(o, jsa)).band10;
    return band === "strong" || band === "good";
  };
  return occupations
    .map((occ) =>
      scoreOccupation(profile, occ, jsa, {
        subjectLabels,
        outlook: outlooks.get(occ.osca),
        portability: graph ? graph.portability(occ, growing) : null,
        graphSize: graph?.occupations.length ?? 0,
      }),
    )
    .sort((a, b) => b.score - a.score || a.occupation.title.localeCompare(b.occupation.title))
    .slice(0, limit);
}

/** The match fields sent to the browser. */
export function toMatchSummary(m: Match) {
  return {
    id: m.occupation.osca,
    osca: m.occupation.osca,
    title: m.occupation.title,
    score: m.score,
    scores: {
      personalFit: { score: m.scores.personalFit.score, reasons: m.scores.personalFit.reasons, cautions: m.scores.personalFit.cautions },
      futureOpportunity: { score: m.scores.futureOpportunity.score, reasons: m.scores.futureOpportunity.reasons, cautions: m.scores.futureOpportunity.cautions },
      pathwayFeasibility: { score: m.scores.pathwayFeasibility.score, reasons: m.scores.pathwayFeasibility.reasons, cautions: m.scores.pathwayFeasibility.cautions },
    },
    outlook: m.outlook,
    reasons: m.reasons,
    cautions: m.cautions,
    salary: m.occupation.salary,
    timeToQualify: m.occupation.timeToQualify,
  };
}

export type MatchSummary = ReturnType<typeof toMatchSummary>;

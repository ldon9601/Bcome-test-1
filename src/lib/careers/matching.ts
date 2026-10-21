import { computeOutlook } from "./outlook.ts";
import { careerTags } from "./tags.ts";
import type { SkillsGraph } from "./skills.ts";
import type { JsaOutlookData, Occupation, Outlook, OutlookBand, Route } from "./types.ts";
import {
  PIDT,
  RIASEC,
  RIASEC_NAMES,
  SKILL_DIMS,
  SKILL_NAMES,
  STYLE_DIMS,
  VALUE_DIMS,
  VALUE_NAMES,
  type EducationPath,
  type Pidt,
  type RiasecType,
  type SkillDim,
  type StudentProfile,
  type StyleDim,
  type SubjectArea,
  type ValueDim,
} from "../questionnaire/types.ts";

/**
 * Deterministic career matching (requirements doc, sections 6–13).
 *
 *   Personal fit         = .35 interests + .20 skill affinity + .20 work values + .15 work environment + .10 subject affinity
 *   Future opportunity   = .30 employment growth + .20 shortage + .15 regional breadth + .15 graduate outcomes
 *                          + .10 earnings potential + .10 AI adaptability
 *   Pathway feasibility  = .30 subject prerequisites + .25 academic readiness + .20 qualification pathway fit
 *                          + .10 study-duration preference + .10 alternative pathway breadth + .05 geographic accessibility
 *   Match score          = .60 personal fit + .25 future opportunity + .15 pathway feasibility
 *
 * Personal fit always comes first:
 *   - only careers with a strong personal fit (within 12 points of the student's best, and at least 55) are recommended;
 *   - groups never depend on job outlook: Best matches are the five strongest fits; Worth exploring holds the next
 *     strong fits, preferring ones that need extra subjects, skills or study; the Wildcard is a strong fit from a
 *     different field;
 *   - careers are ordered by personal fit, and opportunity and pathway only reorder careers whose fit is within 5 points;
 *   - similar careers are pushed down (diversity reranking) so students see a spread of options.
 *
 * Every score carries the evidence behind it. A gap never rules a career out; it becomes a "what you'd need to build".
 */

/** Bump when weights or rules change, so stored results can be compared and recalibrated. */
export const ALGORITHM_VERSION = "2.0.0";

export const MATCH_WEIGHTS = { personalFit: 0.6, futureOpportunity: 0.25, pathwayFeasibility: 0.15 } as const;
export type ScoreName = keyof typeof MATCH_WEIGHTS;
export const PERSONAL_WEIGHTS = { interests: 0.35, skills: 0.2, values: 0.2, environment: 0.15, subjects: 0.1 } as const;
export const OPPORTUNITY_WEIGHTS = { growth: 0.3, shortage: 0.2, regional: 0.15, outcomes: 0.15, earnings: 0.1, aiAdaptability: 0.1 } as const;
export const FEASIBILITY_WEIGHTS = { prerequisites: 0.3, academic: 0.25, qualification: 0.2, duration: 0.1, breadth: 0.1, geography: 0.05 } as const;
export const CONFIDENCE_WEIGHTS = { completeness: 0.4, consistency: 0.25, dataQuality: 0.35 } as const;

/** Recommendations must be within this many points of the student's best personal fit… */
export const FIT_WINDOW = 12;
/** …and at least this good. */
export const FIT_FLOOR = 55;
/** Personal fit is compared in bands this wide; only within a band do the other scores decide order. */
export const FIT_BAND = 5;
/** DisplayScore = score − DIVERSITY_PENALTY × similarity to careers already shown. */
export const DIVERSITY_PENALTY = 8;

export type Group = "best" | "explore" | "wildcard" | "other";

export interface Strength {
  label: string;
  /** 1–9, for "+++" style bars. */
  strength: number;
  /** Which part of personal fit it comes from. */
  kind: "interest" | "skill" | "value" | "environment" | "subject";
}

/** At equal strength, list what personal fit weighs most first (interests 35% … subjects 10%). */
const KIND_ORDER: Record<Strength["kind"], number> = { interest: 0, skill: 1, value: 2, environment: 3, subject: 4 };

export interface ScoreDetail {
  score: number;
  parts: Record<string, number>;
  reasons: string[];
  cautions: string[];
}

export interface FutureOutlookSummary {
  employment: OutlookBand;
  shortage: boolean;
  aiAugmentation: "High" | "Moderate" | "Low";
  aiAutomation: "High" | "Moderate" | "Low";
  income: "Above average" | "Average" | "Below average";
  education: "High" | "Moderate" | "Low";
}

export interface Match {
  occupation: Occupation;
  outlook: Outlook;
  /** Match score, 0–100 (the doc's CareerScore). */
  score: number;
  scores: Record<ScoreName, ScoreDetail>;
  /** "Why this matches you": the strongest overlaps, most important first. */
  strengths: Strength[];
  /** "Potential challenges": framed as what to build, never as unsuitability. */
  challenges: string[];
  future: FutureOutlookSummary;
  /** e.g. feasibility 72 today, ~90 if Chemistry is chosen in Year 11. */
  improvement: { to: number; action: string } | null;
  /** Strong fit, but would need subjects, skills or study the student hasn't planned for. */
  stretch: boolean;
  confidence: { score: number; level: "High" | "Moderate" | "Low"; note: string | null };
  group: Group;
  reasons: string[];
  cautions: string[];
}

export interface MatchOptions {
  limit?: number;
  subjectLabels?: Record<string, string>;
  /** Needed for skill portability (AI adaptation) and diversity; without it both are neutral. */
  graph?: SkillsGraph;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pct = (n: number) => Math.round(100 * clamp01(n));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const plusses = (n: number) => Math.max(1, Math.min(9, Math.round(n / 11)));

function weighted<K extends string>(weights: Record<K, number>, parts: Record<K, number>): number {
  return (Object.keys(weights) as K[]).reduce((s, k) => s + weights[k] * parts[k], 0);
}

/**
 * Similarity = 1 − Σ wᵢ|sᵢ − oᵢ| / Σ wᵢ (both 0–100). Dimensions that matter more to the
 * occupation weigh more (wᵢ = 0.5 + oᵢ/100). `surplusWeight` sets how much being above the
 * occupation's level counts: 1 = symmetric (interests, values, environment), 0.5 = strengths the
 * job wouldn't use count half (skills), 0 = only shortfalls count (subject prerequisites).
 */
export function similarity(student: Record<string, number>, occ: Record<string, number>, dims: readonly string[], surplusWeight = 1): number {
  let num = 0;
  let den = 0;
  for (const d of dims) {
    const w = 0.5 + occ[d] / 100;
    const diff = student[d] - occ[d];
    const gap = diff >= 0 ? surplusWeight * diff : -diff;
    num += w * gap;
    den += w * 100;
  }
  return den ? 1 - num / den : 0;
}

/** Centres a value profile on its own mean, as the student's values are. */
function centred(v: Record<ValueDim, number>): Record<ValueDim, number> {
  const m = mean(VALUE_DIMS.map((d) => v[d]));
  return Object.fromEntries(VALUE_DIMS.map((d) => [d, Math.max(0, Math.min(100, 50 + (v[d] - m)))])) as Record<ValueDim, number>;
}

/** People/Ideas/Data/Things for an occupation, from its interest profile (Prediger's dimensions), scaled 0–100. */
export function occupationPidt(i: Record<RiasecType, number>): Record<Pidt, number> {
  const raw = {
    people: 0.6 * i.S + 0.2 * i.E + 0.2 * i.A,
    ideas: 0.6 * i.I + 0.4 * i.A,
    data: 0.6 * i.C + 0.4 * i.E,
    things: 0.6 * i.R + 0.2 * i.I + 0.2 * i.C,
  };
  const lo = Math.min(...Object.values(raw));
  const span = Math.max(...Object.values(raw)) - lo || 1;
  return Object.fromEntries(PIDT.map((d) => [d, Math.round(((raw[d] - lo) / span) * 100)])) as Record<Pidt, number>;
}

const AREA_LABEL: Record<SubjectArea, string> = {
  mathematics: "Mathematics",
  biology: "Biology/health",
  chemistry: "Chemistry",
  physics: "Physics",
  english: "English",
  humanities: "Humanities",
  business: "Business/economics",
  computing: "Computing/technology",
  arts: "Art/design/media",
  practical: "Practical/trade subjects",
};

const STYLE_TEXT: Record<StyleDim, { low: string; high: string }> = {
  teamwork: { low: "working independently", high: "working in a team" },
  flexibility: { low: "structure and predictability", high: "flexibility and self-direction" },
  physical: { low: "seated, digital work", high: "active, hands-on work" },
  variety: { low: "regular, predictable work", high: "varied work" },
};

// ---------------------------------------------------------------- personal fit

function personalFit(p: StudentProfile, occ: Occupation): ScoreDetail & { strengths: Strength[]; challenges: string[] } {
  const op = occ.profile;
  const strengths: Strength[] = [];
  const challenges: string[] = [];

  const interests = similarity(p.riasec.scores, op.interests, RIASEC);
  for (const t of RIASEC) {
    const both = Math.min(p.riasec.scores[t], op.interests[t]);
    if (both >= 65) strengths.push({ label: `${RIASEC_NAMES[t]} interests`, strength: plusses(both), kind: "interest" });
  }

  const skills = similarity(p.skills, op.skills, SKILL_DIMS, 0.5);
  for (const d of SKILL_DIMS) {
    const both = Math.min(p.skills[d], op.skills[d]);
    if (both >= 65) strengths.push({ label: SKILL_NAMES[d], strength: plusses(both), kind: "skill" });
    const gap = op.skills[d] - p.skills[d];
    if (gap >= 35 && op.skills[d] >= 70) challenges.push(`Building your confidence in ${SKILL_NAMES[d].toLowerCase()} would help: this work leans on it heavily.`);
  }

  const occValues = centred(op.values);
  const values = similarity(p.values, occValues, VALUE_DIMS);
  for (const d of VALUE_DIMS) {
    if (p.values[d] >= 60 && occValues[d] >= 55) strengths.push({ label: VALUE_NAMES[d], strength: plusses((p.values[d] + occValues[d]) / 2 + 15), kind: "value" });
  }

  const occPidt = occupationPidt(op.interests);
  const pidtSim = similarity(p.environment, occPidt, PIDT);
  const styleSim = similarity(p.environment, op.environment, STYLE_DIMS);
  const environment = 0.5 * pidtSim + 0.5 * styleSim;
  const studentTop = [...PIDT].sort((a, b) => p.environment[b] - p.environment[a])[0];
  const occTop = [...PIDT].sort((a, b) => occPidt[b] - occPidt[a])[0];
  if (studentTop === occTop) strengths.push({ label: `Working with ${studentTop}`, strength: 8, kind: "environment" });
  for (const d of STYLE_DIMS) {
    const diff = p.environment[d] - op.environment[d];
    if (Math.abs(diff) >= 45) {
      challenges.push(
        diff < 0
          ? `This work usually involves more ${STYLE_TEXT[d].high} than you said you'd prefer.`
          : `This work usually involves more ${STYLE_TEXT[d].low} than you said you'd prefer.`,
      );
    }
  }

  const areas = [...new Set([...occ.subjectAreas.helpful, ...occ.subjectAreas.required])];
  const areaScore = (a: SubjectArea) => (p.subjects[a].enjoyment + p.subjects[a].confidence) / 2;
  let subjects = 0.7;
  if (areas.length) {
    const target = Object.fromEntries(areas.map((a) => [a, occ.subjectAreas.required.includes(a) ? 85 : 75]));
    const mine = Object.fromEntries(areas.map((a) => [a, areaScore(a)]));
    subjects = similarity(mine, target, areas, 0);
    for (const a of areas) if (p.subjects[a].enjoyment >= 75) strengths.push({ label: `Enjoying ${AREA_LABEL[a]}`, strength: plusses(p.subjects[a].enjoyment), kind: "subject" });
  }

  const parts = { interests, skills, values, environment, subjects };
  strengths.sort((a, b) => b.strength - a.strength || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const top = strengths.slice(0, 3).map((s) => s.label.toLowerCase());
  const reasons = top.length ? [`Your strongest links to this career: ${top.join(", ")}.`] : [];
  return { score: pct(weighted(PERSONAL_WEIGHTS, parts)), parts, reasons, cautions: [], strengths: strengths.slice(0, 6), challenges };
}

// ---------------------------------------------------------------- future opportunity

const BAND_SCORE: Record<OutlookBand, number> = { strong: 1, good: 0.8, moderate: 0.6, limited: 0.35, declining: 0.15, unknown: 0.5 };
const level = (n: number): "High" | "Moderate" | "Low" => (n >= 67 ? "High" : n >= 34 ? "Moderate" : "Low");

function futureOpportunity(occ: Occupation, outlook: Outlook, portability: number | null): ScoreDetail & { future: FutureOutlookSummary } {
  const m = occ.market;
  const midExperienced = (occ.salary.experienced[0] + occ.salary.experienced[1]) / 2;
  const adaptation = portability ?? 0.5;
  const aiAdaptability = 0.5 * (1 - m.ai.automation / 100) + 0.3 * (m.ai.augmentation / 100) + 0.2 * adaptation;
  const parts = {
    growth: BAND_SCORE[outlook.band10],
    shortage: m.shortage === "shortage" ? 1 : 0.5,
    regional: m.regionalBreadth / 100,
    outcomes: m.graduateOutcome / 100,
    earnings: clamp01((midExperienced - 50000) / 150000),
    aiAdaptability,
  };
  const reasons: string[] = [];
  const cautions: string[] = [];
  if (outlook.band10 === "strong" || outlook.band10 === "good") reasons.push(outlook.summary);
  if (outlook.band10 === "limited" || outlook.band10 === "declining") cautions.push(outlook.summary);
  if (m.shortage === "shortage") reasons.push("Employers currently find it hard to fill these roles.");
  if (m.ai.augmentation >= 67 && m.ai.automation < 67) reasons.push("AI is more likely to help with this work than replace it.");
  if (m.ai.automation >= 67) cautions.push("AI is likely to automate parts of this work, so specialist and people skills will matter more.");
  const maxYears = occ.timeToQualify.years[1];
  return {
    score: pct(weighted(OPPORTUNITY_WEIGHTS, parts)),
    parts,
    reasons,
    cautions,
    future: {
      employment: outlook.band10,
      shortage: m.shortage === "shortage",
      aiAugmentation: level(m.ai.augmentation),
      aiAutomation: level(m.ai.automation),
      income: midExperienced >= 110000 ? "Above average" : midExperienced >= 75000 ? "Average" : "Below average",
      education: maxYears >= 5 || occ.skillLevel === 1 ? "High" : maxYears >= 2 ? "Moderate" : "Low",
    },
  };
}

// ---------------------------------------------------------------- pathway feasibility

/** Subjects that satisfy a prerequisite (a harder maths counts for an easier one). */
const SATISFIES: Record<string, string[]> = {
  maths_general: ["maths_general", "maths_advanced", "maths_extension"],
  maths_advanced: ["maths_advanced", "maths_extension"],
};

const PATH_ROUTES: Record<EducationPath, Route[]> = {
  university: ["university"],
  vet: ["vet"],
  apprenticeship: ["apprenticeship", "traineeship"],
  work_learn: ["apprenticeship", "traineeship", "cadetship", "other"],
  business: [],
  defence_public: ["other"],
  gap_year: ["university", "vet"],
  unsure: [],
};

function prerequisiteReadiness(p: StudentProfile, occ: Occupation): { score: number; missing: string[] } {
  const missing = occ.subjects.oftenRequired.filter((s) => !(SATISFIES[s] ?? [s]).some((x) => p.currentSubjects.includes(x)));
  if (!missing.length) return { score: 1, missing };
  return { score: { 10: 0.75, 11: 0.5, 12: 0.3 }[p.yearLevel], missing };
}

function feasibility(p: StudentProfile, occ: Occupation, label: (id: string) => string) {
  const reasons: string[] = [];
  const cautions: string[] = [];
  const challenges: string[] = [];

  const prereq = prerequisiteReadiness(p, occ);
  if (prereq.missing.length) {
    const names = prereq.missing.map(label).join(" and ");
    challenges.push(`A strong ${names} pathway is recommended; courses often require it.`);
    cautions.push(
      p.yearLevel === 10
        ? `Courses often require ${names}. You can choose it for Years 11 and 12.`
        : `Courses often require ${names}. A bridging course or alternative entry pathway can cover it.`,
    );
  }

  const areas = [...new Set([...occ.subjectAreas.helpful, ...occ.subjectAreas.required])];
  const confidence = areas.length ? mean(areas.map((a) => p.subjects[a].confidence)) : mean(Object.values(p.subjects).map((s) => s.confidence));
  const needed = { open: 40, moderate: 55, high: 70 }[occ.entryCompetitiveness] + (occ.skillLevel === 1 ? 5 : 0);
  const academic = clamp01(confidence / needed);
  if (occ.entryCompetitiveness === "high") cautions.push("Places are competitive, so keep a backup pathway in mind.");
  if (academic < 0.8 && areas.length) challenges.push(`Building confidence in ${areas.slice(0, 2).map((a) => AREA_LABEL[a]).join(" and ")} would make entry easier.`);

  const routes = new Set(occ.pathways.map((x) => x.route));
  const chosen = p.educationPaths.filter((x) => x !== "unsure");
  let qualification: number;
  if (!chosen.length) qualification = 0.8;
  else if (chosen.some((x) => PATH_ROUTES[x].some((r) => routes.has(r)))) qualification = 1;
  else qualification = chosen.every((x) => x === "business") ? 0.6 : 0.4;
  if (qualification === 1) reasons.push("There's a way in through a path you said you'd consider.");
  if (qualification === 0.4) cautions.push("The usual ways in aren't among the paths you said you'd consider.");

  const minYears = Math.min(occ.timeToQualify.years[0], ...occ.pathways.map((x) => x.years[0]));
  const tol = p.studyTolerance.years;
  const duration = tol === null ? (p.studyTolerance.answer === "any" ? 1 : 0.8) : minYears <= tol ? 1 : Math.max(0.2, 1 - 0.15 * (minYears - tol));
  if (tol !== null && minYears > tol) challenges.push(`Requires about ${minYears} years of study or training, longer than you said you'd prefer.`);

  const breadth = routes.size >= 3 ? 1 : routes.size === 2 ? 0.8 : 0.5;
  if (routes.size >= 2) reasons.push(`There are ${routes.size} different ways in.`);

  const regional = occ.market.regionalBreadth / 100;
  const geography = { near_home: regional, regional, city: 1, state: 1, anywhere: 1, unsure: 0.9 }[p.geography];
  if ((p.geography === "regional" || p.geography === "near_home") && regional < 0.5) cautions.push("Jobs are concentrated in cities, which may mean moving.");

  const parts = { prerequisites: prereq.score, academic, qualification, duration, breadth, geography };
  const score = pct(weighted(FEASIBILITY_WEIGHTS, parts));

  let improvement: Match["improvement"] = null;
  if (prereq.missing.length) {
    const names = prereq.missing.map(label).join(" and ");
    const fixed = p.yearLevel === 10 ? 1 : 0.85;
    const to = pct(weighted(FEASIBILITY_WEIGHTS, { ...parts, prerequisites: fixed }));
    if (to > score) improvement = { to, action: p.yearLevel === 10 ? `if you select ${names} in Year 11` : `if you complete a ${names} bridging course` };
  }
  const stretch = prereq.missing.length > 0 || (tol !== null && minYears > tol) || academic < 0.8 || score < 70;
  return { detail: { score, parts, reasons, cautions }, challenges, improvement, stretch };
}

// ---------------------------------------------------------------- confidence

function dataQuality(occ: Occupation, outlook: Outlook): number {
  const basis = { "jsa-occupation": 1, "jsa-major-group-adjusted": 0.7, "jsa-major-group-qualitative": 0.5, none: 0.3 }[outlook.basis];
  const osca = occ.oscaSource === "abs" ? 1 : 0.9;
  const fields = Object.values(occ.evidence);
  const editorial = fields.filter((e) => e.startsWith("Bcome editorial")).length / (fields.length || 1);
  return mean([basis, osca, 1 - 0.5 * editorial]);
}

function confidenceFor(p: StudentProfile, occ: Occupation, outlook: Outlook): Match["confidence"] {
  const dq = dataQuality(occ, outlook);
  const score = weighted(CONFIDENCE_WEIGHTS, { completeness: p.quality.completeness, consistency: p.quality.consistency, dataQuality: dq });
  const lvl = score >= 0.8 ? "High" : score >= 0.6 ? "Moderate" : "Low";
  let note: string | null = null;
  if (lvl !== "High") {
    note = p.quality.lowInformation.length
      ? `We'd like to know more about ${p.quality.lowInformation[0]}.`
      : "Some of the job data for this career is still an estimate.";
  }
  return { score: Math.round(score * 100) / 100, level: lvl, note };
}

// ---------------------------------------------------------------- scoring one career

export function scoreOccupation(
  p: StudentProfile,
  occ: Occupation,
  jsa: JsaOutlookData,
  options: { subjectLabels?: Record<string, string>; portability?: number | null; outlook?: Outlook } = {},
): Match {
  const label = (id: string) => options.subjectLabels?.[id] ?? id;
  const outlook = options.outlook ?? computeOutlook(occ, jsa);
  const fit = personalFit(p, occ);
  const opp = futureOpportunity(occ, outlook, options.portability ?? null);
  const feas = feasibility(p, occ, label);
  const scores = {
    personalFit: { score: fit.score, parts: fit.parts, reasons: fit.reasons, cautions: fit.cautions },
    futureOpportunity: { score: opp.score, parts: opp.parts, reasons: opp.reasons, cautions: opp.cautions },
    pathwayFeasibility: feas.detail,
  };
  const score = Math.round(weighted(MATCH_WEIGHTS, { personalFit: fit.score, futureOpportunity: opp.score, pathwayFeasibility: feas.detail.score }));
  const order: ScoreName[] = ["personalFit", "futureOpportunity", "pathwayFeasibility"];
  return {
    occupation: occ,
    outlook,
    score,
    scores,
    strengths: fit.strengths,
    challenges: [...feas.challenges, ...fit.challenges].slice(0, 4),
    future: opp.future,
    improvement: feas.improvement,
    stretch: feas.stretch || fit.challenges.some((c) => c.startsWith("Building your confidence")),
    confidence: confidenceFor(p, occ, outlook),
    group: "other",
    reasons: order.flatMap((k) => scores[k].reasons),
    cautions: order.flatMap((k) => scores[k].cautions),
  };
}

// ---------------------------------------------------------------- ranking, diversity and groups

/** Personal fit first (in 5-point bands), then the match score. */
export function byPersonalFitFirst(a: { fit: number; score: number; title: string }, b: { fit: number; score: number; title: string }): number {
  const band = (n: number) => Math.floor(n / FIT_BAND);
  return band(b.fit) - band(a.fit) || b.score - a.score || b.fit - a.fit || a.title.localeCompare(b.title);
}

function careerSimilarity(a: Occupation, b: Occupation, graph?: SkillsGraph): number {
  const sameArea = a.osca.slice(0, 3) === b.osca.slice(0, 3) ? 1 : a.osca.slice(0, 2) === b.osca.slice(0, 2) ? 0.5 : 0;
  return graph ? 0.6 * graph.overlap(a, b) + 0.4 * sameArea : sameArea;
}

/** Greedy diversity reranking: DisplayFit = PersonalFit − 8 × similarity to careers already chosen. */
function diversify(matches: Match[], graph?: SkillsGraph): Match[] {
  const pool = [...matches];
  const chosen: Match[] = [];
  while (pool.length) {
    const ranked = pool
      .map((m) => {
        const sim = Math.max(0, ...chosen.map((c) => careerSimilarity(m.occupation, c.occupation, graph)));
        return { m, fit: m.scores.personalFit.score - DIVERSITY_PENALTY * sim, score: m.score - DIVERSITY_PENALTY * sim, title: m.occupation.title };
      })
      .sort(byPersonalFitFirst);
    const next = ranked[0].m;
    chosen.push(next);
    pool.splice(pool.indexOf(next), 1);
  }
  return chosen;
}

/**
 * Scores every career, keeps those with a strong personal fit, reranks for diversity and
 * sorts them into Best matches (up to 5), Worth exploring (up to 2) and one Wildcard.
 * Returns recommended careers first (best, explore, wildcard), then the rest by personal fit.
 */
export function matchCareers(p: StudentProfile, occupations: Occupation[], jsa: JsaOutlookData, options: MatchOptions = {}): Match[] {
  const { limit = 10, subjectLabels = {}, graph } = options;
  const outlooks = new Map(occupations.map((o) => [o.osca, computeOutlook(o, jsa)]));
  const growing = (o: Occupation) => ["strong", "good"].includes(outlooks.get(o.osca)!.band10);
  const all = occupations.map((occ) =>
    scoreOccupation(p, occ, jsa, { subjectLabels, outlook: outlooks.get(occ.osca), portability: graph ? graph.portability(occ, growing) : null }),
  );
  const rank = (ms: Match[]) =>
    [...ms].sort((a, b) =>
      byPersonalFitFirst(
        { fit: a.scores.personalFit.score, score: a.score, title: a.occupation.title },
        { fit: b.scores.personalFit.score, score: b.score, title: b.occupation.title },
      ),
    );
  const ranked = rank(all);

  const bestFit = ranked[0].scores.personalFit.score;
  const threshold = Math.max(FIT_FLOOR, bestFit - FIT_WINDOW);
  let eligible = ranked.filter((m) => m.scores.personalFit.score >= threshold);
  if (eligible.length < 5) eligible = ranked.slice(0, 5); // always offer at least five options, still in personal-fit order

  // Best matches are the five strongest personal fits (spread across fields). Worth exploring takes the
  // next strong fits, preferring ones that need extra subjects, skills or study.
  const diverse = diversify(eligible, graph);
  const best = diverse.slice(0, 5);
  const remaining = diverse.slice(5);
  const explore = [...remaining.filter((m) => m.stretch), ...remaining.filter((m) => !m.stretch)].slice(0, 2);
  explore.sort((a, b) => remaining.indexOf(a) - remaining.indexOf(b));

  const shown = [...best, ...explore];
  const shownMajor = new Set(shown.map((m) => m.occupation.osca[0]));
  const shownFirstLetter = new Set(shown.map((m) => m.occupation.riasec[0]));
  const wildcard =
    rank(all.filter((m) => !shown.includes(m) && m.scores.personalFit.score >= Math.max(FIT_FLOOR, bestFit - FIT_WINDOW - 3))).find(
      (m) => !shownMajor.has(m.occupation.osca[0]) || !shownFirstLetter.has(m.occupation.riasec[0]),
    ) ?? null;

  best.forEach((m) => (m.group = "best"));
  explore.forEach((m) => (m.group = "explore"));
  if (wildcard) wildcard.group = "wildcard";
  const recommended = [...best, ...explore, ...(wildcard ? [wildcard] : [])];
  const rest = ranked.filter((m) => !recommended.includes(m));
  return [...recommended, ...rest].slice(0, Math.max(limit, recommended.length));
}

/** The match fields sent to the browser. */
export function toMatchSummary(m: Match) {
  const pick = (k: ScoreName) => ({ score: m.scores[k].score, reasons: m.scores[k].reasons, cautions: m.scores[k].cautions });
  return {
    id: m.occupation.osca,
    osca: m.occupation.osca,
    title: m.occupation.title,
    summary: m.occupation.summary,
    family: m.occupation.family,
    photo: (m.occupation as Occupation & { photo?: { src: string; credit?: string } }).photo,
    tags: careerTags(m.occupation, m.outlook),
    /** Personal-fit components (0–1): interests, skills, values, environment, subjects. */
    fitParts: m.scores.personalFit.parts,
    score: m.score,
    group: m.group,
    scores: { personalFit: pick("personalFit"), futureOpportunity: pick("futureOpportunity"), pathwayFeasibility: pick("pathwayFeasibility") },
    strengths: m.strengths,
    challenges: m.challenges,
    future: m.future,
    improvement: m.improvement,
    stretch: m.stretch,
    confidence: m.confidence,
    outlook: m.outlook,
    reasons: m.reasons,
    cautions: m.cautions,
    salary: m.occupation.salary,
    timeToQualify: m.occupation.timeToQualify,
    evidence: m.occupation.evidence,
  };
}

export type MatchSummary = ReturnType<typeof toMatchSummary>;

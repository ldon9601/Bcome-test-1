import { careerFacts } from "../careers/facts.ts";
import type { Match } from "../careers/matching.ts";
import type { SkillsGraph } from "../careers/skills.ts";
import type { EarningsData, JsaOutlookData } from "../careers/types.ts";
import {
  DNA_DIMS,
  DNA_NAMES,
  PIDT,
  RIASEC,
  RIASEC_NAMES,
  SKILL_DIMS,
  SKILL_NAMES,
  VALUE_DIMS,
  VALUE_NAMES,
  type AuState,
  type RiasecType,
  type StudentProfile,
} from "../questionnaire/types.ts";

/** Tertiary admissions centre by state, for university applications. */
export const ADMISSIONS_CENTRE: Record<AuState, string> = {
  NSW: "UAC",
  ACT: "UAC",
  VIC: "VTAC",
  QLD: "QTAC",
  WA: "TISC",
  SA: "SATAC",
  NT: "SATAC",
  TAS: "the University of Tasmania (direct application)",
};

export function hollandWords(code: string): string {
  const words = [...code].map((t) => RIASEC_NAMES[t as RiasecType]);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words.join("");
}

const sortDesc = <K extends string>(rec: Record<K, number>, keys: readonly K[]) => [...keys].sort((a, b) => rec[b] - rec[a]);

/** The Career DNA the student sees before any careers ("first show them themselves"). */
export function careerDnaView(p: StudentProfile) {
  return {
    dimensions: DNA_DIMS.map((d) => ({ id: d, label: DNA_NAMES[d], score: p.dna[d] })),
    interests: sortDesc(p.riasec.scores, RIASEC).map((t) => ({ id: t, label: RIASEC_NAMES[t], score: p.riasec.scores[t] })),
    strongestSignals: sortDesc(p.skills, SKILL_DIMS)
      .slice(0, 5)
      .map((d) => ({ id: d, label: SKILL_NAMES[d], score: p.skills[d] })),
    values: sortDesc(p.values, VALUE_DIMS).map((d) => ({ id: d, label: VALUE_NAMES[d], score: p.values[d] })),
    workWith: sortDesc(p.environment, PIDT),
  };
}

/** A plain-language reading of the Career DNA, built from the student's own answers. */
export function dnaSummary(p: StudentProfile): string {
  if (p.riasec.differentiation < 20) {
    return "Your interests are spread fairly evenly, with no single area standing out yet. That's common at your stage and keeps lots of doors open, so trying a few different things will tell you most.";
  }
  const view = careerDnaView(p);
  const drawn: Record<RiasecType, string> = {
    R: "practical, hands-on work",
    I: "complex problems and understanding how things work",
    A: "creating and new ideas",
    S: "helping and working with people",
    E: "leading, persuading and making things happen",
    C: "organising and getting the details right",
  };
  const [i1, i2] = view.interests;
  const env = p.environment;
  const style = [
    env.variety >= 65 ? "variety over repetitive work" : env.variety <= 35 ? "regular, predictable work" : null,
    env.teamwork >= 65 ? "working in a team" : env.teamwork <= 35 ? "working independently" : null,
    env.physical >= 65 ? "being active and hands-on" : env.physical <= 35 ? "seated, digital work" : null,
  ].filter(Boolean);
  const [v1, v2] = view.values;
  const values = `${v1.label.toLowerCase()} and ${v2.label.toLowerCase()}`;
  const opening = `You appear most energised by ${drawn[i1.id as RiasecType]} and ${drawn[i2.id as RiasecType]}.`;
  return style.length ? `${opening} You prefer ${style.slice(0, 2).join(" and ")}, and value ${values} most.` : `${opening} You value ${values} most.`;
}

/** Everything the plan generator is allowed to draw on, as plain data. */
export function buildPlanContext(
  profile: StudentProfile,
  matches: Match[],
  jsa: JsaOutlookData,
  subjectLabels: Record<string, string>,
  graph: SkillsGraph,
  earnings: EarningsData,
) {
  const label = (id: string) => subjectLabels[id] ?? id;
  const career = (m: Match) => ({
    occupationId: m.occupation.osca,
    title: m.occupation.title,
    group: m.group,
    matchScore: m.score,
    scores: {
      personalFit: m.scores.personalFit.score,
      futureOpportunity: m.scores.futureOpportunity.score,
      pathwayFeasibility: m.scores.pathwayFeasibility.score,
    },
    strengths: m.strengths,
    challenges: m.challenges,
    future: m.future,
    improvement: m.improvement,
    confidence: m.confidence,
    hollandCode: m.occupation.riasec,
    skillProfile: m.occupation.profile.skills,
    subjectsHelpful: m.occupation.subjects.helpful.map(label),
    subjectsOftenRequired: m.occupation.subjects.oftenRequired.map(label),
    missingPrerequisites: m.occupation.subjects.oftenRequired
      .filter((s) => !profile.currentSubjects.includes(s) && !(s === "maths_advanced" && profile.currentSubjects.includes("maths_extension")))
      .map(label),
    facts: careerFacts(m.occupation, graph, earnings, profile.yearLevel),
    outlook: {
      summary: m.outlook.summary,
      growth5Pct: m.outlook.growth5Pct,
      growth10Pct: m.outlook.growth10Pct,
      isEstimate: m.outlook.basis !== "jsa-occupation",
      tenYearBand: m.outlook.band10,
      fifteenYearIndicativeBand: m.outlook.band15,
      fifteenYearReasons: m.outlook.rationale15,
    },
    evidence: m.occupation.evidence,
    reasonsItFits: m.reasons,
    cautions: m.cautions,
  });

  const recommended = matches.filter((m) => m.group !== "other");
  return {
    student: {
      yearLevel: profile.yearLevel,
      state: profile.state,
      admissionsCentre: ADMISSIONS_CENTRE[profile.state],
      geography: profile.geography,
      currentSubjects: profile.currentSubjects.map(label),
      hollandCode: profile.riasec.code,
      hollandCodeMeaning: hollandWords(profile.riasec.code),
      profileIsFlat: profile.riasec.differentiation < 20,
      skills: profile.skills,
      educationPaths: profile.educationPaths,
      studyTolerance: profile.studyTolerance,
      lowInformation: profile.quality.lowInformation,
    },
    careerDna: { ...careerDnaView(profile), summary: dnaSummary(profile) },
    careers: recommended.map(career),
    labourMarket: {
      source: `${jsa.source.title} (${jsa.source.url})`,
      allJobsGrowth10Pct: jsa.total.growth10Pct,
      headlines: jsa.headlines,
    },
    instrumentVersion: profile.instrumentVersion,
  };
}

export type PlanContext = ReturnType<typeof buildPlanContext>;
export type ContextCareer = PlanContext["careers"][number];

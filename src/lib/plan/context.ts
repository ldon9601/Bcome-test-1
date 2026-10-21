import { careerFacts } from "../careers/facts.ts";
import type { Match } from "../careers/matching.ts";
import type { SkillsGraph } from "../careers/skills.ts";
import type { EarningsData, JsaOutlookData } from "../careers/types.ts";
import { RIASEC_NAMES, type AuState, type RiasecType, type StudentProfile } from "../questionnaire/types.ts";

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

/** How many matches the plan focuses on, and how many more are offered as alternatives. */
export const TOP_N = 3;
export const ALT_N = 3;

export function hollandWords(code: string): string {
  const words = [...code].map((t) => RIASEC_NAMES[t as RiasecType].split(" ")[0]);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words.join("");
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
    matchScore: m.score,
    scores: {
      personalFit: m.scores.personalFit.score,
      futureOpportunity: m.scores.futureOpportunity.score,
      pathwayFeasibility: m.scores.pathwayFeasibility.score,
    },
    hollandCode: m.occupation.riasec,
    subjectsHelpful: m.occupation.subjects.helpful.map(label),
    subjectsOftenRequired: m.occupation.subjects.oftenRequired.map(label),
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
    reasonsItFits: m.reasons,
    cautions: m.cautions,
  });

  return {
    student: {
      yearLevel: profile.yearLevel,
      state: profile.state,
      admissionsCentre: ADMISSIONS_CENTRE[profile.state],
      hollandCode: profile.riasec.code,
      hollandCodeMeaning: hollandWords(profile.riasec.code),
      interestScores: profile.riasec.scores,
      profileIsFlat: profile.riasec.differentiation < 20,
      topValues: profile.topValues,
      subjectsEnjoyed: profile.subjectsEnjoyed.map(label),
      subjectsStrong: profile.subjectsStrong.map(label),
      studyPreference: profile.studyPreference,
      apprenticeshipAreas: profile.apprenticeshipAreas,
      willingToRelocate: profile.relocation,
    },
    topCareers: matches.slice(0, TOP_N).map(career),
    alternativeCareers: matches.slice(TOP_N, TOP_N + ALT_N).map(career),
    labourMarket: {
      source: `${jsa.source.title} (${jsa.source.url})`,
      allJobsGrowth10Pct: jsa.total.growth10Pct,
      headlines: jsa.headlines,
    },
  };
}

export type PlanContext = ReturnType<typeof buildPlanContext>;

import { courseOptions } from "./careers/courses.ts";
import { matchCareers, toMatchSummary, type Match } from "./careers/matching.ts";
import { courseOfferings, earningsData, jsaOutlook, occupationData, questionBank, skillsGraph, subjectLabels } from "./data.ts";
import { buildPlanContext, careerDnaView } from "./plan/context.ts";
import { generatePlan, type GenerateOptions } from "./plan/generate.ts";
import type { CareerPlan } from "./plan/types.ts";
import { buildProfile } from "./questionnaire/scoring.ts";
import type { Answers, StudentProfile } from "./questionnaire/types.ts";

export interface AdviceResult {
  profile: StudentProfile;
  matches: Match[];
  plan: CareerPlan;
}

/** The whole pipeline: answers → profile → matched careers → written plan. */
export async function advise(answers: Answers, options: GenerateOptions = {}): Promise<AdviceResult> {
  const profile = buildProfile(questionBank, answers);
  const matches = matchCareers(profile, occupationData.occupations, jsaOutlook, { limit: 10, subjectLabels, graph: skillsGraph });
  const ctx = buildPlanContext(profile, matches, jsaOutlook, subjectLabels, skillsGraph, earningsData);
  const plan = await generatePlan(ctx, options);
  return { profile, matches, plan };
}

/** What the browser receives: the profile, the Career DNA to show first, recommended careers and the plan. */
export function resultPayload(r: AdviceResult) {
  return {
    profile: r.profile,
    dna: careerDnaView(r.profile),
    matches: r.matches
      .filter((m) => m.group !== "other")
      .map((m) => ({
        ...toMatchSummary(m),
        anzsco: { unitGroup: m.occupation.anzsco, title: m.occupation.anzscoTitle, occupation: m.occupation.anzscoOccupation, profile: m.occupation.jsaProfile ?? null },
        // Specific university and TAFE courses, ordered for this student's state, subjects and study preferences.
        courses: courseOptions(m.occupation, r.profile, courseOfferings),
      })),
    plan: r.plan,
  };
}

export type ResultPayload = ReturnType<typeof resultPayload>;
export type ResultMatch = ResultPayload["matches"][number];

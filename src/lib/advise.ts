import { matchCareers, type Match } from "./careers/matching.ts";
import { jsaOutlook, occupationData, questionBank, subjectLabels } from "./data.ts";
import { buildPlanContext } from "./plan/context.ts";
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
  const matches = matchCareers(profile, occupationData.occupations, jsaOutlook, { limit: 10, subjectLabels });
  const ctx = buildPlanContext(profile, matches, jsaOutlook, subjectLabels);
  const plan = await generatePlan(ctx, options);
  return { profile, matches, plan };
}

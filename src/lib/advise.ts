import { courseOptions } from "./careers/courses.ts";
import { checkIdeas, sourceNote, type IdeaCheck } from "./careers/ideas.ts";
import { matchCareers, scoreAll, toMatchSummary, type Match } from "./careers/matching.ts";
import { resilience } from "./careers/resilience.ts";
import { courseOfferings, earningsData, jsaOutlook, occupationData, questionBank, skillsGraph, subjectLabels } from "./data.ts";
import { buildPlanContext, careerDnaView } from "./plan/context.ts";
import { generatePlan, type GenerateOptions } from "./plan/generate.ts";
import { templateCareer } from "./plan/template.ts";
import type { CareerPlan, PlanCareer } from "./plan/types.ts";
import { buildProfile } from "./questionnaire/scoring.ts";
import type { Answers, StudentProfile } from "./questionnaire/types.ts";
import { labourSnapshot } from "./labour.ts";

export interface AdviceResult {
  profile: StudentProfile;
  matches: Match[];
  plan: CareerPlan;
  /** The careers the student already had in mind, checked against their profile. */
  ideas: { match: Match; check: IdeaCheck; plan: PlanCareer }[];
  /** Every career scored for this student (for plan B neighbours). Not sent to the browser. */
  scored: Match[];
}

/** The whole pipeline: answers → profile → matched careers → written plan. */
export async function advise(answers: Answers, options: GenerateOptions = {}): Promise<AdviceResult> {
  const profile = buildProfile(questionBank, answers);
  const scored = scoreAll(profile, occupationData.occupations, jsaOutlook, { subjectLabels, graph: skillsGraph });
  const matches = matchCareers(profile, occupationData.occupations, jsaOutlook, { limit: 10, subjectLabels, graph: skillsGraph, scored });
  const checked = checkIdeas(profile.ideas?.careers ?? [], scored, matches.filter((m) => m.group !== "other"));
  const ctx = buildPlanContext(profile, matches, jsaOutlook, subjectLabels, skillsGraph, earningsData);
  const plan = await generatePlan(ctx, options);
  // Ideas get the same written detail as recommended careers (from templates), without joining the recommendations.
  const ideaCtx = checked.length
    ? buildPlanContext(profile, checked.map(({ match }) => ({ ...match, group: "explore" as const })), jsaOutlook, subjectLabels, skillsGraph, earningsData)
    : null;
  const ideas = checked.map(({ match, check }, i) => ({ match, check, plan: { ...templateCareer(ideaCtx!.careers[i], ideaCtx!), group: match.group } }));
  return { profile, matches, plan, ideas, scored };
}

/** What the browser receives: the profile, the Career DNA to show first, recommended careers and the plan. */
/** `at`: when the assessment was completed, so vacancy figures are the ones current at that time. */
export function resultPayload(r: AdviceResult, at: Date = new Date()) {
  const card = (m: Match) => ({
    ...toMatchSummary(m),
    anzsco: { unitGroup: m.occupation.anzsco, title: m.occupation.anzscoTitle, occupation: m.occupation.anzscoOccupation, profile: m.occupation.jsaProfile ?? null },
    // Specific university and TAFE courses, ordered for this student's state, subjects and study preferences.
    courses: courseOptions(m.occupation, r.profile, courseOfferings),
    // Skill level, industry, vacancies and projections as they stood when the assessment was done.
    labour: labourSnapshot(m.occupation, r.profile.state, at, jsaOutlook),
    // Plan B: neighbouring careers and how resilient this one is if things change.
    resilience: resilience(m, r.scored, skillsGraph),
  });
  return {
    profile: r.profile,
    dna: careerDnaView(r.profile),
    matches: r.matches.filter((m) => m.group !== "other").map(card),
    ideas: {
      sources: r.profile.ideas?.sources ?? [],
      note: sourceNote(r.profile.ideas?.sources ?? []),
      careers: r.ideas.map(({ match, check, plan }) => ({ ...card(match), idea: check, plan })),
    },
    plan: r.plan,
  };
}

export type ResultPayload = ReturnType<typeof resultPayload>;
export type ResultMatch = ResultPayload["matches"][number];
export type ResultIdea = ResultPayload["ideas"]["careers"][number];

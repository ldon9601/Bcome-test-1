import { nextQuestion } from "../../src/lib/questionnaire/engine.ts";
import type { Answers, QuestionBank, RiasecType, StudyPreference, WorkValue } from "../../src/lib/questionnaire/types.ts";

/**
 * Imaginary students used to check that matching and plans make sense.
 * Each persona answers the real questionnaire through the adaptive engine.
 */
export interface Persona {
  key: string;
  name: string;
  yearLevel: 10 | 11 | 12;
  state: string;
  /** How much they enjoy each interest area, 1–5. */
  interests: Record<RiasecType, number>;
  highValues: WorkValue[];
  subjectsEnjoyed: string[];
  subjectsStrong: string[];
  studyPreference: StudyPreference;
  apprenticeshipAreas?: string[];
  relocation: "local" | "state" | "anywhere";
  /** At least one of these should appear in the top five matches. */
  expectAnyOf: string[];
}

export const PERSONAS: Persona[] = [
  {
    key: "mia-health",
    name: "Mia, Year 10, NSW: caring and science-minded, wants uni",
    yearLevel: 10,
    state: "NSW",
    interests: { R: 2, I: 4, A: 2, S: 5, E: 2, C: 3 },
    highValues: ["helping", "impact", "security"],
    subjectsEnjoyed: ["biology", "pdhpe", "english"],
    subjectsStrong: ["biology", "chemistry"],
    studyPreference: "university",
    relocation: "state",
    expectAnyOf: ["registered-nurse", "physiotherapist", "occupational-therapist", "paramedic", "psychologist"],
  },
  {
    key: "jack-electrical",
    name: "Jack, Year 11, QLD: hands-on, wants an electrical apprenticeship",
    yearLevel: 11,
    state: "QLD",
    interests: { R: 5, I: 3, A: 1, S: 2, E: 2, C: 3 },
    highValues: ["income", "security", "variety"],
    subjectsEnjoyed: ["construction_vet", "physics", "maths_general"],
    subjectsStrong: ["construction_vet", "maths_general"],
    studyPreference: "apprenticeship",
    apprenticeshipAreas: ["electrical"],
    relocation: "local",
    expectAnyOf: ["electrician", "air-conditioning-and-refrigeration-mechanic"],
  },
  {
    key: "priya-tech",
    name: "Priya, Year 12, VIC: analytical, strong at maths and coding",
    yearLevel: 12,
    state: "VIC",
    interests: { R: 3, I: 5, A: 2, S: 1, E: 2, C: 4 },
    highValues: ["income", "independence", "creativity"],
    subjectsEnjoyed: ["maths_extension", "it_software", "physics"],
    subjectsStrong: ["maths_extension", "maths_advanced", "it_software"],
    studyPreference: "university",
    relocation: "anywhere",
    expectAnyOf: ["software-developer-programmer", "data-scientist-statistician-actuary", "cyber-security-and-systems-specialist"],
  },
  {
    key: "leo-creative",
    name: "Leo, Year 11, WA: creative and persuasive, not sure what's next",
    yearLevel: 11,
    state: "WA",
    interests: { R: 2, I: 2, A: 5, S: 3, E: 4, C: 2 },
    highValues: ["creativity", "variety", "independence"],
    subjectsEnjoyed: ["visual_arts", "media", "business"],
    subjectsStrong: ["visual_arts", "media"],
    studyPreference: "unsure",
    relocation: "state",
    expectAnyOf: ["graphic-web-designer", "marketing-professional", "journalist-writer", "architect-landscape-architect"],
  },
  {
    key: "ava-flat",
    name: "Ava, Year 12, SA: mild interest in everything, unsure",
    yearLevel: 12,
    state: "SA",
    interests: { R: 3, I: 3, A: 3, S: 3, E: 3, C: 3 },
    highValues: ["security", "teamwork"],
    subjectsEnjoyed: ["english", "geography"],
    subjectsStrong: ["english"],
    studyPreference: "unsure",
    relocation: "local",
    expectAnyOf: [],
  },
  {
    key: "noah-leader",
    name: "Noah, Year 10, TAS: debater who wants to lead and make a difference",
    yearLevel: 10,
    state: "TAS",
    interests: { R: 1, I: 3, A: 2, S: 4, E: 5, C: 3 },
    highValues: ["leadership", "impact", "income"],
    subjectsEnjoyed: ["legal", "history", "business"],
    subjectsStrong: ["english", "legal"],
    studyPreference: "university",
    relocation: "anywhere",
    expectAnyOf: ["lawyer-solicitor", "health-and-welfare-services-manager", "management-consultant-business-analyst", "social-worker"],
  },
];

/** Small, deterministic variation so not every item of a type gets the same rating. */
function jitter(id: string): number {
  const n = Number(id.slice(1));
  return n % 4 === 0 ? -1 : n % 5 === 0 ? 1 : 0;
}

/** Answers the questionnaire as this persona would, following the adaptive engine. */
export function simulate(bank: QuestionBank, p: Persona): { answers: Answers; asked: number } {
  const answers: Answers = {};
  let asked = 0;
  for (let q = nextQuestion(bank, answers); q; q = nextQuestion(bank, answers)) {
    asked++;
    if (asked > 200) throw new Error("Questionnaire did not finish");
    if (q.kind === "likert" && q.scale.type === "riasec") {
      answers[q.id] = String(Math.max(1, Math.min(5, p.interests[q.scale.code] + jitter(q.id))));
    } else if (q.kind === "likert") {
      answers[q.id] = p.highValues.includes(q.scale.code as WorkValue) ? "5" : "3";
    } else {
      const map: Record<string, string | string[]> = {
        year_level: String(p.yearLevel),
        state: p.state,
        subjects_enjoyed: p.subjectsEnjoyed,
        subjects_strong: p.subjectsStrong,
        study_preference: p.studyPreference,
        apprenticeship_area: p.apprenticeshipAreas ?? [],
        unsure_reason: "too_many",
        relocation: p.relocation,
      };
      const v = map[q.id];
      if (v === undefined) throw new Error(`Persona has no answer for ${q.id}`);
      answers[q.id] = v;
    }
  }
  return { answers, asked };
}

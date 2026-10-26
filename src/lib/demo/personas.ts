import { nextQuestion } from "../questionnaire/engine.ts";
import type {
  Answers,
  EducationPath,
  Geography,
  Pidt,
  QuestionBank,
  RiasecType,
  SkillDim,
  StyleDim,
  SubjectArea,
  ValueDim,
} from "../questionnaire/types.ts";

/**
 * Imaginary students used to check that matching and plans make sense.
 * Each persona answers the real 36-question Career Profile, in order.
 * Ratings are 1–5 as on the questionnaire.
 */
export interface Persona {
  key: string;
  name: string;
  yearLevel: 10 | 11 | 12;
  state: string;
  geography: Geography;
  currentSubjects: string[];
  interests: Record<RiasecType, number>;
  skills: Record<SkillDim, number>;
  values: Record<ValueDim, number>;
  /** Most to least appealing. */
  pidt: Pidt[];
  styles: Record<StyleDim, number>;
  /** [enjoyment, confidence]; areas left out are answered 2, 2. */
  subjects: Partial<Record<SubjectArea, [number, number]>>;
  paths: EducationPath[];
  tolerance: "lt1" | "1-2" | "3-4" | "5-6" | "7+" | "any" | "unknown";
  /** OSCA codes: at least one of these should be recommended. */
  expectAnyOf: string[];
  /** Careers they already have in mind (question career_ideas) and where the ideas came from. */
  ideas?: string[];
  ideaSources?: string[];
}

const flat = <K extends string>(keys: readonly K[], n: number) => Object.fromEntries(keys.map((k) => [k, n])) as Record<K, number>;

export const PERSONAS: Persona[] = [
  {
    key: "mia-health",
    ideas: ["264231", "281331"],
    ideaSources: ["family"],
    name: "Mia, Year 10, NSW: caring and science-minded, wants uni",
    yearLevel: 10,
    state: "NSW",
    geography: "state",
    currentSubjects: ["english", "maths_advanced", "biology", "chemistry", "pdhpe", "history"],
    interests: { R: 2, I: 4, A: 2, S: 5, E: 2, C: 3 },
    skills: { quantitative: 3, communication: 4, scientific: 4, digital: 3, spatial: 2, practical: 3, interpersonal: 5, leadership: 3 },
    values: { purpose: 5, financial: 3, security: 4, autonomy: 3, creativity: 2, leadership: 2, worklife: 3, learning: 4 },
    pidt: ["people", "ideas", "data", "things"],
    styles: { teamwork: 4, flexibility: 3, physical: 4, variety: 4 },
    subjects: { mathematics: [3, 3], biology: [5, 4], chemistry: [4, 3], english: [4, 4], humanities: [3, 3] },
    paths: ["university"],
    tolerance: "3-4",
    expectAnyOf: ["2654", "262431", "262331", "269432", "261231", "262631"],
  },
  {
    key: "jack-electrical",
    ideas: ["299131"],
    ideaSources: ["media", "self"],
    name: "Jack, Year 11, QLD: hands-on, wants an apprenticeship",
    yearLevel: 11,
    state: "QLD",
    geography: "near_home",
    currentSubjects: ["maths_general", "construction_vet", "physics", "english"],
    interests: { R: 5, I: 3, A: 1, S: 2, E: 2, C: 3 },
    skills: { quantitative: 3, communication: 2, scientific: 3, digital: 3, spatial: 4, practical: 5, interpersonal: 3, leadership: 2 },
    values: { purpose: 3, financial: 5, security: 5, autonomy: 3, creativity: 2, leadership: 2, worklife: 4, learning: 2 },
    pidt: ["things", "data", "people", "ideas"],
    styles: { teamwork: 3, flexibility: 2, physical: 5, variety: 3 },
    subjects: { mathematics: [3, 3], physics: [4, 3], computing: [3, 3], practical: [5, 5] },
    paths: ["apprenticeship", "work_learn"],
    tolerance: "3-4",
    expectAnyOf: ["381231", "382131", "363131", "332232", "351131"],
  },
  {
    key: "priya-tech",
    name: "Priya, Year 12, VIC: analytical, strong at maths and coding",
    yearLevel: 12,
    state: "VIC",
    geography: "anywhere",
    currentSubjects: ["maths_extension", "maths_advanced", "it_software", "physics", "english"],
    interests: { R: 3, I: 5, A: 3, S: 1, E: 2, C: 4 },
    skills: { quantitative: 5, communication: 3, scientific: 4, digital: 5, spatial: 3, practical: 2, interpersonal: 2, leadership: 2 },
    values: { purpose: 2, financial: 4, security: 3, autonomy: 5, creativity: 4, leadership: 2, worklife: 3, learning: 5 },
    pidt: ["data", "ideas", "things", "people"],
    styles: { teamwork: 2, flexibility: 4, physical: 1, variety: 4 },
    subjects: { mathematics: [5, 5], chemistry: [3, 3], physics: [4, 4], english: [3, 3], computing: [5, 5] },
    paths: ["university"],
    tolerance: "3-4",
    expectAnyOf: ["273333", "223234", "271133"],
  },
  {
    key: "leo-creative",
    name: "Leo, Year 11, WA: creative and persuasive",
    yearLevel: 11,
    state: "WA",
    geography: "city",
    currentSubjects: ["visual_arts", "media", "business", "english", "maths_general"],
    interests: { R: 2, I: 2, A: 5, S: 3, E: 4, C: 2 },
    skills: { quantitative: 2, communication: 4, scientific: 2, digital: 4, spatial: 4, practical: 3, interpersonal: 4, leadership: 3 },
    values: { purpose: 3, financial: 3, security: 2, autonomy: 4, creativity: 5, leadership: 3, worklife: 4, learning: 3 },
    pidt: ["ideas", "people", "things", "data"],
    styles: { teamwork: 3, flexibility: 5, physical: 2, variety: 5 },
    subjects: { arts: [5, 4], english: [4, 4], business: [4, 3], computing: [4, 4] },
    paths: ["university", "vet"],
    tolerance: "3-4",
    expectAnyOf: ["242332", "242133", "221534", "231332", "241131"],
  },
  {
    key: "ava-flat",
    name: "Ava, Year 12, SA: mild interest in everything, unsure",
    yearLevel: 12,
    state: "SA",
    geography: "near_home",
    currentSubjects: ["english", "geography", "maths_general"],
    interests: flat(["R", "I", "A", "S", "E", "C"] as const, 3),
    skills: flat(["quantitative", "communication", "scientific", "digital", "spatial", "practical", "interpersonal", "leadership"] as const, 3),
    values: flat(["purpose", "financial", "security", "autonomy", "creativity", "leadership", "worklife", "learning"] as const, 3),
    pidt: ["people", "ideas", "data", "things"],
    styles: { teamwork: 3, flexibility: 3, physical: 3, variety: 3 },
    subjects: Object.fromEntries(["mathematics", "biology", "chemistry", "physics", "english", "humanities", "business", "computing", "arts", "practical"].map((a) => [a, [3, 3]])),
    paths: ["unsure"],
    tolerance: "unknown",
    expectAnyOf: [],
  },
  {
    key: "noah-leader",
    name: "Noah, Year 10, TAS: debater who wants to lead and make a difference",
    yearLevel: 10,
    state: "TAS",
    geography: "anywhere",
    currentSubjects: ["english", "legal", "history", "business", "maths_general"],
    interests: { R: 1, I: 3, A: 2, S: 4, E: 5, C: 3 },
    skills: { quantitative: 3, communication: 5, scientific: 3, digital: 3, spatial: 2, practical: 2, interpersonal: 4, leadership: 5 },
    values: { purpose: 5, financial: 4, security: 3, autonomy: 3, creativity: 3, leadership: 5, worklife: 2, learning: 4 },
    pidt: ["people", "ideas", "data", "things"],
    styles: { teamwork: 4, flexibility: 4, physical: 2, variety: 5 },
    subjects: { english: [5, 5], humanities: [5, 4], business: [4, 4], mathematics: [3, 3] },
    paths: ["university"],
    tolerance: "5-6",
    expectAnyOf: ["281331", "1413", "223432", "261331", "251331"],
  },
];

/** The two interest items per type differ by one point for some types, as real answers do. */
function itemRating(base: number, questionNumber: number): number {
  const shift = questionNumber % 4 === 0 ? -1 : 0;
  return Math.max(1, Math.min(5, base + shift));
}

/** Answers the Career Profile as this persona would, in the order the app asks. */
export function simulate(bank: QuestionBank, p: Persona): { answers: Answers; asked: number } {
  const answers: Answers = {};
  let asked = 0;
  for (let q = nextQuestion(bank, answers); q; q = nextQuestion(bank, answers)) {
    if (++asked > 100) throw new Error("Questionnaire did not finish");
    switch (q.kind) {
      case "likert": {
        const d = q.dimension;
        const base = d.type === "riasec" ? p.interests[d.code] : d.type === "skill" ? p.skills[d.code] : p.values[d.code];
        answers[q.id] = String(d.type === "riasec" ? itemRating(base, q.number ?? 0) : base);
        break;
      }
      case "bipolar":
        answers[q.id] = String(p.styles[q.dimension.code]);
        break;
      case "rank":
        answers[q.id] = [...p.pidt];
        break;
      case "matrix":
        answers[q.id] = Object.fromEntries(
          q.rows.flatMap((r) => {
            const [enj, conf] = p.subjects[r.value as SubjectArea] ?? [2, 2];
            return [[`${r.value}.enjoyment`, String(enj)], [`${r.value}.confidence`, String(conf)]];
          }),
        );
        break;
      default: {
        const map: Record<string, string | string[]> = {
          year_level: String(p.yearLevel),
          state: p.state,
          current_subjects: p.currentSubjects,
          geography: p.geography,
          q35: p.paths,
          q36: p.tolerance,
          career_ideas: p.ideas?.length ? p.ideas : ["none"],
          idea_source: p.ideaSources ?? ["self"],
        };
        const v = map[q.id];
        if (v === undefined) throw new Error(`Persona has no answer for ${q.id}`);
        answers[q.id] = v;
      }
    }
  }
  return { answers, asked };
}

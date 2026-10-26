import {
  AU_STATES,
  DNA_DIMS,
  EDUCATION_PATHS,
  GEOGRAPHY,
  IDEA_SOURCES,
  PIDT,
  RIASEC,
  SKILL_DIMS,
  STUDY_TOLERANCE_YEARS,
  STYLE_DIMS,
  SUBJECT_AREAS,
  VALUE_DIMS,
  type AnswerValue,
  type Answers,
  type AuState,
  type IdeaSource,
  type DnaDim,
  type EducationPath,
  type EnvDim,
  type Geography,
  type LikertQuestion,
  type QuestionBank,
  type RiasecScores,
  type RiasecType,
  type SkillDim,
  type StudentProfile,
  type SubjectArea,
  type ValueDim,
} from "./types.ts";
import { isVisible } from "./engine.ts";

/** Converts a 1–5 answer to 0–100. Returns null for a missing or invalid answer. */
export function likertTo100(raw: AnswerValue | undefined): number | null {
  if (typeof raw !== "string") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return ((n - 1) / 4) * 100;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const HEXAGON: Record<RiasecType, number> = { R: 0, I: 1, A: 2, S: 3, E: 4, C: 5 };
export function rankTypes(scores: Record<RiasecType, number>): RiasecType[] {
  return [...RIASEC].sort((a, b) => scores[b] - scores[a] || HEXAGON[a] - HEXAGON[b]);
}

function likertItems(bank: QuestionBank): LikertQuestion[] {
  return bank.questions.filter((q): q is LikertQuestion => q.kind === "likert");
}

/** Averages the 0–100 answers for each code of one dimension type. */
function dimensionScores<T extends string>(bank: QuestionBank, answers: Answers, type: string, codes: readonly T[]) {
  const out = {} as Record<T, number>;
  const counts = {} as Record<T, number>;
  for (const c of codes) {
    const vals = likertItems(bank)
      .filter((q) => q.dimension.type === type && q.dimension.code === c)
      .map((q) => likertTo100(answers[q.id]))
      .filter((v): v is number => v !== null);
    out[c] = Math.round(mean(vals));
    counts[c] = vals.length;
  }
  return { scores: out, counts };
}

export function scoreRiasec(bank: QuestionBank, answers: Answers): RiasecScores & { counts: Record<RiasecType, number> } {
  const { scores, counts } = dimensionScores(bank, answers, "riasec", RIASEC);
  const values = RIASEC.map((t) => scores[t]);
  return {
    scores,
    counts,
    code: rankTypes(scores).slice(0, 3).join(""),
    differentiation: Math.max(...values) - Math.min(...values),
  };
}

/**
 * Students tend to say everything is important, so values are centred on each student's own
 * mean: 50 = as important as their average value, 100 = far more important than the rest.
 */
export function centreValues(raw: Record<ValueDim, number>): Record<ValueDim, number> {
  const m = mean(VALUE_DIMS.map((v) => raw[v]));
  // Raw scores are 0–100 (a 1–5 scale); a 2-point gap (50) from their mean maps to the ends of the range.
  return Object.fromEntries(VALUE_DIMS.map((v) => [v, clamp100(50 + (raw[v] - m))])) as Record<ValueDim, number>;
}

function environmentScores(answers: Answers, bank: QuestionBank): Record<EnvDim, number> {
  const out = {} as Record<EnvDim, number>;
  const rank = answers.q29;
  const order = Array.isArray(rank) ? rank : [];
  for (const d of PIDT) {
    const i = order.indexOf(d);
    out[d] = i === -1 ? 50 : Math.round(100 - (i * 100) / 3);
  }
  for (const d of STYLE_DIMS) {
    const q = bank.questions.find((x) => x.kind === "bipolar" && x.dimension.code === d);
    out[d] = (q && likertTo100(answers[q.id])) ?? 50;
  }
  return out;
}

function subjectScores(answers: Answers): Record<SubjectArea, { enjoyment: number; confidence: number }> {
  const m = answers.q34;
  const cells = m && typeof m === "object" && !Array.isArray(m) ? m : {};
  return Object.fromEntries(
    SUBJECT_AREAS.map((a) => [a, { enjoyment: likertTo100(cells[`${a}.enjoyment`]) ?? 50, confidence: likertTo100(cells[`${a}.confidence`]) ?? 50 }]),
  ) as Record<SubjectArea, { enjoyment: number; confidence: number }>;
}

/** The seven headline Career DNA dimensions, each an average of related answers. */
export function careerDna(p: Omit<StudentProfile, "dna" | "quality" | "instrumentVersion">): Record<DnaDim, number> {
  const r = p.riasec.scores;
  const s = p.skills;
  const v = p.valuesRaw;
  const e = p.environment;
  const tol = p.studyTolerance.years;
  const studyAppetite = tol === null ? (p.studyTolerance.answer === "any" ? 100 : 50) : Math.min(100, (tol / 7) * 100);
  const dna: Record<DnaDim, number> = {
    analytical: mean([r.I, s.quantitative, s.scientific, e.data]),
    creative: mean([r.A, s.spatial, v.creativity, e.ideas]),
    interpersonal: mean([r.S, s.interpersonal, s.communication, e.people]),
    technical: mean([r.R, s.practical, s.digital, e.things]),
    entrepreneurial: mean([r.E, s.leadership, v.leadership, v.financial]),
    structured: mean([r.C, 100 - e.flexibility, 100 - e.variety]),
    learning: mean([v.learning, studyAppetite, r.I]),
  };
  return Object.fromEntries(DNA_DIMS.map((d) => [d, clamp100(dna[d])])) as Record<DnaDim, number>;
}

/**
 * How much the answers can be relied on. Completeness drops for "not sure" answers; consistency
 * checks that the two interest items for each type broadly agree and that answers aren't all the same.
 */
export function profileQuality(bank: QuestionBank, answers: Answers, environment: Record<EnvDim, number>, tolerance: string, paths: string[]) {
  const lowInformation: string[] = [];
  let completeness = 1;
  if (tolerance === "unknown") {
    completeness -= 0.1;
    lowInformation.push("how long you'd be happy to study");
  }
  if (paths.includes("unsure")) {
    completeness -= 0.1;
    lowInformation.push("which paths after school you'd consider");
  }
  if (STYLE_DIMS.every((d) => environment[d] === 50)) {
    completeness -= 0.15;
    lowInformation.push("your preferred work environment");
  }

  const pairs = RIASEC.map((t) =>
    likertItems(bank)
      .filter((q) => q.dimension.type === "riasec" && q.dimension.code === t)
      .map((q) => likertTo100(answers[q.id]))
      .filter((x): x is number => x !== null),
  ).filter((p) => p.length === 2);
  const agreement = pairs.length ? mean(pairs.map(([a, b]) => 1 - Math.abs(a - b) / 100)) : 0.5;
  const likertAnswers = likertItems(bank).map((q) => answers[q.id]).filter((x) => typeof x === "string");
  const straightLined = likertAnswers.length > 10 && new Set(likertAnswers).size === 1;
  if (agreement < 0.6) lowInformation.push("your interests (some answers pointed in different directions)");
  return {
    completeness: Math.max(0, completeness),
    consistency: straightLined ? 0.2 : agreement,
    lowInformation,
  };
}

export class IncompleteAnswersError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`Missing answers: ${missing.join(", ")}`);
    this.missing = missing;
  }
}

const asArray = (v: AnswerValue | undefined): string[] => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []);

/** The careers a student already has in mind (question career_ideas) and where the ideas came from. */
function careerIdeas(bank: QuestionBank, answers: Answers): { careers: string[]; sources: string[] } {
  const q = bank.questions.find((x) => x.kind === "careers");
  if (!q) return { careers: [], sources: [] };
  const careers = [...new Set(asArray(answers[q.id]).filter((c) => c !== "none" && /^[A-Za-z0-9]{1,12}$/.test(c)))].slice(0, q.kind === "careers" ? q.max : 3);
  const sources = careers.length ? asArray(answers.idea_source).filter((x): x is IdeaSource => (IDEA_SOURCES as readonly string[]).includes(x)) : [];
  return { careers, sources };
}

/** Turns raw answers into the Career Profile the matching engine uses. */
export function buildProfile(bank: QuestionBank, answers: Answers): StudentProfile {
  const missing = bank.questions
    .filter((q) => {
      if (!isVisible(q, answers)) return false;
      const a = answers[q.id];
      if (q.kind === "matrix") return !a || typeof a !== "object" || Array.isArray(a) || Object.keys(a).length < q.rows.length * q.columns.length;
      if (q.kind === "multi" || q.kind === "rank" || q.kind === "careers") return !Array.isArray(a) || !a.length;
      return typeof a !== "string" || !a;
    })
    .map((q) => q.id);
  if (missing.length) throw new IncompleteAnswersError(missing);

  const yearLevel = Number(answers.year_level);
  if (yearLevel !== 10 && yearLevel !== 11 && yearLevel !== 12) throw new IncompleteAnswersError(["year_level"]);
  const state = answers.state as AuState;
  if (!AU_STATES.includes(state)) throw new IncompleteAnswersError(["state"]);
  const geography = answers.geography as Geography;
  if (!GEOGRAPHY.includes(geography)) throw new IncompleteAnswersError(["geography"]);
  const tolerance = String(answers.q36);
  if (!(tolerance in STUDY_TOLERANCE_YEARS)) throw new IncompleteAnswersError(["q36"]);
  const educationPaths = asArray(answers.q35).filter((p): p is EducationPath => (EDUCATION_PATHS as readonly string[]).includes(p));

  const riasec = scoreRiasec(bank, answers);
  const skills = dimensionScores(bank, answers, "skill", SKILL_DIMS).scores as Record<SkillDim, number>;
  const valuesRaw = dimensionScores(bank, answers, "value", VALUE_DIMS).scores as Record<ValueDim, number>;
  const environment = environmentScores(answers, bank);
  const base = {
    yearLevel: yearLevel as 10 | 11 | 12,
    state,
    geography,
    currentSubjects: asArray(answers.current_subjects),
    riasec: { scores: riasec.scores, code: riasec.code, differentiation: riasec.differentiation },
    skills,
    valuesRaw,
    values: centreValues(valuesRaw),
    environment,
    subjects: subjectScores(answers),
    educationPaths,
    studyTolerance: { answer: tolerance, years: STUDY_TOLERANCE_YEARS[tolerance] },
  };
  return {
    instrumentVersion: bank.version,
    ...base,
    dna: careerDna(base),
    quality: profileQuality(bank, answers, environment, tolerance, educationPaths),
    ideas: careerIdeas(bank, answers),
  };
}

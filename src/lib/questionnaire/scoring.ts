import {
  AU_STATES,
  RIASEC,
  STUDY_PREFERENCES,
  WORK_VALUES,
  type Answers,
  type AuState,
  type LikertQuestion,
  type QuestionBank,
  type RiasecScores,
  type RiasecType,
  type StudentProfile,
  type StudyPreference,
  type WorkValue,
} from "./types.ts";

/** Converts a 1–5 Likert answer to 0–100. Returns null for a missing or invalid answer. */
export function likertTo100(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return ((n - 1) / 4) * 100;
}

function likertItems(bank: QuestionBank): LikertQuestion[] {
  return bank.questions.filter((q): q is LikertQuestion => q.kind === "likert");
}

/** Position of each type on Holland's hexagon, used for the consistency check. */
const HEXAGON: Record<RiasecType, number> = { R: 0, I: 1, A: 2, S: 3, E: 4, C: 5 };

export function hexagonDistance(a: RiasecType, b: RiasecType): number {
  const d = Math.abs(HEXAGON[a] - HEXAGON[b]);
  return Math.min(d, 6 - d);
}

/** Ranks types by score, breaking ties in R-I-A-S-E-C order so results are deterministic. */
export function rankTypes(scores: Record<RiasecType, number>): RiasecType[] {
  return [...RIASEC].sort((a, b) => scores[b] - scores[a] || HEXAGON[a] - HEXAGON[b]);
}

export function scoreRiasec(bank: QuestionBank, answers: Answers): RiasecScores {
  const sums = Object.fromEntries(RIASEC.map((t) => [t, 0])) as Record<RiasecType, number>;
  const counts = Object.fromEntries(RIASEC.map((t) => [t, 0])) as Record<RiasecType, number>;

  for (const q of likertItems(bank)) {
    if (q.scale.type !== "riasec") continue;
    const v = likertTo100(answers[q.id]);
    if (v === null) continue;
    sums[q.scale.code] += v;
    counts[q.scale.code] += 1;
  }

  const scores = Object.fromEntries(
    RIASEC.map((t) => [t, counts[t] ? Math.round(sums[t] / counts[t]) : 0]),
  ) as Record<RiasecType, number>;

  const ranked = rankTypes(scores);
  const values = RIASEC.map((t) => scores[t]);
  return {
    scores,
    counts,
    code: ranked.slice(0, 3).join(""),
    differentiation: Math.max(...values) - Math.min(...values),
    consistent: hexagonDistance(ranked[0], ranked[1]) === 1,
  };
}

export function scoreValues(bank: QuestionBank, answers: Answers): Record<WorkValue, number> {
  const out = Object.fromEntries(WORK_VALUES.map((v) => [v, 50])) as Record<WorkValue, number>;
  for (const q of likertItems(bank)) {
    if (q.scale.type !== "value") continue;
    const v = likertTo100(answers[q.id]);
    if (v !== null) out[q.scale.code] = v;
  }
  return out;
}

function asArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v;
  return typeof v === "string" && v ? [v] : [];
}

export class IncompleteAnswersError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`Missing answers: ${missing.join(", ")}`);
    this.missing = missing;
  }
}

/** Turns raw answers into the profile the matching layer and plan generator use. */
export function buildProfile(bank: QuestionBank, answers: Answers): StudentProfile {
  const missing = ["year_level", "state", "study_preference", "relocation"].filter(
    (id) => typeof answers[id] !== "string",
  );
  const riasec = scoreRiasec(bank, answers);
  if (RIASEC.some((t) => riasec.counts[t] === 0)) missing.push("interests");
  if (missing.length) throw new IncompleteAnswersError(missing);

  const yearLevel = Number(answers.year_level);
  if (yearLevel !== 10 && yearLevel !== 11 && yearLevel !== 12) {
    throw new IncompleteAnswersError(["year_level"]);
  }
  const state = answers.state as AuState;
  if (!AU_STATES.includes(state)) throw new IncompleteAnswersError(["state"]);
  const studyPreference = answers.study_preference as StudyPreference;
  if (!STUDY_PREFERENCES.includes(studyPreference)) throw new IncompleteAnswersError(["study_preference"]);
  const relocation = answers.relocation as StudentProfile["relocation"];
  if (!["local", "state", "anywhere"].includes(relocation)) throw new IncompleteAnswersError(["relocation"]);

  const values = scoreValues(bank, answers);
  const topValues = [...WORK_VALUES]
    .filter((v) => values[v] >= 75)
    .sort((a, b) => values[b] - values[a])
    .slice(0, 4);

  return {
    yearLevel,
    state,
    riasec,
    values,
    topValues,
    subjectsEnjoyed: asArray(answers.subjects_enjoyed),
    subjectsStrong: asArray(answers.subjects_strong),
    studyPreference,
    relocation,
    apprenticeshipAreas: asArray(answers.apprenticeship_area),
  };
}

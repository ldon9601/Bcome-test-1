/** Holland (RIASEC) interest types. */
export const RIASEC = ["R", "I", "A", "S", "E", "C"] as const;
export type RiasecType = (typeof RIASEC)[number];

export const RIASEC_NAMES: Record<RiasecType, string> = {
  R: "Realistic (Doer)",
  I: "Investigative (Thinker)",
  A: "Artistic (Creator)",
  S: "Social (Helper)",
  E: "Enterprising (Persuader)",
  C: "Conventional (Organiser)",
};

/** Work values a student can rate. Occupations list the values they tend to satisfy. */
export const WORK_VALUES = [
  "helping",
  "security",
  "creativity",
  "independence",
  "teamwork",
  "outdoors",
  "variety",
  "income",
  "impact",
  "leadership",
] as const;
export type WorkValue = (typeof WORK_VALUES)[number];

export const STUDY_PREFERENCES = ["university", "vet", "apprenticeship", "work", "unsure"] as const;
export type StudyPreference = (typeof STUDY_PREFERENCES)[number];

export const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
export type AuState = (typeof AU_STATES)[number];

export type QuestionKind = "likert" | "single" | "multi";

export interface Option {
  value: string;
  label: string;
}

/** A condition on earlier answers. All listed keys must match for the question to show. */
export interface ShowIf {
  /** Question id → one of these answer values. For multi questions, any overlap counts. */
  answers?: Record<string, string[]>;
}

interface BaseQuestion {
  id: string;
  section: SectionId;
  prompt: string;
  help?: string;
  showIf?: ShowIf;
}

export interface LikertQuestion extends BaseQuestion {
  kind: "likert";
  /** Which scale the item contributes to. */
  scale: { type: "riasec"; code: RiasecType } | { type: "value"; code: WorkValue };
  /** Items are asked in tiers. Tier 1 is always asked; tier 2+ only when the engine needs more signal. */
  tier: 1 | 2 | 3;
}

export interface ChoiceQuestion extends BaseQuestion {
  kind: "single" | "multi";
  options: Option[];
  /** Max selections for multi questions. */
  max?: number;
}

export type Question = LikertQuestion | ChoiceQuestion;

export type SectionId = "about" | "interests" | "values" | "subjects" | "plans";

export interface QuestionBank {
  id: string;
  version: string;
  title: string;
  likertScale: Option[];
  sections: { id: SectionId; title: string; intro: string }[];
  questions: Question[];
}

/** Answers keyed by question id. Likert = "1".."5", single = value, multi = values. */
export type Answers = Record<string, string | string[]>;

export interface RiasecScores {
  /** 0–100 per type. */
  scores: Record<RiasecType, number>;
  /** Number of items answered per type. */
  counts: Record<RiasecType, number>;
  /** Three-letter Holland code, highest first. */
  code: string;
  /** Spread between highest and lowest score (0–100). Low = undifferentiated profile. */
  differentiation: number;
  /** Whether the top two types sit next to each other on Holland's hexagon. */
  consistent: boolean;
}

export interface StudentProfile {
  yearLevel: 10 | 11 | 12;
  state: AuState;
  riasec: RiasecScores;
  /** 0–100 per value. */
  values: Record<WorkValue, number>;
  topValues: WorkValue[];
  subjectsEnjoyed: string[];
  subjectsStrong: string[];
  studyPreference: StudyPreference;
  relocation: "local" | "state" | "anywhere";
  /** Only set when the student prefers an apprenticeship. */
  apprenticeshipAreas: string[];
}

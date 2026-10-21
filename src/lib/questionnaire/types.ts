/** Holland (RIASEC) interest types. */
export const RIASEC = ["R", "I", "A", "S", "E", "C"] as const;
export type RiasecType = (typeof RIASEC)[number];

export const RIASEC_NAMES: Record<RiasecType, string> = {
  R: "Realistic",
  I: "Investigative",
  A: "Artistic",
  S: "Social",
  E: "Enterprising",
  C: "Conventional",
};

/** Section B: current skill confidence (not aptitude). */
export const SKILL_DIMS = ["quantitative", "communication", "scientific", "digital", "spatial", "practical", "interpersonal", "leadership"] as const;
export type SkillDim = (typeof SKILL_DIMS)[number];
export const SKILL_NAMES: Record<SkillDim, string> = {
  quantitative: "Quantitative reasoning",
  communication: "Communication",
  scientific: "Scientific thinking",
  digital: "Technology",
  spatial: "Spatial and design thinking",
  practical: "Practical skills",
  interpersonal: "Working with people",
  leadership: "Leadership",
};

/** Section C: work values. */
export const VALUE_DIMS = ["purpose", "financial", "security", "autonomy", "creativity", "leadership", "worklife", "learning"] as const;
export type ValueDim = (typeof VALUE_DIMS)[number];
export const VALUE_NAMES: Record<ValueDim, string> = {
  purpose: "Positive impact",
  financial: "Income potential",
  security: "Job security",
  autonomy: "Autonomy",
  creativity: "Innovation",
  leadership: "Leadership",
  worklife: "Work-life balance",
  learning: "Continuous learning",
};

/** Section D: People–Ideas–Data–Things ranking plus four work-style sliders. */
export const PIDT = ["people", "ideas", "data", "things"] as const;
export type Pidt = (typeof PIDT)[number];
export const STYLE_DIMS = ["teamwork", "flexibility", "physical", "variety"] as const;
export type StyleDim = (typeof STYLE_DIMS)[number];
export type EnvDim = Pidt | StyleDim;

/** Section E: subject areas (Q34). */
export const SUBJECT_AREAS = ["mathematics", "biology", "chemistry", "physics", "english", "humanities", "business", "computing", "arts", "practical"] as const;
export type SubjectArea = (typeof SUBJECT_AREAS)[number];

export const EDUCATION_PATHS = ["university", "vet", "apprenticeship", "work_learn", "business", "defence_public", "gap_year", "unsure"] as const;
export type EducationPath = (typeof EDUCATION_PATHS)[number];

/** Q36: how long a student would study or train. Years, or null for "any" / "don't know". */
export const STUDY_TOLERANCE_YEARS: Record<string, number | null> = { lt1: 0.75, "1-2": 2, "3-4": 4, "5-6": 6, "7+": 10, any: null, unknown: null };

export const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
export type AuState = (typeof AU_STATES)[number];

export const GEOGRAPHY = ["near_home", "state", "city", "regional", "anywhere", "unsure"] as const;
export type Geography = (typeof GEOGRAPHY)[number];

export interface Option {
  value: string;
  label: string;
  detail?: string;
}

export interface ShowIf {
  /** Question id → one of these answer values. For multi questions, any overlap counts. */
  answers?: Record<string, string[]>;
}

export type SectionId = "about" | "interests" | "strengths" | "values" | "environment" | "school";
export type ScaleId = "interest" | "confidence" | "importance" | "enjoyment";

interface BaseQuestion {
  id: string;
  /** Question number in the 36-question assessment. Onboarding questions have none. */
  number?: number;
  section: SectionId;
  prompt: string;
  help?: string;
  showIf?: ShowIf;
}

export interface LikertQuestion extends BaseQuestion {
  kind: "likert";
  scaleId: ScaleId;
  dimension: { type: "riasec"; code: RiasecType } | { type: "skill"; code: SkillDim } | { type: "value"; code: ValueDim };
}

export interface ChoiceQuestion extends BaseQuestion {
  kind: "single" | "multi";
  options: Option[];
  max?: number;
  min?: number;
  /** Options that can't be combined with others (e.g. "I'm not sure yet"). */
  exclusive?: string[];
}

export interface RankQuestion extends BaseQuestion {
  kind: "rank";
  options: Option[];
}

export interface BipolarQuestion extends BaseQuestion {
  kind: "bipolar";
  dimension: { type: "environment"; code: StyleDim };
  left: string;
  right: string;
  middle: string;
}

export interface MatrixQuestion extends BaseQuestion {
  kind: "matrix";
  rows: Option[];
  columns: { value: string; label: string; scaleId: ScaleId }[];
}

export type Question = LikertQuestion | ChoiceQuestion | RankQuestion | BipolarQuestion | MatrixQuestion;

export interface QuestionBank {
  id: string;
  version: string;
  title: string;
  scales: Record<ScaleId, Option[]>;
  sections: { id: SectionId; title: string; intro: string }[];
  questions: Question[];
}

/**
 * Answers keyed by question id.
 * likert / single / bipolar = "1".."5" or an option value; multi / rank = values in order;
 * matrix = { "<row>.<column>": "1".."5" }.
 */
export type AnswerValue = string | string[] | Record<string, string>;
export type Answers = Record<string, AnswerValue>;

export interface RiasecScores {
  /** 0–100 per type. */
  scores: Record<RiasecType, number>;
  /** Three-letter Holland code, highest first. */
  code: string;
  /** Spread between highest and lowest score (0–100). Low = undifferentiated profile. */
  differentiation: number;
}

/** The seven headline "Career DNA" dimensions shown to the student (0–100). */
export const DNA_DIMS = ["analytical", "creative", "interpersonal", "technical", "entrepreneurial", "structured", "learning"] as const;
export type DnaDim = (typeof DNA_DIMS)[number];
export const DNA_NAMES: Record<DnaDim, string> = {
  analytical: "Analytical",
  creative: "Creative",
  interpersonal: "Interpersonal",
  technical: "Technical",
  entrepreneurial: "Entrepreneurial",
  structured: "Structured working preference",
  learning: "Continuous-learning appetite",
};

export interface StudentProfile {
  instrumentVersion: string;
  yearLevel: 10 | 11 | 12;
  state: AuState;
  geography: Geography;
  /** Subjects being studied now (ids from the onboarding list). */
  currentSubjects: string[];
  riasec: RiasecScores;
  /** Current skill confidence, 0–100. */
  skills: Record<SkillDim, number>;
  /** Raw importance, 0–100. */
  valuesRaw: Record<ValueDim, number>;
  /** Importance centred on the student's own mean (50 = their average), 0–100. */
  values: Record<ValueDim, number>;
  /** People/Ideas/Data/Things from the ranking (100, 67, 33, 0) and the four sliders (0–100). */
  environment: Record<EnvDim, number>;
  subjects: Record<SubjectArea, { enjoyment: number; confidence: number }>;
  educationPaths: EducationPath[];
  /** Years they'd study or train, or null for "any duration" / "don't know". */
  studyTolerance: { answer: string; years: number | null };
  dna: Record<DnaDim, number>;
  /** How reliable this profile is as a basis for matching (0–1). */
  quality: { completeness: number; consistency: number; lowInformation: string[] };
}

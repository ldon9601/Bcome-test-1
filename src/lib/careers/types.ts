import type { WorkValue } from "../questionnaire/types.ts";

export type AiExposure = "low" | "medium" | "high";

/** Long-run forces that push demand for an occupation up. */
export type Driver =
  | "ageing-population"
  | "care-economy"
  | "net-zero"
  | "digital"
  | "infrastructure"
  | "housing"
  | "population-growth"
  | "defence";

export interface Occupation {
  id: string;
  title: string;
  /** ANZSCO 2022 unit group (4-digit). Joins to JSA projections. */
  anzsco: string;
  /** ANZSCO major group, 1 (Managers) to 8 (Labourers). */
  majorGroup: number;
  /** ANZSIC division name, as used in the JSA industry projections. */
  industry: string;
  /** ANZSCO skill level, 1 (bachelor or higher) to 5 (Certificate I / secondary). */
  skillLevel: number;
  /** Three-letter Holland code. */
  riasec: string;
  values: WorkValue[];
  subjects: { helpful: string[]; oftenRequired: string[] };
  skills: string[];
  pathways: { university?: string; vet?: string; apprenticeship?: string };
  aiExposure: AiExposure;
  drivers: Driver[];
  apprenticeshipAreas: string[];
}

export interface OccupationData {
  version: string;
  notes: string[];
  occupations: Occupation[];
}

export interface GrowthFigure {
  growth5Pct?: number | null;
  growth10Pct?: number | null;
}

export interface JsaOutlookData {
  source: {
    title: string;
    url: string;
    baseline: string;
    horizon5: string;
    horizon10: string;
    retrieved: string;
    [key: string]: string;
  };
  total: { growth5Pct: number; growth10Pct: number; [key: string]: number };
  majorGroups: Record<string, GrowthFigure & { name: string; qualitative?: string }>;
  occupations: Record<string, GrowthFigure & { name: string; employed2025k?: number }>;
  industries: Record<string, number>;
  skillLevels: Record<string, { label: string; growth10Pct: number }>;
  headlines: string[];
}

export type OutlookBand = "strong" | "good" | "moderate" | "limited" | "declining" | "unknown";

/** Where a growth figure came from, from most to least specific. */
export type OutlookBasis =
  | "jsa-occupation"
  | "jsa-major-group-adjusted"
  | "jsa-major-group-qualitative"
  | "none";

export interface Outlook {
  /** Projected % change in employment over 5 and 10 years (JSA or estimate). */
  growth5Pct: number | null;
  growth10Pct: number | null;
  basis: OutlookBasis;
  band10: OutlookBand;
  /** Indicative 15-year scenario. Never an official projection. */
  band15: OutlookBand;
  rationale15: string[];
  /** 0–1, used by the matching layer. */
  score: number;
  /** One plain-English sentence a student can read. */
  summary: string;
}

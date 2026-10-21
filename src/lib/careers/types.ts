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

/** How a student gets into the job. Cadetships and traineeships mean working while you study. */
export type Route = "university" | "vet" | "apprenticeship" | "traineeship" | "cadetship" | "other";

export interface Pathway {
  route: Route;
  /** Qualification id from data/skills/qualifications.json (a training.gov.au code for VET). */
  qualification?: string;
  description: string;
  /** Typical full-time years from finishing school to qualified on this route, [min, max]. */
  years: [number, number];
}

export type Competitiveness = "open" | "moderate" | "high";

export interface Occupation {
  /** Primary identifier: OSCA 2024 occupation (6-digit) or unit group (4-digit) code. */
  osca: string;
  oscaLevel: "occupation" | "unitGroup";
  oscaUnitGroup: string;
  oscaTitle: string;
  /** Where the OSCA code was checked: the ABS publication itself, or the ANZSCO–OSCA correspondence. */
  oscaSource: "abs" | "correspondence";
  title: string;
  /** ANZSCO 2022 unit group (4-digit). Only used to join JSA projections, which are published on ANZSCO. */
  anzsco: string;
  /** ANZSIC division name, as used in the JSA industry projections. */
  industry: string;
  /** Skill level, 1 (bachelor or higher) to 5 (Certificate I / secondary). */
  skillLevel: number;
  /** Three-letter Holland code. */
  riasec: string;
  values: WorkValue[];
  subjects: { helpful: string[]; oftenRequired: string[] };
  /** Specialist skill ids (data/skills/skills.json). */
  skills: string[];
  /** Core competency ids, following the Australian Skills Classification. */
  coreCompetencies: string[];
  pathways: Pathway[];
  timeToQualify: { years: [number, number]; milestone: string };
  entryCompetitiveness: Competitiveness;
  /** Indicative AUD per year, full-time, before tax, excluding super. */
  salary: { entry: [number, number]; experienced: [number, number]; note?: string };
  aiExposure: AiExposure;
  drivers: Driver[];
  apprenticeshipAreas: string[];
}

export interface OccupationData {
  version: string;
  notes: string[];
  occupations: Occupation[];
}

/** A skill concept, shaped like the National Skills Taxonomy's SKOS model. */
export interface Skill {
  id: string;
  prefLabel: string;
  /** Cluster id (skos:broader). */
  broader: string;
  type: "specialist" | "core";
  /** NST concept IRI once JSA publishes the taxonomy. */
  nstExactMatch: string | null;
  ascMatch?: string;
}

export interface SkillsData {
  version: string;
  scheme: string;
  notes: string[];
  clusters: { id: string; prefLabel: string }[];
  skills: Skill[];
}

export interface Qualification {
  id: string;
  title: string;
  sector: "vet" | "higher-ed";
  aqfLevel: number;
  durationYears: [number, number];
  /** Specialist skill ids the qualification builds. */
  skills: string[];
  tgaCode?: string;
  verifyCode?: boolean;
  ascedField?: string;
}

export interface QualificationData {
  version: string;
  notes: string[];
  qualifications: Qualification[];
}

/** Median earnings imported from JSA occupation profiles, keyed by OSCA code. */
export interface EarningsData {
  source: { title: string; url: string; retrieved: string | null; note: string };
  byOsca: Record<string, { medianWeekly: number; name?: string }>;
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

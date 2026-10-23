import type { CareerGenAi } from "./genai.ts";
import type { RiasecType, SkillDim, StyleDim, SubjectArea, ValueDim } from "../questionnaire/types.ts";

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

export const CAREER_FAMILIES = [
  "health", "care", "education", "tech", "data", "engineering", "built", "environment", "science", "animals",
  "business", "creative", "performing", "trades", "workshop", "hospitality", "safety", "fitness", "transport",
  "agriculture", "retail", "office", "manufacturing",
] as const;
export type CareerFamily = (typeof CAREER_FAMILIES)[number];

export type Competitiveness = "open" | "moderate" | "high";

export interface Occupation {
  /**
   * Primary identifier: OSCA 2024 occupation (6-digit) or unit group (4-digit) code. Careers added
   * from the JSA unit-group projections use "A" + their ANZSCO code until OSCA codes are mapped.
   */
  osca: string;
  oscaLevel: "occupation" | "unitGroup" | "anzsco";
  oscaUnitGroup: string;
  /** Empty while the OSCA code is still to be mapped (oscaSource "pending"). */
  oscaTitle: string;
  /** Where the OSCA code was checked: the ABS publication, the ANZSCO–OSCA correspondence, or not yet mapped. */
  oscaSource: "abs" | "correspondence" | "pending";
  /** "bcome": written by hand; "jsa-unit-group": generated from a JSA projections unit group. */
  origin?: "bcome" | "jsa-unit-group";
  /** An identified position for Aboriginal and Torres Strait Islander people: searchable, not auto-recommended. */
  identified?: boolean;
  title: string;
  /** One plain-English sentence describing the work, for cards. */
  summary: string;
  /** Illustration family used for the career's picture (see src/components/OccupationArt.tsx). */
  family: CareerFamily;
  /** ANZSCO 2022 unit group (4-digit), as used by Jobs and Skills Australia for projections and occupation profiles. */
  anzsco: string;
  /** JSA's title for the ANZSCO unit group, e.g. "Software and Applications Programmers". */
  anzscoTitle: string;
  /** Closest 6-digit ANZSCO occupation, or null when the career spans several (e.g. Registered Nurse). */
  anzscoOccupation: { code: string; title: string } | null;
  /** Attached at load time from data/outlook/jsa-occupation-profiles.json (see src/lib/data.ts). */
  jsaProfile?: JsaProfile | null;
  /** ANZSIC division name, as used in the JSA industry projections. */
  industry: string;
  /** Main employing industry (ANZSIC 2006 group, 3 digits), a Bcome estimate. */
  anzsic: { code: string; title: string; division: string; divisionTitle: string };
  /** Skill level, 1 (bachelor or higher) to 5 (Certificate I / secondary): the most typical for this career. */
  skillLevel: number;
  /** Every ANZSCO skill level JSA lists for the unit group (some groups span two or three). */
  skillLevels: number[];
  /** Three-letter Holland code. */
  riasec: string;
  /** Detailed school subjects (onboarding list ids) that help or are often prerequisites. */
  subjects: { helpful: string[]; oftenRequired: string[] };
  /** The same subjects grouped into the questionnaire's ten subject areas. */
  subjectAreas: { helpful: SubjectArea[]; required: SubjectArea[] };
  /** 0–100 profile on the questionnaire's own dimensions, for personal-fit matching. */
  profile: {
    interests: Record<RiasecType, number>;
    skills: Record<SkillDim, number>;
    values: Record<ValueDim, number>;
    environment: Record<StyleDim, number>;
  };
  /** Opportunity indicators, 0–100 unless stated. */
  market: {
    shortage: "shortage" | "no-shortage";
    regionalBreadth: number;
    graduateOutcome: number;
    ai: { automation: number; augmentation: number };
  };
  /** Where each figure comes from, so every statement can show its source. */
  evidence: Record<string, string>;
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
  /** JSA Gen AI exposure, joined at load time from data/labour/genai.json (src/lib/careers/genai.ts). */
  genAi?: CareerGenAi | null;
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

/** Highest-qualification shares of people working in an occupation, %. */
export interface QualificationMix {
  postgraduate: number;
  bachelor: number;
  diploma: number;
  certificate: number;
  year12: number;
  year11: number;
  year10OrBelow: number;
}

/** Headline figures from a Jobs and Skills Australia occupation profile (ANZSCO unit group). null = N/A. */
export interface JsaProfile {
  title: string;
  url: string;
  employed: number | null;
  partTimePct: number | null;
  femalePct: number | null;
  /** Full-time, before tax. */
  medianWeeklyEarnings: number | null;
  medianAge: number | null;
  /** Change in employment over the past year (not a projection). */
  annualGrowth: number | null;
  qualifications: QualificationMix;
}

export interface JsaProfileData {
  source: { title: string; url: string; retrieved: string; notes: string[] };
  byUnitGroup: Record<string, JsaProfile>;
}

export type AtarKind = "guaranteed" | "indicative" | "minimum" | "published";

/** A specific university course that leads to one of Bcome's higher-education qualifications. */
export interface UniversityOffering {
  qualificationId: string;
  /** Key into CourseOfferingsData.sources. */
  source: string;
  provider: string;
  state: string;
  campus: string | null;
  course: string;
  atar: { value: number | null; display: string | null; kind: AtarKind | null; year: number | null };
  prerequisites: string[];
  assumedKnowledge: string[];
  recommended: string[];
  otherRequirements: string[];
}

/** A TAFE course for one of Bcome's VET qualifications, with that provider's entry requirements. */
export interface TafeOffering {
  qualificationId: string;
  provider: string;
  state: string;
  course: string;
  /** The code the provider currently enrols under (may be a newer release than qualificationId). */
  offeredCode: string;
  apprenticeship: boolean;
  requirements: string[];
  url: string;
}

export interface CourseSource {
  provider: string;
  title: string;
  url: string;
  kind: AtarKind | "prerequisites";
  year: number | null;
  note: string;
}

export interface CourseOfferingsData {
  version: string;
  notes: string[];
  retrieved: string;
  sources: Record<string, CourseSource>;
  university: UniversityOffering[];
  tafe: TafeOffering[];
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
  occupations: Record<
    string,
    GrowthFigure & { name: string; employed2025k?: number | null; employed2030k?: number | null; employed2035k?: number | null; skillLevels?: number[] }
  >;
  /** ANZSCO sub-major (2-digit) and minor (3-digit) groups. */
  occupationGroups?: Record<string, { name: string; employed2025k: number | null; growth10Pct: number | null }>;
  industries: Record<string, number>;
  divisions?: Record<string, GrowthFigure & { name: string; employed2025k: number | null; employed2035k: number | null }>;
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

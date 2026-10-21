import type { CareerFacts } from "../careers/facts.ts";
import type { FutureOutlookSummary, Group, Strength } from "../careers/matching.ts";

export interface CareerScores {
  personalFit: number;
  futureOpportunity: number;
  pathwayFeasibility: number;
}

export interface PlanCareer {
  /** OSCA code. */
  occupationId: string;
  title: string;
  whyItFits: string;
  outlook: string;
  howToGetThere: string;
  /** Everything below is attached from Bcome's data after writing; the AI never writes it. */
  group?: Group;
  matchScore?: number;
  scores?: CareerScores;
  strengths?: Strength[];
  challenges?: string[];
  future?: FutureOutlookSummary;
  improvement?: { to: number; action: string } | null;
  confidence?: { score: number; level: "High" | "Moderate" | "Low"; note: string | null };
  facts?: CareerFacts;
}

export type JourneyActionType = "academic" | "skills" | "exploration" | "portfolio" | "applications" | "alternative" | "study" | "work";

export interface JourneyPeriod {
  id: string;
  /** e.g. "Now → end of Year 10", "University Year 1". */
  period: string;
  /** The one thing that matters most in this period. */
  focus: string;
  actions: { type: JourneyActionType; text: string }[];
}

export interface CareerPlan {
  summary: string;
  hollandCode: string;
  /** "What this suggests": plain-language reading of the Career DNA. */
  dnaSummary: string;
  /** Recommended careers in display order: best matches, worth exploring, wildcard. */
  careers: PlanCareer[];
  /** Year-by-year journey towards the top match. */
  journey: { occupationId: string; title: string; periods: JourneyPeriod[] };
  futureOfWork: string[];
  /** Skills and core competencies shared by the best matches: worth building whichever one the student picks. */
  skillsBridge?: string[];
  nextSteps: string[];
  caveats: string[];
  meta: {
    generatedBy: "claude" | "template";
    model?: string;
    generatedAt: string;
    dataSource: string;
    instrumentVersion: string;
    /** Set when the AI response was rejected and the template was used instead. */
    fallbackReason?: string;
  };
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

/** The AI explains recommendations; it may never call a student unsuitable for a career. */
export const FORBIDDEN_PHRASES = /\b(unsuitable|not suitable|not suited|aren't suited|isn't for you|not cut out|you can't become|you cannot become)\b/i;

/**
 * Checks an AI-written plan: right shape, only careers and journey periods we supplied, and no
 * language that rules a student out. Returns a list of problems; empty means valid.
 */
export function validatePlanBody(plan: unknown, allowedIds: Set<string>, periodIds: string[]): string[] {
  const errors: string[] = [];
  if (!plan || typeof plan !== "object") return ["plan is not an object"];
  const p = plan as Record<string, unknown>;
  if (!isStr(p.summary)) errors.push("summary missing");
  if (!isStr(p.dnaSummary)) errors.push("dnaSummary missing");
  if (!Array.isArray(p.careers) || p.careers.length < 1 || p.careers.length > 8) {
    errors.push("careers must have 1–8 entries");
  } else {
    p.careers.forEach((c: Record<string, unknown>, i) => {
      if (!isStr(c?.occupationId) || !allowedIds.has(c.occupationId)) errors.push(`careers[${i}] names a career we did not supply`);
      for (const k of ["title", "whyItFits", "outlook", "howToGetThere"]) if (!isStr(c?.[k])) errors.push(`careers[${i}].${k} missing`);
    });
  }
  const j = p.journey as Record<string, unknown> | undefined;
  const periods = Array.isArray(j?.periods) ? (j.periods as Record<string, unknown>[]) : null;
  if (!periods) errors.push("journey.periods missing");
  else {
    const ids = periods.map((x) => x?.id);
    if (ids.join() !== periodIds.join()) errors.push(`journey periods must be ${periodIds.join(", ")}`);
    periods.forEach((x, i) => {
      if (!isStr(x?.period) || !isStr(x?.focus) || !Array.isArray(x?.actions) || !x.actions.length) errors.push(`journey.periods[${i}] incomplete`);
      else if (!(x.actions as Record<string, unknown>[]).every((a) => isStr(a?.text) && isStr(a?.type))) errors.push(`journey.periods[${i}] actions malformed`);
    });
  }
  if (!isStrArr(p.futureOfWork)) errors.push("futureOfWork must be a list of strings");
  if (!isStrArr(p.nextSteps) || !(p.nextSteps as string[]).length) errors.push("nextSteps missing");
  if (FORBIDDEN_PHRASES.test(JSON.stringify(plan))) errors.push("plan tells the student they are unsuitable for a career");
  return errors;
}

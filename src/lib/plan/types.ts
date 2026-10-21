import type { CareerFacts } from "../careers/facts.ts";

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
  /** Attached from Bcome's data after writing, never written by the AI. */
  scores?: CareerScores;
  facts?: CareerFacts;
}

export interface PlanStage {
  id: "school" | "post-school" | "early-career";
  title: string;
  timeframe: string;
  actions: string[];
}

export interface CareerPlan {
  summary: string;
  hollandCode: string;
  topCareers: PlanCareer[];
  stages: PlanStage[];
  futureOfWork: string[];
  alternatives: { title: string; why: string }[];
  /** Skills and core competencies shared by the top careers: worth building whichever one the student picks. */
  skillsBridge?: string[];
  nextSteps: string[];
  caveats: string[];
  meta: {
    generatedBy: "claude" | "template";
    model?: string;
    generatedAt: string;
    dataSource: string;
    /** Set when the AI response was rejected and the template was used instead. */
    fallbackReason?: string;
  };
}

const STAGE_IDS = ["school", "post-school", "early-career"] as const;

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

/**
 * Checks an AI-generated plan has the right shape and only names careers we supplied.
 * Returns a list of problems; empty means valid.
 */
export function validatePlanBody(plan: unknown, allowedIds: Set<string>): string[] {
  const errors: string[] = [];
  if (!plan || typeof plan !== "object") return ["plan is not an object"];
  const p = plan as Record<string, unknown>;
  if (!isStr(p.summary)) errors.push("summary missing");
  if (!Array.isArray(p.topCareers) || p.topCareers.length < 1 || p.topCareers.length > 5) {
    errors.push("topCareers must have 1–5 entries");
  } else {
    p.topCareers.forEach((c: Record<string, unknown>, i) => {
      if (!isStr(c?.occupationId) || !allowedIds.has(c.occupationId)) errors.push(`topCareers[${i}] names a career we did not supply`);
      for (const k of ["title", "whyItFits", "outlook", "howToGetThere"]) if (!isStr(c?.[k])) errors.push(`topCareers[${i}].${k} missing`);
    });
  }
  if (!Array.isArray(p.stages) || p.stages.length !== 3) {
    errors.push("stages must have 3 entries");
  } else {
    p.stages.forEach((s: Record<string, unknown>, i) => {
      if (s?.id !== STAGE_IDS[i]) errors.push(`stages[${i}].id should be ${STAGE_IDS[i]}`);
      if (!isStr(s?.title) || !isStr(s?.timeframe) || !isStrArr(s?.actions) || !(s.actions as string[]).length) {
        errors.push(`stages[${i}] incomplete`);
      }
    });
  }
  if (!isStrArr(p.futureOfWork)) errors.push("futureOfWork must be a list of strings");
  if (!Array.isArray(p.alternatives) || !p.alternatives.every((a: Record<string, unknown>) => isStr(a?.title) && isStr(a?.why))) {
    errors.push("alternatives malformed");
  }
  if (!isStrArr(p.nextSteps) || !(p.nextSteps as string[]).length) errors.push("nextSteps missing");
  return errors;
}

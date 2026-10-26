import type { AiExposure, Occupation } from "./types.ts";

/**
 * Jobs and Skills Australia's Gen AI exposure scores (Our Gen AI Transition, 2025), joined to each
 * career on its ANZSCO unit group.
 *
 * JSA scores every task in an occupation from 0 to 1 for how much Gen AI could automate it (do it)
 * or augment it (help a person do it), assuming full adoption. JSA doesn't set thresholds, so Bcome
 * splits the 357 occupations into thirds: the top third is "high" exposure, and so on. The cut-offs
 * are recalculated whenever JSA publishes new scores (scripts/import-labour-market.py --genai).
 *
 * `market.ai` holds each score as a percentile (0–100 across all occupations), which is what the
 * matching model's AI-adaptability measure and its High/Moderate/Low wording expect.
 */

export interface GenAiOccupation {
  title: string;
  group: string | null;
  automation: number;
  automationSd: number | null;
  augmentation: number;
  augmentationSd: number | null;
  skillChange: number | null;
  mobility: number | null;
  highFitTransitionPct: number | null;
  hybridisation: number | null;
  specialisation: number | null;
  entryLevelAdsPct: number | null;
}

export interface GenAiData {
  source: { title: string; url: string; file: string; released: string | null; note: string; retrieved: string };
  bands: { automation: [number, number]; augmentation: [number, number] };
  occupations: Record<string, GenAiOccupation>;
  industries: Record<string, { augmentation: number | null; automation: number | null; aiSkillsWorkerProfilesPct: number | null; aiSkillsJobAdsPct: number | null; entryLevelAdsPct: number | null }>;
}

/** What a career carries, and what its profile shows. */
export interface CareerGenAi {
  /** Overall AI exposure to 2035, from the automation score. */
  exposure: AiExposure;
  /** How much AI could help with the work, from the augmentation score. */
  helper: AiExposure;
  automation: number;
  augmentation: number;
  /** Percentile among all occupations, 0–100. */
  automationPercentile: number;
  augmentationPercentile: number;
  entryLevelAdsPct: number | null;
  skillChange: number | null;
  /** JSA: share of people leaving this job who moved into a growing, similar one (%). */
  highFitTransitionPct: number | null;
  /** True when this unit group has no published score and its ANZSCO minor group's average is used. */
  estimated: boolean;
  unitGroup: string;
  released: string | null;
}

export const band = (score: number, cuts: [number, number]): AiExposure => (score >= cuts[1] ? "high" : score >= cuts[0] ? "medium" : "low");

/** Share of occupations scoring below this one, counting ties as half (0–100). */
function percentile(sorted: number[], v: number): number {
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return Math.round(((below + equal / 2) / sorted.length) * 100);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function careerGenAi(anzsco: string, data: GenAiData): CareerGenAi | null {
  let row: Pick<GenAiOccupation, "automation" | "augmentation" | "entryLevelAdsPct" | "skillChange" | "highFitTransitionPct"> | undefined = data.occupations[anzsco];
  let estimated = false;
  if (!row) {
    // No published score (JSA suppresses small occupations): use the minor group's average.
    const siblings = Object.entries(data.occupations).filter(([code]) => code.slice(0, 3) === anzsco.slice(0, 3)).map(([, o]) => o);
    if (!siblings.length) return null;
    row = {
      automation: Math.round(mean(siblings.map((s) => s.automation)) * 100) / 100,
      augmentation: Math.round(mean(siblings.map((s) => s.augmentation)) * 100) / 100,
      entryLevelAdsPct: null,
      skillChange: null,
      highFitTransitionPct: null,
    };
    estimated = true;
  }
  const all = Object.values(data.occupations);
  const autos = all.map((o) => o.automation).sort((a, b) => a - b);
  const augs = all.map((o) => o.augmentation).sort((a, b) => a - b);
  return {
    exposure: band(row.automation, data.bands.automation),
    helper: band(row.augmentation, data.bands.augmentation),
    automation: row.automation,
    augmentation: row.augmentation,
    automationPercentile: percentile(autos, row.automation),
    augmentationPercentile: percentile(augs, row.augmentation),
    entryLevelAdsPct: row.entryLevelAdsPct,
    skillChange: row.skillChange,
    highFitTransitionPct: row.highFitTransitionPct,
    estimated,
    unitGroup: anzsco,
    released: data.source.released,
  };
}

/** Replaces Bcome's editorial AI estimates with JSA's scores, in place. */
export function applyGenAi(occupations: Occupation[], data: GenAiData): void {
  const cite = `${data.source.title}${data.source.released ? ` (${data.source.released})` : ""}`;
  for (const o of occupations) {
    const g = careerGenAi(o.anzsco, data);
    o.genAi = g;
    if (!g) continue;
    o.aiExposure = g.exposure;
    o.market.ai = { automation: g.automationPercentile, augmentation: g.augmentationPercentile };
    o.evidence.ai = g.estimated
      ? `${cite}: average of the ANZSCO ${o.anzsco.slice(0, 3)} minor group (no published score for ${o.anzsco})`
      : `${cite}: ANZSCO ${o.anzsco} automation ${g.automation}, augmentation ${g.augmentation} (0–1)`;
  }
}

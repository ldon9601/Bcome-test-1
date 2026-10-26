import type { Match } from "./matching.ts";
import type { OutlookBand } from "./types.ts";
import type { SkillsGraph } from "./skills.ts";
import type { Occupation } from "./types.ts";

/**
 * Plan B and career resilience: for a career, the neighbouring careers a person could move to if
 * it changes (suiting the same kind of person and sharing many of the same skills), and how
 * resilient the career is compared with all other careers.
 *
 * Resilience is a property of the career (the same for every student), 0–100, from equal parts:
 *   - JSA high-fit transition rate: share of people leaving it who moved into a growing, similar job
 *     (published for about 60% of occupations; elsewhere, the share of its close neighbours that are growing)
 *   - low Gen AI automation exposure (JSA percentile, inverted)
 *   - JSA's 10-year employment outlook
 *   - breadth: how many growing careers sit close to it (up to six)
 * High, Medium and Low are the top, middle and bottom thirds of all careers, recalculated from the
 * data. It's information for the student, not part of the match score, which stays led by personal fit.
 * The plan B list itself is personal: close neighbours that also fit this student.
 */

const BAND_SCORE: Record<OutlookBand, number> = { strong: 1, good: 0.8, moderate: 0.6, limited: 0.35, declining: 0.15, unknown: 0.5 };
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export type ResilienceLevel = "High" | "Medium" | "Low";

export interface Neighbour {
  osca: string;
  title: string;
  family: string;
  /** How similar the two careers are, 0–100. */
  similarity: number;
  /** Skills that carry over, in plain words. */
  sharedSkills: string[];
  personalFit: number;
  aiExposure: "high" | "medium" | "low";
  outlook: OutlookBand;
  /** Why it's a good plan B, in one sentence. */
  why: string;
}

export interface Resilience {
  score: number;
  level: ResilienceLevel;
  reasons: string[];
  neighbours: Neighbour[];
}

/** How alike the people who suit each career are: interests and strengths, 0–1. */
function profileSimilarity(a: Occupation, b: Occupation): number {
  const dims: [Record<string, number>, Record<string, number>][] = [
    [a.profile.interests, b.profile.interests],
    [a.profile.skills, b.profile.skills],
  ];
  const diffs = dims.flatMap(([x, y]) => Object.keys(x).map((k) => Math.abs((x[k] ?? 50) - (y[k] ?? 50)) / 100));
  return diffs.length ? 1 - diffs.reduce((s, d) => s + d, 0) / diffs.length : 0;
}

function skillOverlap(a: Occupation, b: Occupation): { overlap: number; shared: string[] } {
  const A = new Set([...a.skills, ...a.coreCompetencies]);
  const B = [...b.skills, ...b.coreCompetencies];
  const shared = [...new Set(B.filter((s) => A.has(s)))];
  const union = new Set([...A, ...B]).size;
  return { overlap: union ? shared.length / union : 0, shared };
}

/** Similarity between two careers for plan B purposes, 0–1. */
export function neighbourSimilarity(a: Occupation, b: Occupation): number {
  const area = a.anzsco.slice(0, 3) === b.anzsco.slice(0, 3) ? 1 : a.anzsco.slice(0, 2) === b.anzsco.slice(0, 2) ? 0.6 : a.anzsco[0] === b.anzsco[0] ? 0.25 : 0;
  return 0.45 * profileSimilarity(a, b) + 0.35 * skillOverlap(a, b).overlap + 0.2 * area;
}

const AI_RANK = { low: 0, medium: 1, high: 2 } as const;

/**
 * The best plan B careers for this student: similar to the career, a reasonable personal fit, a
 * different occupation group, and preferably safer from AI automation or with a better outlook.
 */
export function neighbours(match: Match, scored: Match[], graph: SkillsGraph | undefined, limit = 3): Neighbour[] {
  const occ = match.occupation;
  const fitFloor = Math.max(45, match.scores.personalFit.score - 20);
  const candidates = scored
    .filter((m) => m.occupation.osca !== occ.osca && m.occupation.anzsco !== occ.anzsco && !m.occupation.identified && m.scores.personalFit.score >= fitFloor)
    .map((m) => {
      const sim = neighbourSimilarity(occ, m.occupation);
      const safer = (AI_RANK[occ.aiExposure] - AI_RANK[m.occupation.aiExposure]) / 2 + (BAND_SCORE[m.outlook.band10] - BAND_SCORE[match.outlook.band10]);
      const rank = 0.6 * sim + 0.25 * (m.scores.personalFit.score / 100) + 0.15 * clamp01(0.5 + safer / 2);
      return { m, sim, safer, rank };
    })
    .filter((c) => c.sim >= 0.45)
    .sort((a, b) => b.rank - a.rank || a.m.occupation.title.localeCompare(b.m.occupation.title));

  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (picked.length === limit) break;
    // Spread the options: no two from the same occupation group.
    if (picked.some((p) => p.m.occupation.anzsco === c.m.occupation.anzsco)) continue;
    picked.push(c);
  }
  return picked.map(({ m, sim, safer }) => {
    const { shared } = skillOverlap(occ, m.occupation);
    const sharedSkills = shared.map((s) => graph?.label(s) ?? s).filter((s) => !s.startsWith("core-") && !s.startsWith("sk-")).slice(0, 3);
    const lessAi = AI_RANK[m.occupation.aiExposure] < AI_RANK[occ.aiExposure];
    const better = BAND_SCORE[m.outlook.band10] > BAND_SCORE[match.outlook.band10];
    const why = lessAi && better
      ? "Less exposed to AI and a stronger job outlook."
      : lessAi
        ? "Less exposed to AI automation."
        : better
          ? "A stronger job outlook to 2035."
          : safer >= 0
            ? "Uses much of the same skills and suits the same kind of person."
            : "A close neighbour if you want something similar.";
    return {
      osca: m.occupation.osca,
      title: m.occupation.title,
      family: m.occupation.family,
      similarity: Math.round(sim * 100),
      sharedSkills,
      personalFit: m.scores.personalFit.score,
      aiExposure: m.occupation.aiExposure,
      outlook: m.outlook.band10,
      why,
    };
  });
}

const CLOSE = 0.62;
let table: { scores: Map<string, { score: number; close: number; parts: Record<string, number> }>; cuts: [number, number] } | null = null;

/** Career-level resilience for every career, computed once from any student's scored list. */
function resilienceTable(scored: Match[]) {
  if (table && table.scores.size === scored.length) return table;
  const growing = scored.filter((m) => m.outlook.band10 === "strong" || m.outlook.band10 === "good");
  const scores = new Map<string, { score: number; close: number; parts: Record<string, number> }>();
  for (const m of scored) {
    const occ = m.occupation;
    const near = scored.filter((o) => o.occupation.osca !== occ.osca && neighbourSimilarity(occ, o.occupation) >= CLOSE);
    const closeGrowing = near.filter((o) => growing.includes(o)).length;
    const transition = occ.genAi?.highFitTransitionPct;
    const parts = {
      transitions: transition != null ? clamp01(transition / 35) : near.length ? closeGrowing / near.length : 0.3,
      lowAutomation: 1 - (occ.genAi ? occ.genAi.automationPercentile : occ.market.ai.automation) / 100,
      outlook: BAND_SCORE[m.outlook.band10],
      breadth: clamp01(closeGrowing / 6),
    };
    scores.set(occ.osca, { score: Math.round(25 * (parts.transitions + parts.lowAutomation + parts.outlook + parts.breadth)), close: closeGrowing, parts });
  }
  const sorted = [...scores.values()].map((v) => v.score).sort((a, b) => a - b);
  const cuts: [number, number] = [sorted[Math.floor(sorted.length / 3)], sorted[Math.floor((2 * sorted.length) / 3)]];
  table = { scores, cuts };
  return table;
}

export function resilience(match: Match, scored: Match[], graph: SkillsGraph | undefined): Resilience {
  const occ = match.occupation;
  const t = resilienceTable(scored);
  const entry = t.scores.get(occ.osca)!;
  const level: ResilienceLevel = entry.score >= t.cuts[1] ? "High" : entry.score >= t.cuts[0] ? "Medium" : "Low";
  const near = neighbours(match, scored, graph);
  const transition = occ.genAi?.highFitTransitionPct;

  const reasons: string[] = [];
  if (transition != null && transition >= 25) reasons.push(`${Math.round(transition)}% of people who left this job moved into a growing, similar one (JSA), more than most.`);
  else if (transition != null && transition < 8) reasons.push(`Only ${Math.round(transition)}% of people who left this job moved into a growing, similar one (JSA), so a change could mean retraining.`);
  if (entry.close >= 4) reasons.push(`${entry.close} growing careers are close to this one, so your skills have somewhere to go.`);
  else if (entry.close <= 1) reasons.push("Few growing careers are close to this one, so plan how you'd broaden your skills.");
  if (occ.aiExposure === "low") reasons.push("Most of the work is hands-on or face-to-face, which Gen AI can't do.");
  if (occ.aiExposure === "high") reasons.push("Gen AI could do many of its tasks, so the job is likely to change; specialist and people skills will matter more.");
  if (match.outlook.band10 === "strong" || match.outlook.band10 === "good") reasons.push("Jobs and Skills Australia expects employment to grow to 2035.");
  if (match.outlook.band10 === "limited" || match.outlook.band10 === "declining") reasons.push("Jobs and Skills Australia expects limited growth to 2035.");
  if (occ.genAi?.skillChange != null && occ.genAi.skillChange >= 5) reasons.push("Its skills have changed faster than most jobs since 2012, so expect to keep learning.");
  if (!near.length) reasons.push("Few close neighbours fit you, so a plan B would mean a bigger step.");
  return { score: entry.score, level, reasons: reasons.slice(0, 4), neighbours: near };
}

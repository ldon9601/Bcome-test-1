import { FIT_FLOOR, FIT_WINDOW, type Match } from "./matching.ts";
import { neighbourSimilarity } from "./resilience.ts";
import type { IdeaSource } from "../questionnaire/types.ts";

/**
 * "Test my idea": the careers a student already has in mind, checked against their profile.
 *
 * Each idea gets its personal fit, where it ranks among all careers for this student, a verdict
 * in Bcome's usual encouraging terms (never "unsuitable"), what lines up and what they'd need to
 * build, and up to two similar careers that fit them better. Ideas never change the recommended
 * list: the evidence-based matches stay exactly as they are.
 */

export type IdeaVerdict = "strong" | "good" | "stretch";

export interface IdeaCheck {
  osca: string;
  verdict: IdeaVerdict;
  headline: string;
  /** e.g. 23 = the student's 23rd-best personal fit of all careers. */
  rank: number;
  of: number;
  /** Already one of the student's recommended careers. */
  recommended: boolean;
  /** The part of personal fit that holds it back most, when it's a stretch. */
  holdingBack: string | null;
  alternatives: { osca: string; title: string; family: string; personalFit: number; similarity: number }[];
}

const PART_LABEL: Record<string, string> = {
  interests: "the kinds of activities you said you enjoy",
  skills: "the strengths you rated yourself on",
  values: "what matters most to you in work",
  environment: "the way you like to work",
  subjects: "the subjects you enjoy and feel confident in",
};

const SOURCE_NOTE: Partial<Record<IdeaSource, string>> = {
  family: "It's great that your family sees this in you.",
  teacher: "It's great that a teacher or adviser sees this in you.",
  friends: "Your friends know you well, so it's worth taking seriously.",
  experience: "Real experience is one of the best ways to find out what you like.",
};

export function sourceNote(sources: string[]): string | null {
  for (const s of ["experience", "family", "teacher", "friends"] as const) if (sources.includes(s)) return SOURCE_NOTE[s]!;
  return null;
}

export function checkIdeas(ideas: string[], scored: Match[], recommended: Match[]): { match: Match; check: IdeaCheck }[] {
  const pool = scored.filter((m) => !m.occupation.identified || ideas.includes(m.occupation.osca));
  const byFit = [...pool].sort((a, b) => b.scores.personalFit.score - a.scores.personalFit.score || a.occupation.title.localeCompare(b.occupation.title));
  const best = byFit[0]?.scores.personalFit.score ?? 0;
  const strongFrom = Math.max(FIT_FLOOR, best - FIT_WINDOW);
  const goodFrom = Math.max(FIT_FLOOR - 10, best - FIT_WINDOW - 8);
  const shown = new Set(recommended.map((m) => m.occupation.osca));

  return ideas
    .map((osca) => scored.find((m) => m.occupation.osca === osca))
    .filter((m): m is Match => Boolean(m))
    .map((m) => {
      const osca = m.occupation.osca;
      const fit = m.scores.personalFit.score;
      const verdict: IdeaVerdict = fit >= strongFrom ? "strong" : fit >= goodFrom ? "good" : "stretch";
      const parts = m.scores.personalFit.parts as Record<string, number>;
      const weakest = Object.entries(parts)
        .filter(([k]) => k in PART_LABEL)
        .sort((a, b) => a[1] - b[1])[0];
      const alternatives = byFit
        .filter((o) => o.occupation.osca !== osca && !o.occupation.identified && o.scores.personalFit.score >= fit + 3)
        .map((o) => ({ o, sim: neighbourSimilarity(m.occupation, o.occupation) }))
        .filter((x) => x.sim >= 0.6)
        .sort((a, b) => b.sim + b.o.scores.personalFit.score / 200 - (a.sim + a.o.scores.personalFit.score / 200))
        .slice(0, 2)
        .map(({ o, sim }) => ({ osca: o.occupation.osca, title: o.occupation.title, family: o.occupation.family, personalFit: o.scores.personalFit.score, similarity: Math.round(sim * 100) }));
      const headline =
        verdict === "strong"
          ? "This is one of your strongest fits."
          : verdict === "good"
            ? "A good fit, with a few things to build."
            : "It fits less of your profile right now, but that can change.";
      return {
        match: m,
        check: {
          osca,
          verdict,
          headline,
          rank: byFit.indexOf(m) + 1,
          of: byFit.length,
          recommended: shown.has(osca),
          holdingBack: verdict === "stretch" && weakest ? PART_LABEL[weakest[0]] : null,
          alternatives,
        },
      };
    });
}

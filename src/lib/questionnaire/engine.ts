import { rankTypes, scoreRiasec } from "./scoring.ts";
import {
  RIASEC,
  type Answers,
  type LikertQuestion,
  type Question,
  type QuestionBank,
  type RiasecType,
  type SectionId,
} from "./types.ts";

/**
 * Adaptive questionnaire engine.
 *
 * Every student answers the tier-1 interest items (3 per RIASEC type). The engine then
 * asks deeper tiers only for the types whose ranking is still uncertain: a type whose
 * score sits close to the boundary of the top three, or a near-tie for first place.
 * Clear-cut profiles finish in about 40 questions; mixed profiles get up to 66.
 */

const SECTION_ORDER: SectionId[] = ["about", "interests", "values", "subjects", "plans"];

/** Score gap (0–100) inside which two types are treated as "too close to call". */
export const CONTENTION_MARGIN: Record<2 | 3, number> = { 2: 15, 3: 10 };

function isAnswered(answers: Answers, id: string): boolean {
  const v = answers[id];
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v !== "";
}

export function isVisible(q: Question, answers: Answers): boolean {
  const conds = q.showIf?.answers;
  if (!conds) return true;
  return Object.entries(conds).every(([id, allowed]) => {
    const v = answers[id];
    const given = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
    return given.some((g) => allowed.includes(g));
  });
}

function interestItems(bank: QuestionBank, tier: 1 | 2 | 3): LikertQuestion[] {
  const items = bank.questions.filter(
    (q): q is LikertQuestion => q.kind === "likert" && q.scale.type === "riasec" && q.tier === tier,
  );
  // Interleave types (R, I, A, S, E, C, R, I, ...) so students don't see six similar items in a row.
  const byType = RIASEC.map((t) => items.filter((q) => q.scale.type === "riasec" && q.scale.code === t));
  const out: LikertQuestion[] = [];
  for (let i = 0; i < Math.max(...byType.map((l) => l.length)); i++) {
    for (const list of byType) if (list[i]) out.push(list[i]);
  }
  return out;
}

/** Types whose position in the top three is still uncertain at the given margin. */
export function typesInContention(scores: Record<RiasecType, number>, margin: number): RiasecType[] {
  const ranked = rankTypes(scores);
  const third = scores[ranked[2]];
  const fourth = scores[ranked[3]];
  const contested = new Set<RiasecType>();

  // Boundary of the top three: anything close to the 3rd/4th cut-off.
  if (third - fourth <= margin) {
    for (const t of RIASEC) if (Math.abs(scores[t] - third) <= margin || Math.abs(scores[t] - fourth) <= margin) contested.add(t);
  }
  // Near-tie for first place decides the lead letter of the Holland code.
  if (scores[ranked[0]] - scores[ranked[1]] <= margin) {
    contested.add(ranked[0]);
    contested.add(ranked[1]);
  }
  return RIASEC.filter((t) => contested.has(t));
}

/** The interest items still to ask, given the answers so far. */
function pendingInterestItems(bank: QuestionBank, answers: Answers): LikertQuestion[] {
  const tier1 = interestItems(bank, 1);
  const open1 = tier1.filter((q) => !isAnswered(answers, q.id));
  if (open1.length) return open1;

  let previousTier: LikertQuestion[] = tier1;
  for (const tier of [2, 3] as const) {
    const tierItems = interestItems(bank, tier);
    // Which types were selected for this tier? Decide from answers up to the previous tier only,
    // so the selection doesn't shift while the student is answering this tier.
    const askedSoFar = new Set(previousTier.map((q) => q.id));
    const decided = Object.fromEntries(Object.entries(answers).filter(([id]) => askedSoFar.has(id)));
    const scoresBefore = scoreRiasec(bank, decided).scores;
    const contested = new Set(typesInContention(scoresBefore, CONTENTION_MARGIN[tier]));
    const selected = tierItems.filter((q) => q.scale.type === "riasec" && contested.has(q.scale.code));
    const open = selected.filter((q) => !isAnswered(answers, q.id));
    if (open.length) return open;
    if (!selected.length) return [];
    previousTier = [...previousTier, ...selected];
  }
  return [];
}

/** Returns the next question to ask, or null when the questionnaire is complete. */
export function nextQuestion(bank: QuestionBank, answers: Answers): Question | null {
  for (const section of SECTION_ORDER) {
    if (section === "interests") {
      const pending = pendingInterestItems(bank, answers);
      if (pending.length) return pending[0];
      continue;
    }
    const q = bank.questions.find(
      (q) => q.section === section && isVisible(q, answers) && !isAnswered(answers, q.id),
    );
    if (q) return q;
  }
  return null;
}

/** Rough progress for the progress bar. The total can shrink or grow slightly as the engine adapts. */
export function progress(bank: QuestionBank, answers: Answers): { answered: number; estimatedTotal: number } {
  const nonInterest = bank.questions.filter((q) => q.section !== "interests" && isVisible(q, answers));
  const answeredInterest = bank.questions.filter(
    (q) => q.section === "interests" && isAnswered(answers, q.id),
  ).length;
  const pending = pendingInterestItems(bank, answers).length;
  const answered = answeredInterest + nonInterest.filter((q) => isAnswered(answers, q.id)).length;
  // Before tier 1 is finished we can't know how many deeper items will be needed; assume 6.
  const tier1Done = interestItems(bank, 1).every((q) => isAnswered(answers, q.id));
  const deeperEstimate = tier1Done ? 0 : 6;
  return { answered, estimatedTotal: nonInterest.length + answeredInterest + pending + deeperEstimate };
}

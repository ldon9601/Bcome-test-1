import type { AnswerValue, Answers, Question, QuestionBank } from "./types.ts";

/**
 * Question sequencing for the Career Profile. Every student answers the same 36 questions
 * (plus four onboarding questions) in a fixed order, so results are comparable between students
 * and between check-ins. Conditional questions use `showIf`.
 */

export function isAnswered(q: Question, value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  switch (q.kind) {
    case "multi":
      return Array.isArray(value) && value.length >= (q.min ?? 1);
    case "rank":
      return Array.isArray(value) && value.length === q.options.length;
    case "matrix":
      return typeof value === "object" && !Array.isArray(value) && q.rows.every((r) => q.columns.every((c) => Boolean(value[`${r.value}.${c.value}`])));
    default:
      return typeof value === "string" && value !== "";
  }
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

/** Returns the next question to ask, or null when the assessment is complete. */
export function nextQuestion(bank: QuestionBank, answers: Answers): Question | null {
  return bank.questions.find((q) => isVisible(q, answers) && !isAnswered(q, answers[q.id])) ?? null;
}

export function progress(bank: QuestionBank, answers: Answers): { answered: number; estimatedTotal: number } {
  const visible = bank.questions.filter((q) => isVisible(q, answers));
  return { answered: visible.filter((q) => isAnswered(q, answers[q.id])).length, estimatedTotal: visible.length };
}

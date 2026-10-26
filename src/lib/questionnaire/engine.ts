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
    case "careers":
      return Array.isArray(value) && value.length >= 1;
    case "rank":
      return Array.isArray(value) && value.length === q.options.length;
    case "matrix":
      return typeof value === "object" && !Array.isArray(value) && q.rows.every((r) => q.columns.every((c) => Boolean(value[`${r.value}.${c.value}`])));
    default:
      return typeof value === "string" && value !== "";
  }
}

export function isVisible(q: Question, answers: Answers): boolean {
  const given = (id: string) => {
    const v = answers[id];
    return Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  };
  const only = q.showIf?.answers;
  const except = q.showIf?.except;
  if (only && !Object.entries(only).every(([id, allowed]) => given(id).some((g) => allowed.includes(g)))) return false;
  if (except && !Object.entries(except).every(([id, excluded]) => given(id).some((g) => !excluded.includes(g)))) return false;
  return true;
}

/** Returns the next question to ask, or null when the assessment is complete. */
export function nextQuestion(bank: QuestionBank, answers: Answers): Question | null {
  return bank.questions.find((q) => isVisible(q, answers) && !isAnswered(q, answers[q.id])) ?? null;
}

export function progress(bank: QuestionBank, answers: Answers): { answered: number; estimatedTotal: number } {
  const visible = bank.questions.filter((q) => isVisible(q, answers));
  return { answered: visible.filter((q) => isAnswered(q, answers[q.id])).length, estimatedTotal: visible.length };
}

const GROUPABLE = new Set<Question["kind"]>(["likert", "bipolar", "single"]);

/**
 * The next screen of questions: up to `max` consecutive unanswered rating, slider or single-choice
 * questions from the same section. Ranking, grid and multi-select questions get a screen to themselves.
 */
export function nextPage(bank: QuestionBank, answers: Answers, max = 3): Question[] {
  const visible = bank.questions.filter((q) => isVisible(q, answers));
  const start = visible.findIndex((q) => !isAnswered(q, answers[q.id]));
  if (start === -1) return [];
  const first = visible[start];
  if (!GROUPABLE.has(first.kind)) return [first];
  const page = [first];
  for (let j = start + 1; j < visible.length && page.length < max; j++) {
    const q = visible[j];
    if (q.section !== first.section || !GROUPABLE.has(q.kind) || isAnswered(q, answers[q.id])) break;
    page.push(q);
  }
  return page;
}

/** Where a page sits within its section, e.g. questions 4–6 of 12. */
export function sectionPosition(bank: QuestionBank, answers: Answers, page: Question[]) {
  const inSection = bank.questions.filter((q) => q.section === page[0].section && isVisible(q, answers));
  const from = inSection.indexOf(page[0]) + 1;
  return { from, to: from + page.length - 1, total: inSection.length };
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { questionBank } from "../src/lib/data.ts";
import { isVisible, nextQuestion, progress, typesInContention } from "../src/lib/questionnaire/engine.ts";
import { buildProfile, hexagonDistance, IncompleteAnswersError, likertTo100, scoreRiasec } from "../src/lib/questionnaire/scoring.ts";
import type { Answers } from "../src/lib/questionnaire/types.ts";
import { PERSONAS, simulate } from "./fixtures/personas.ts";

test("likert converts 1–5 to 0–100 and rejects bad input", () => {
  assert.equal(likertTo100("1"), 0);
  assert.equal(likertTo100("3"), 50);
  assert.equal(likertTo100("5"), 100);
  assert.equal(likertTo100("6"), null);
  assert.equal(likertTo100(undefined), null);
});

test("hexagon distance wraps around R–C", () => {
  assert.equal(hexagonDistance("R", "I"), 1);
  assert.equal(hexagonDistance("R", "C"), 1);
  assert.equal(hexagonDistance("R", "S"), 3);
});

test("starts with the about section, then interleaves interest types", () => {
  const answers: Answers = {};
  assert.equal(nextQuestion(questionBank, answers)?.id, "year_level");
  answers.year_level = "11";
  answers.state = "NSW";
  const order: string[] = [];
  for (let i = 0; i < 6; i++) {
    const q = nextQuestion(questionBank, answers)!;
    order.push(q.id);
    answers[q.id] = "3";
  }
  assert.deepEqual(order, ["r1", "i1", "a1", "s1", "e1", "c1"]);
});

test("a clear profile skips the deeper interest tiers", () => {
  const p = PERSONAS.find((x) => x.key === "jack-electrical")!;
  const { answers, asked } = simulate(questionBank, p);
  const tier2Asked = questionBank.questions.filter((q) => q.kind === "likert" && q.tier === 2 && answers[q.id]);
  assert.ok(asked < 40, `asked ${asked}`);
  assert.ok(tier2Asked.length <= 6);
});

test("a flat profile asks every interest tier", () => {
  const p = PERSONAS.find((x) => x.key === "ava-flat")!;
  const { answers } = simulate(questionBank, p);
  const interestAnswered = questionBank.questions.filter((q) => q.section === "interests" && answers[q.id]).length;
  assert.equal(interestAnswered, 48);
});

test("contention finds near-ties at the top-three boundary and for first place", () => {
  assert.deepEqual(typesInContention({ R: 90, I: 30, A: 20, S: 85, E: 10, C: 60 }, 15), ["R", "S"]);
  // A (3rd) and S (4th) are 5 apart, so both, and I just above them, are re-checked; R is safe.
  assert.deepEqual(typesInContention({ R: 90, I: 50, A: 45, S: 40, E: 10, C: 5 }, 15), ["I", "A", "S"]);
});

test("conditional questions only show for matching answers", () => {
  const q = questionBank.questions.find((x) => x.id === "apprenticeship_area")!;
  assert.equal(isVisible(q, { study_preference: "university" }), false);
  assert.equal(isVisible(q, { study_preference: "apprenticeship" }), true);
});

test("every persona finishes and produces a valid profile", () => {
  for (const p of PERSONAS) {
    const { answers } = simulate(questionBank, p);
    assert.equal(nextQuestion(questionBank, answers), null);
    const prof = buildProfile(questionBank, answers);
    assert.equal(prof.riasec.code.length, 3);
    const pr = progress(questionBank, answers);
    assert.equal(pr.answered, pr.estimatedTotal, p.key);
  }
});

test("scores follow the answers", () => {
  const { answers } = simulate(questionBank, PERSONAS.find((x) => x.key === "mia-health")!);
  const r = scoreRiasec(questionBank, answers);
  assert.equal(r.code[0], "S");
  assert.ok(r.scores.S > r.scores.R);
});

test("buildProfile reports what is missing", () => {
  assert.throws(
    () => buildProfile(questionBank, { year_level: "10" }),
    (e: unknown) => e instanceof IncompleteAnswersError && e.missing.includes("state") && e.missing.includes("interests"),
  );
});

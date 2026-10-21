import assert from "node:assert/strict";
import { test } from "node:test";
import { questionBank } from "../src/lib/data.ts";
import { isAnswered, nextQuestion, progress } from "../src/lib/questionnaire/engine.ts";
import { buildProfile, centreValues, IncompleteAnswersError, likertTo100 } from "../src/lib/questionnaire/scoring.ts";
import { DNA_DIMS, type Answers, type Question } from "../src/lib/questionnaire/types.ts";
import { PERSONAS, simulate } from "./fixtures/personas.ts";

const persona = (key: string) => PERSONAS.find((p) => p.key === key)!;

test("the Career Profile has 36 numbered questions in five sections, after four onboarding questions", () => {
  const numbered = questionBank.questions.filter((q) => q.number !== undefined);
  assert.equal(numbered.length, 36);
  assert.deepEqual(
    questionBank.questions.filter((q) => q.section === "about").map((q) => q.id),
    ["year_level", "state", "current_subjects", "geography"],
  );
  const count = (section: string) => numbered.filter((q) => q.section === section).length;
  assert.deepEqual([count("interests"), count("strengths"), count("values"), count("environment"), count("school")], [12, 8, 8, 5, 3]);
});

test("questions use the wording and scales from the requirements", () => {
  const q = (n: number) => questionBank.questions.find((x) => x.number === n)!;
  assert.equal(q(1).prompt, "Build, assemble or repair something using tools or equipment.");
  assert.equal(q(13).prompt, "Working with numbers, maths or logical patterns.");
  assert.equal(q(28).prompt, "Constantly learning and being intellectually challenged.");
  assert.equal(q(29).kind, "rank");
  assert.equal(q(34).kind, "matrix");
  assert.equal(questionBank.scales.interest[0].label, "Strongly dislike");
  assert.equal(questionBank.scales.interest[4].label, "Would love it");
  assert.equal(questionBank.scales.confidence[0].label, "Not confident yet");
});

test("every student gets the same questions in the same order", () => {
  for (const p of PERSONAS) assert.equal(simulate(questionBank, p).asked, 40);
  assert.equal(nextQuestion(questionBank, {})?.id, "year_level");
});

test("rank and matrix questions are only complete when fully answered", () => {
  const rank = questionBank.questions.find((q) => q.id === "q29")! as Question;
  assert.equal(isAnswered(rank, ["people", "ideas"]), false);
  assert.equal(isAnswered(rank, ["people", "ideas", "data", "things"]), true);
  const matrix = questionBank.questions.find((q) => q.id === "q34")! as Question;
  assert.equal(isAnswered(matrix, { "mathematics.enjoyment": "3" }), false);
});

test("likert converts 1–5 to 0–100", () => {
  assert.equal(likertTo100("1"), 0);
  assert.equal(likertTo100("5"), 100);
  assert.equal(likertTo100("6"), null);
});

test("values are centred on the student's own average", () => {
  const all = centreValues({ purpose: 100, financial: 100, security: 100, autonomy: 100, creativity: 100, leadership: 100, worklife: 100, learning: 100 });
  assert.ok(Object.values(all).every((v) => v === 50), "rating everything 'extremely important' carries no preference");
  const some = centreValues({ purpose: 100, financial: 50, security: 50, autonomy: 50, creativity: 50, leadership: 50, worklife: 50, learning: 50 });
  assert.ok(some.purpose > 90 && some.financial < 50);
});

test("the profile reflects the answers", () => {
  const prof = buildProfile(questionBank, simulate(questionBank, persona("priya-tech")).answers);
  assert.equal(prof.riasec.code[0], "I");
  assert.equal(prof.skills.quantitative, 100);
  assert.equal(prof.environment.data, 100); // ranked first
  assert.equal(prof.environment.people, 0); // ranked last
  assert.equal(prof.subjects.computing.enjoyment, 100);
  assert.deepEqual(prof.educationPaths, ["university"]);
  assert.equal(prof.studyTolerance.years, 4);
  for (const d of DNA_DIMS) assert.ok(prof.dna[d] >= 0 && prof.dna[d] <= 100);
  assert.ok(prof.dna.analytical > prof.dna.interpersonal);
});

test("'not sure' answers lower completeness and are named, so the student knows what to add", () => {
  const prof = buildProfile(questionBank, simulate(questionBank, persona("ava-flat")).answers);
  assert.ok(prof.quality.completeness < 0.8);
  assert.ok(prof.quality.lowInformation.some((x) => x.includes("work environment")));
  const clear = buildProfile(questionBank, simulate(questionBank, persona("mia-health")).answers);
  assert.equal(clear.quality.completeness, 1);
});

test("progress counts every visible question", () => {
  const { answers } = simulate(questionBank, persona("noah-leader"));
  assert.deepEqual(progress(questionBank, answers), { answered: 40, estimatedTotal: 40 });
});

test("buildProfile reports what is missing", () => {
  const partial: Answers = { year_level: "10" };
  assert.throws(
    () => buildProfile(questionBank, partial),
    (e: unknown) => e instanceof IncompleteAnswersError && e.missing.includes("state") && e.missing.includes("q34"),
  );
});

test("questions are shown up to three at a time within a section", async () => {
  const { nextPage, sectionPosition } = await import("../src/lib/questionnaire/engine.ts");
  assert.deepEqual(nextPage(questionBank, {}).map((q) => q.id), ["year_level", "state"]);
  const base = { year_level: "11", state: "NSW", current_subjects: ["english"], geography: "state" };
  const page = nextPage(questionBank, base);
  assert.deepEqual(page.map((q) => q.number), [1, 2, 3]);
  assert.deepEqual(sectionPosition(questionBank, base, page), { from: 1, to: 3, total: 12 });
  // The last interest page stops at the section boundary.
  const answered: Answers = { ...base };
  for (let n = 1; n <= 10; n++) answered[`q${String(n).padStart(2, "0")}`] = "3";
  assert.deepEqual(nextPage(questionBank, answered).map((q) => q.number), [11, 12]);
  // Ranking and the subject grid get a screen of their own.
  const rank = questionBank.questions.find((q) => q.id === "q29")!;
  const before: Answers = Object.fromEntries(questionBank.questions.filter((q) => q.kind === "likert" || q.section === "about").map((q) => [q.id, q.kind === "multi" ? ["english"] : "3"]));
  assert.deepEqual(nextPage(questionBank, before), [rank]);
});

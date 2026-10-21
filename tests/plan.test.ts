import assert from "node:assert/strict";
import { test } from "node:test";
import { matchCareers } from "../src/lib/careers/matching.ts";
import { earningsData, jsaOutlook, occupationData, questionBank, skillsGraph, subjectLabels } from "../src/lib/data.ts";
import { buildPlanContext } from "../src/lib/plan/context.ts";
import { extractJson, generatePlan } from "../src/lib/plan/generate.ts";
import { inSentence, templatePlan } from "../src/lib/plan/template.ts";
import { validatePlanBody } from "../src/lib/plan/types.ts";
import { buildProfile } from "../src/lib/questionnaire/scoring.ts";
import { PERSONAS, simulate } from "./fixtures/personas.ts";

function contextFor(key: string) {
  const p = PERSONAS.find((x) => x.key === key)!;
  const profile = buildProfile(questionBank, simulate(questionBank, p).answers);
  const matches = matchCareers(profile, occupationData.occupations, jsaOutlook, { subjectLabels, graph: skillsGraph });
  return buildPlanContext(profile, matches, jsaOutlook, subjectLabels, skillsGraph, earningsData);
}

/** A fetch stand-in that returns the given text as an Anthropic message. */
function fakeFetch(text: string, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status })) as unknown as typeof fetch;
}

test("template plans are valid for every persona", () => {
  for (const p of PERSONAS) {
    const ctx = contextFor(p.key);
    const plan = templatePlan(ctx, "2026-10-21T00:00:00Z");
    const allowed = new Set(ctx.topCareers.map((c) => c.occupationId));
    assert.deepEqual(validatePlanBody(plan, allowed), [], p.key);
  }
});

test("Year 12 university plans name the state's admissions centre", () => {
  const plan = templatePlan(contextFor("priya-tech"));
  assert.ok(plan.stages[0].actions.some((a) => a.includes("VTAC")));
});

test("Year 10 plans recommend prerequisite subjects", () => {
  const ctx = contextFor("priya-tech");
  ctx.student.yearLevel = 10;
  const plan = templatePlan(ctx);
  assert.ok(plan.stages[0].actions.some((a) => a.startsWith("Choose Maths")), plan.stages[0].actions.join(" | "));
});

test("flat profiles are told to explore rather than given a false 'strongest interest'", () => {
  const plan = templatePlan(contextFor("ava-flat"));
  assert.match(plan.summary, /spread fairly evenly/);
  assert.doesNotMatch(plan.summary, /strongest interests/);
});

test("titles keep acronyms in sentences", () => {
  assert.equal(inSentence("ICT Manager"), "ICT manager");
  assert.equal(inSentence("Graphic / Web Designer"), "graphic / web designer");
});

test("without an API key the template is used", async () => {
  const plan = await generatePlan(contextFor("mia-health"));
  assert.equal(plan.meta.generatedBy, "template");
});

test("a valid AI plan is accepted", async () => {
  const ctx = contextFor("mia-health");
  const body = templatePlan(ctx);
  const { meta: _meta, ...rest } = body;
  const plan = await generatePlan(ctx, { apiKey: "test", fetchImpl: fakeFetch("```json\n" + JSON.stringify(rest) + "\n```") });
  assert.equal(plan.meta.generatedBy, "claude");
  assert.equal(plan.meta.fallbackReason, undefined);
});

test("scores and facts on an AI plan come from our data, not the model", async () => {
  const ctx = contextFor("mia-health");
  const { meta: _meta, ...rest } = templatePlan(ctx);
  rest.topCareers = rest.topCareers.map((c) => ({ ...c, scores: { personalFit: 1, futureOpportunity: 1, pathwayFeasibility: 1 }, facts: undefined }));
  rest.skillsBridge = ["Teamwork", "Juggling"];
  const plan = await generatePlan(ctx, { apiKey: "test", fetchImpl: fakeFetch(JSON.stringify(rest)) });
  assert.deepEqual(plan.topCareers[0].scores, ctx.topCareers[0].scores);
  assert.equal(plan.topCareers[0].facts?.osca, ctx.topCareers[0].occupationId);
  assert.ok(!plan.skillsBridge?.includes("Juggling"));
});

test("template plans quote starting pay and time to qualify", () => {
  const plan = templatePlan(contextFor("jack-electrical"));
  assert.match(plan.stages[2].actions.join(" "), /Starting pay is roughly \$\d+k/);
  assert.match(plan.stages[1].timeframe, /years after school/);
  assert.ok(plan.topCareers.every((c) => c.facts && c.scores));
});

test("an AI plan naming a career we didn't supply falls back to the template", async () => {
  const ctx = contextFor("mia-health");
  const { meta: _meta, ...rest } = templatePlan(ctx);
  rest.topCareers[0] = { ...rest.topCareers[0], occupationId: "astronaut" };
  const plan = await generatePlan(ctx, { apiKey: "test", fetchImpl: fakeFetch(JSON.stringify(rest)) });
  assert.equal(plan.meta.generatedBy, "template");
  assert.match(plan.meta.fallbackReason ?? "", /did not supply/);
});

test("API errors fall back to the template", async () => {
  const plan = await generatePlan(contextFor("mia-health"), { apiKey: "test", fetchImpl: fakeFetch("overloaded", 529) });
  assert.equal(plan.meta.generatedBy, "template");
  assert.match(plan.meta.fallbackReason ?? "", /529/);
});

test("extractJson handles fences and surrounding text", () => {
  assert.deepEqual(extractJson('Here you go:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('{"a":{"b":2}} trailing'), { a: { b: 2 } });
  assert.throws(() => extractJson("no json here"));
});

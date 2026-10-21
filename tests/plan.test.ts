import assert from "node:assert/strict";
import { test } from "node:test";
import { matchCareers } from "../src/lib/careers/matching.ts";
import { earningsData, jsaOutlook, occupationData, questionBank, skillsGraph, subjectLabels } from "../src/lib/data.ts";
import { buildPlanContext, dnaSummary } from "../src/lib/plan/context.ts";
import { extractJson, generatePlan } from "../src/lib/plan/generate.ts";
import { buildJourney, milestoneFocus } from "../src/lib/plan/journey.ts";
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
  return (async () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status })) as unknown as typeof fetch;
}

const periodIds = (ctx: ReturnType<typeof contextFor>) => buildJourney(ctx).periods.map((p) => p.id);

test("template plans are valid for every persona", () => {
  for (const p of PERSONAS) {
    const ctx = contextFor(p.key);
    const plan = templatePlan(ctx, "2026-10-22T00:00:00Z");
    assert.deepEqual(validatePlanBody(plan, new Set(ctx.careers.map((c) => c.occupationId)), periodIds(ctx)), [], p.key);
  }
});

test("plans keep the engine's personal-fit order and carry every score and fact", () => {
  const ctx = contextFor("leo-creative");
  const plan = templatePlan(ctx);
  assert.deepEqual(plan.careers.map((c) => c.occupationId), ctx.careers.map((c) => c.occupationId));
  assert.ok(plan.careers.every((c) => c.scores && c.facts && c.strengths && c.future && c.confidence && c.group));
  assert.match(plan.careers[0].whyItFits, /^It lines up with your artistic interests/);
});

test("the journey runs from the student's year level to their first years of work", () => {
  assert.deepEqual(periodIds(contextFor("mia-health")), ["year-10", "year-11", "year-12", "summer", "training-start", "training-later", "early-career"]);
  assert.deepEqual(periodIds(contextFor("priya-tech")), ["year-12", "summer", "training-start", "training-later", "early-career"]);
  const jack = buildJourney(contextFor("jack-electrical"));
  assert.match(jack.periods.find((p) => p.id === "training-start")!.period, /Apprenticeship|Traineeship/);
});

test("Year 10 journeys recommend missing prerequisite subjects", () => {
  const ctx = contextFor("mia-health");
  ctx.careers[0].missingPrerequisites = ["Chemistry"];
  const y10 = buildJourney(ctx).periods[0];
  assert.match(y10.actions[0].text, /^Choose Chemistry for Years 11 and 12/);
});

test("the Career DNA summary describes the student before any careers", () => {
  const prof = buildProfile(questionBank, simulate(questionBank, PERSONAS.find((p) => p.key === "priya-tech")!).answers);
  assert.match(dnaSummary(prof), /^You appear most energised by complex problems/);
  const flat = buildProfile(questionBank, simulate(questionBank, PERSONAS.find((p) => p.key === "ava-flat")!).answers);
  assert.match(dnaSummary(flat), /spread fairly evenly/);
});

test("titles keep acronyms and milestones read naturally", () => {
  assert.equal(inSentence("ICT Manager"), "ICT manager");
  assert.equal(milestoneFocus("Registered nurse"), "Become a registered nurse");
  assert.equal(milestoneFocus("Airline first officer"), "Become an airline first officer");
  assert.equal(milestoneFocus("Working as a planner"), "Get established as a planner");
});

test("without an API key the template is used", async () => {
  assert.equal((await generatePlan(contextFor("mia-health"))).meta.generatedBy, "template");
});

function aiBody(ctx: ReturnType<typeof contextFor>) {
  const { meta: _meta, ...rest } = templatePlan(ctx);
  return { ...rest, careers: rest.careers.map(({ occupationId, title, whyItFits, outlook, howToGetThere }) => ({ occupationId, title, whyItFits, outlook, howToGetThere })) };
}

test("a valid AI plan is accepted, with scores and facts re-attached from our data", async () => {
  const ctx = contextFor("mia-health");
  const body = aiBody(ctx);
  body.careers.reverse(); // the model reorders careers
  const plan = await generatePlan(ctx, { apiKey: "test", fetchImpl: fakeFetch("```json\n" + JSON.stringify(body) + "\n```") });
  assert.equal(plan.meta.generatedBy, "claude");
  assert.deepEqual(plan.careers.map((c) => c.occupationId), ctx.careers.map((c) => c.occupationId), "engine order restored");
  assert.deepEqual(plan.careers[0].scores, ctx.careers[0].scores);
});

test("AI plans that add a career, change the journey or call a student unsuitable are rejected", async () => {
  const ctx = contextFor("mia-health");
  const extra = aiBody(ctx);
  extra.careers[0] = { ...extra.careers[0], occupationId: "999999" };
  assert.equal((await generatePlan(ctx, { apiKey: "test", fetchImpl: fakeFetch(JSON.stringify(extra)) })).meta.generatedBy, "template");

  const journey = aiBody(ctx);
  journey.journey.periods = journey.journey.periods.slice(1);
  const j = await generatePlan(ctx, { apiKey: "test", fetchImpl: fakeFetch(JSON.stringify(journey)) });
  assert.match(j.meta.fallbackReason ?? "", /journey periods/);

  const harsh = aiBody(ctx);
  harsh.careers[1].whyItFits = "Honestly you are unsuitable for this.";
  const h = await generatePlan(ctx, { apiKey: "test", fetchImpl: fakeFetch(JSON.stringify(harsh)) });
  assert.match(h.meta.fallbackReason ?? "", /unsuitable/);
});

test("API errors fall back to the template", async () => {
  const plan = await generatePlan(contextFor("mia-health"), { apiKey: "test", fetchImpl: fakeFetch("overloaded", 529) });
  assert.match(plan.meta.fallbackReason ?? "", /529/);
});

test("extractJson handles fences and surrounding text", () => {
  assert.deepEqual(extractJson('Here you go:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => extractJson("no json here"));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { careerFacts, formatRange, formatYears } from "../src/lib/careers/facts.ts";
import {
  byPersonalFitFirst,
  FIT_WINDOW,
  matchCareers,
  MATCH_WEIGHTS,
  occupationPidt,
  scoreOccupation,
  similarity,
} from "../src/lib/careers/matching.ts";
import type { EarningsData } from "../src/lib/careers/types.ts";
import { earningsData, jsaOutlook, occupationData, questionBank, skillsGraph, subjectLabels } from "../src/lib/data.ts";
import { buildProfile } from "../src/lib/questionnaire/scoring.ts";
import { PERSONAS, simulate, type Persona } from "./fixtures/personas.ts";

const byOsca = (code: string) => occupationData.occupations.find((o) => o.osca === code)!;
const profileOf = (key: string, overrides: Partial<Persona> = {}) =>
  buildProfile(questionBank, simulate(questionBank, { ...PERSONAS.find((p) => p.key === key)!, ...overrides }).answers);
const matchesFor = (key: string, overrides: Partial<Persona> = {}) =>
  matchCareers(profileOf(key, overrides), occupationData.occupations, jsaOutlook, { graph: skillsGraph, subjectLabels, limit: 63 });

test("similarity is 1 for identical profiles and falls with distance", () => {
  const dims = ["a", "b"] as const;
  assert.equal(similarity({ a: 80, b: 20 }, { a: 80, b: 20 }, dims), 1);
  assert.ok(similarity({ a: 0, b: 100 }, { a: 80, b: 20 }, dims) < 0.3);
  // Being stronger than a job needs costs half (skills) or nothing (subject prerequisites).
  assert.ok(similarity({ a: 100, b: 100 }, { a: 50, b: 50 }, dims, 0.5) > similarity({ a: 100, b: 100 }, { a: 50, b: 50 }, dims));
  assert.equal(similarity({ a: 100, b: 100 }, { a: 50, b: 50 }, dims, 0), 1);
});

test("the match score is 60% personal fit, 25% opportunity, 15% feasibility", () => {
  assert.deepEqual(MATCH_WEIGHTS, { personalFit: 0.6, futureOpportunity: 0.25, pathwayFeasibility: 0.15 });
  const m = scoreOccupation(profileOf("mia-health"), byOsca("2654"), jsaOutlook);
  const s = m.scores;
  assert.equal(m.score, Math.round(0.6 * s.personalFit.score + 0.25 * s.futureOpportunity.score + 0.15 * s.pathwayFeasibility.score));
});

test("personal fit always decides the order of recommendations", () => {
  for (const p of PERSONAS) {
    const rec = matchesFor(p.key).filter((m) => m.group !== "other");
    const best = Math.max(...matchesFor(p.key).map((m) => m.scores.personalFit.score));
    // Nothing with weak fit is recommended, however good its job outlook.
    assert.ok(rec.every((m) => m.scores.personalFit.score >= best - FIT_WINDOW - 3), p.key);
    // The student's single best fit is always the first career shown.
    assert.equal(rec[0].scores.personalFit.score, best, p.key);
  }
});

test("opportunity and pathway only reorder careers whose fit is within 5 points", () => {
  const a = { fit: 86, score: 70, title: "A" };
  const b = { fit: 80, score: 95, title: "B" };
  assert.ok(byPersonalFitFirst(a, b) < 0, "higher fit wins despite a much lower match score");
  const c = { fit: 86, score: 70, title: "C" };
  const d = { fit: 85, score: 80, title: "D" };
  assert.ok(byPersonalFitFirst(c, d) > 0, "within the same 5-point band, the match score decides");
});

test("recommendations come as best matches, worth exploring and one wildcard (5–8 careers)", () => {
  for (const p of PERSONAS) {
    const rec = matchesFor(p.key).filter((m) => m.group !== "other");
    assert.ok(rec.length >= 5 && rec.length <= 8, `${p.key}: ${rec.length}`);
    assert.equal(rec.filter((m) => m.group === "best").length, 5);
    assert.ok(rec.filter((m) => m.group === "explore").length <= 2);
    assert.ok(rec.filter((m) => m.group === "wildcard").length <= 1);
    if (p.expectAnyOf.length) assert.ok(rec.some((m) => p.expectAnyOf.includes(m.occupation.osca)), `${p.key}: ${rec.map((m) => m.occupation.title)}`);
  }
});

test("the wildcard comes from a different field", () => {
  for (const p of PERSONAS) {
    const rec = matchesFor(p.key).filter((m) => m.group !== "other");
    const wild = rec.find((m) => m.group === "wildcard");
    if (!wild) continue;
    const others = rec.filter((m) => m !== wild);
    assert.ok(
      !others.some((m) => m.occupation.osca[0] === wild.occupation.osca[0]) || !others.some((m) => m.occupation.riasec[0] === wild.occupation.riasec[0]),
      p.key,
    );
  }
});

test("diversity reranking avoids a list of near-identical careers", () => {
  const best = matchesFor("priya-tech").filter((m) => m.group === "best");
  const groups = new Set(best.map((m) => m.occupation.osca.slice(0, 3)));
  assert.ok(groups.size >= 3, best.map((m) => m.occupation.title).join(", "));
});

test("explanations list strengths and frame gaps as things to build", () => {
  const m = scoreOccupation(profileOf("mia-health", { currentSubjects: ["english", "biology"], yearLevel: 12 }), byOsca("264231"), jsaOutlook, { subjectLabels });
  assert.ok(m.strengths.length > 0 && m.strengths.every((s) => s.strength >= 1 && s.strength <= 9));
  assert.ok(m.challenges.some((c) => c.includes("Chemistry")));
  assert.ok(!JSON.stringify(m).match(/unsuitable|not suited/i));
});

test("a missing prerequisite lowers feasibility today and shows how to raise it", () => {
  const gp = byOsca("264231"); // often requires Chemistry
  const m = scoreOccupation(profileOf("mia-health", { currentSubjects: ["english", "biology"] }), gp, jsaOutlook, { subjectLabels });
  assert.ok(m.improvement && m.improvement.to > m.scores.pathwayFeasibility.score);
  assert.match(m.improvement!.action, /select Chemistry in Year 11/);
  const withChem = scoreOccupation(profileOf("mia-health"), gp, jsaOutlook, { subjectLabels });
  assert.equal(withChem.improvement, null);
});

test("feasibility follows the paths and study length the student would consider", () => {
  const electrician = byOsca("381231");
  const jack = scoreOccupation(profileOf("jack-electrical"), electrician, jsaOutlook);
  const uniOnly = scoreOccupation(profileOf("jack-electrical", { paths: ["university"] }), electrician, jsaOutlook);
  assert.ok(jack.scores.pathwayFeasibility.score > uniOnly.scores.pathwayFeasibility.score);
  const gp = byOsca("264231");
  const short = scoreOccupation(profileOf("mia-health", { tolerance: "1-2" }), gp, jsaOutlook);
  const long = scoreOccupation(profileOf("mia-health", { tolerance: "7+" }), gp, jsaOutlook);
  assert.ok(long.scores.pathwayFeasibility.score > short.scores.pathwayFeasibility.score);
  assert.ok(short.challenges.some((c) => c.includes("longer than you said")));
});

test("future opportunity is the same for every student and keeps AI separate from growth", () => {
  const a = scoreOccupation(profileOf("mia-health"), byOsca("273333"), jsaOutlook);
  const b = scoreOccupation(profileOf("jack-electrical"), byOsca("273333"), jsaOutlook);
  assert.equal(a.scores.futureOpportunity.score, b.scores.futureOpportunity.score);
  assert.ok("growth" in a.scores.futureOpportunity.parts && "aiAdaptability" in a.scores.futureOpportunity.parts);
  const clerk = scoreOccupation(profileOf("mia-health"), byOsca("561131"), jsaOutlook);
  assert.equal(clerk.future.aiAutomation, "High");
  assert.ok(clerk.scores.futureOpportunity.score < a.scores.futureOpportunity.score);
});

test("confidence drops when the student is unsure and says what would help", () => {
  const unsure = matchesFor("ava-flat")[0];
  const sure = matchesFor("mia-health")[0];
  assert.ok(unsure.confidence.score < sure.confidence.score);
  assert.notEqual(unsure.confidence.level, "High");
  assert.match(unsure.confidence.note ?? "", /We'd like to know more/);
});

test("occupation People/Ideas/Data/Things come from its interest profile", () => {
  const pidt = occupationPidt(byOsca("381231").profile.interests);
  assert.equal(pidt.things, 100);
  assert.equal(occupationPidt(byOsca("261331").profile.interests).people, 100); // social worker
});

test("career facts give salary, years from now and qualifications", () => {
  const facts = careerFacts(byOsca("381231"), skillsGraph, earningsData, 10);
  assert.deepEqual(facts.timeToQualify.fromNow, [6, 6]);
  assert.equal(facts.pathways[0].qualification?.tgaCode, "UEE30820");
  assert.ok(facts.pathways[0].skillsBuilt.includes("Electrical systems"));
  const withMedian = careerFacts(byOsca("381231"), skillsGraph, { ...earningsData, byOsca: { "3812": { medianWeekly: 1900 } } } as EarningsData, 12);
  assert.equal(withMedian.salary.medianAnnual, 99000);
});

test("ranges read naturally", () => {
  assert.equal(formatRange([75000, 85000]), "$75k–$85k");
  assert.equal(formatYears([3, 4]), "3–4 years");
  assert.equal(formatYears([0.5, 1]), "6 months to 1 year");
  assert.equal(formatYears([0, 1]), "up to 1 year");
});

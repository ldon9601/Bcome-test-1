import assert from "node:assert/strict";
import { test } from "node:test";
import { matchCareers } from "../src/lib/careers/matching.ts";
import { bandFor, computeOutlook } from "../src/lib/careers/outlook.ts";
import type { Occupation } from "../src/lib/careers/types.ts";
import { jsaOutlook, occupationData, questionBank, subjectLabels } from "../src/lib/data.ts";
import { buildProfile } from "../src/lib/questionnaire/scoring.ts";
import { validateData } from "../scripts/validate-data.ts";
import { PERSONAS, simulate } from "./fixtures/personas.ts";

const byId = (id: string) => occupationData.occupations.find((o) => o.id === id)!;

test("data files are internally consistent", () => {
  assert.deepEqual(validateData(), []);
});

test("bands follow JSA growth against the all-jobs average", () => {
  assert.equal(bandFor(25, 13.3), "strong");
  assert.equal(bandFor(14, 13.3), "good");
  assert.equal(bandFor(9, 13.3), "moderate");
  assert.equal(bandFor(2, 13.3), "limited");
  assert.equal(bandFor(-3, 13.3), "declining");
});

test("occupation-level JSA figures are used when present", () => {
  const o = computeOutlook(byId("physiotherapist"), jsaOutlook);
  assert.equal(o.basis, "jsa-occupation");
  assert.equal(o.growth10Pct, 33.6);
  assert.equal(o.band10, "strong");
});

test("major-group estimates are labelled and never claim 'strong'", () => {
  const o = computeOutlook(byId("registered-nurse"), jsaOutlook);
  assert.equal(o.basis, "jsa-major-group-adjusted");
  assert.equal(o.band10, "good");
  assert.match(o.summary, /Estimated/);
});

test("clerical work carries JSA's weak outlook", () => {
  const o = computeOutlook(byId("general-clerk-office-administrator"), jsaOutlook);
  assert.equal(o.basis, "jsa-major-group-qualitative");
  assert.equal(o.band10, "limited");
  assert.equal(o.band15, "declining"); // high AI exposure, no demand drivers
});

test("15-year view moves up for demand drivers and down for high AI exposure", () => {
  const base = byId("electrician");
  const withDrivers = computeOutlook(base, jsaOutlook);
  const noDrivers = computeOutlook({ ...base, drivers: [] } as Occupation, jsaOutlook);
  const highAi = computeOutlook({ ...base, drivers: [], aiExposure: "high" } as Occupation, jsaOutlook);
  assert.equal(noDrivers.band15, noDrivers.band10);
  assert.notEqual(withDrivers.band15, noDrivers.band15);
  assert.ok(highAi.score < noDrivers.score);
});

test("each persona's top five includes a career that fits them", () => {
  for (const p of PERSONAS) {
    if (!p.expectAnyOf.length) continue;
    const prof = buildProfile(questionBank, simulate(questionBank, p).answers);
    const top5 = matchCareers(prof, occupationData.occupations, jsaOutlook, { limit: 5, subjectLabels }).map((m) => m.occupation.id);
    assert.ok(p.expectAnyOf.some((id) => top5.includes(id)), `${p.key}: got ${top5.join(", ")}`);
  }
});

test("matches explain themselves and flag missing prerequisites", () => {
  const p = { ...PERSONAS.find((x) => x.key === "mia-health")!, subjectsStrong: ["biology"], yearLevel: 12 as const };
  const prof = buildProfile(questionBank, simulate(questionBank, p).answers);
  const gp = matchCareers(prof, [byId("general-practitioner-doctor")], jsaOutlook, { subjectLabels })[0];
  assert.ok(gp.reasons.length > 0);
  assert.ok(gp.cautions.some((c) => c.includes("Chemistry")));
});

test("an apprenticeship-minded student is matched to trades", () => {
  const p = PERSONAS.find((x) => x.key === "jack-electrical")!;
  const prof = buildProfile(questionBank, simulate(questionBank, p).answers);
  const top3 = matchCareers(prof, occupationData.occupations, jsaOutlook, { limit: 3 });
  assert.ok(top3.every((m) => m.occupation.pathways.apprenticeship));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { band, careerGenAi, type GenAiData } from "../src/lib/careers/genai.ts";
import { genAiData, occupationData } from "../src/lib/data.ts";

const tiny: GenAiData = {
  source: { title: "JSA", url: "https://x", file: "f.xlsx", released: "2025-09-03", note: "", retrieved: "2026-10-23" },
  bands: { automation: [0.26, 0.4], augmentation: [0.59, 0.69] },
  occupations: Object.fromEntries(
    [
      ["5311", 0.71, 0.68],
      ["5312", 0.5, 0.6],
      ["5321", 0.3, 0.7],
      ["8211", 0.1, 0.35],
    ].map(([code, auto, aug]) => [code, { title: String(code), group: null, automation: Number(auto), automationSd: null, augmentation: Number(aug), augmentationSd: null, skillChange: null, mobility: null, highFitTransitionPct: null, hybridisation: null, specialisation: null, entryLevelAdsPct: 30 }]),
  ),
  industries: {},
};

test("AI exposure bands split at JSA's score thirds, high to low", () => {
  assert.equal(band(0.71, [0.26, 0.4]), "high");
  assert.equal(band(0.4, [0.26, 0.4]), "high");
  assert.equal(band(0.3, [0.26, 0.4]), "medium");
  assert.equal(band(0.1, [0.26, 0.4]), "low");
  const clerk = careerGenAi("5311", tiny)!;
  assert.equal(clerk.exposure, "high");
  assert.equal(clerk.helper, "medium");
  assert.ok(clerk.automationPercentile > 80);
  assert.equal(careerGenAi("8211", tiny)!.exposure, "low");
});

test("a unit group JSA didn't publish uses its minor group's average", () => {
  const g = careerGenAi("5319", tiny)!;
  assert.ok(g.estimated);
  assert.equal(g.automation, 0.61);
  assert.equal(careerGenAi("9999", tiny), null);
});

test("every career carries JSA's AI exposure, replacing the old estimates", () => {
  assert.ok(Object.keys(genAiData.occupations).length >= 350);
  for (const o of occupationData.occupations) {
    assert.ok(o.genAi, `${o.title} has no Gen AI score`);
    assert.equal(o.aiExposure, o.genAi.exposure);
    assert.match(o.evidence.ai, /Gen AI/);
  }
  const by = (t: string) => occupationData.occupations.find((o) => o.title === t)!;
  assert.equal(by("Data Entry Operator").aiExposure, "high");
  assert.equal(by("Concreter").aiExposure, "low");
  const counts = { high: 0, medium: 0, low: 0 };
  for (const o of occupationData.occupations) counts[o.aiExposure]++;
  assert.ok(Object.values(counts).every((n) => n > 60), JSON.stringify(counts));
});

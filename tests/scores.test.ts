import assert from "node:assert/strict";
import { test } from "node:test";
import { careerFacts, formatRange, formatYears } from "../src/lib/careers/facts.ts";
import { matchCareers, scoreOccupation } from "../src/lib/careers/matching.ts";
import { earningsData, jsaOutlook, occupationData, questionBank, skillsGraph, subjectLabels } from "../src/lib/data.ts";
import { buildProfile } from "../src/lib/questionnaire/scoring.ts";
import type { EarningsData } from "../src/lib/careers/types.ts";
import { PERSONAS, simulate } from "./fixtures/personas.ts";

const byOsca = (code: string) => occupationData.occupations.find((o) => o.osca === code)!;
const profileOf = (key: string, overrides: Partial<(typeof PERSONAS)[number]> = {}) =>
  buildProfile(questionBank, simulate(questionBank, { ...PERSONAS.find((p) => p.key === key)!, ...overrides }).answers);

test("every match has three 0–100 scores and an overall score between them", () => {
  for (const p of PERSONAS) {
    for (const m of matchCareers(profileOf(p.key), occupationData.occupations, jsaOutlook, { graph: skillsGraph, limit: 63 })) {
      const s = [m.scores.personalFit.score, m.scores.futureOpportunity.score, m.scores.pathwayFeasibility.score];
      assert.ok(s.every((n) => Number.isInteger(n) && n >= 0 && n <= 100), `${m.occupation.osca}: ${s}`);
      assert.ok(m.score >= Math.min(...s) && m.score <= Math.max(...s));
    }
  }
});

test("personal fit follows interests, not the job market", () => {
  const mia = profileOf("mia-health");
  const nurse = scoreOccupation(mia, byOsca("2654"), jsaOutlook);
  const welder = scoreOccupation(mia, byOsca("331133"), jsaOutlook);
  assert.ok(nurse.scores.personalFit.score > welder.scores.personalFit.score + 30);
});

test("future opportunity is the same for every student", () => {
  const a = scoreOccupation(profileOf("mia-health"), byOsca("273333"), jsaOutlook);
  const b = scoreOccupation(profileOf("jack-electrical"), byOsca("273333"), jsaOutlook);
  assert.equal(a.scores.futureOpportunity.score, b.scores.futureOpportunity.score);
});

test("future opportunity rewards growth and penalises weak outlooks", () => {
  const mia = profileOf("mia-health");
  const physio = scoreOccupation(mia, byOsca("262431"), jsaOutlook);
  const clerk = scoreOccupation(mia, byOsca("561131"), jsaOutlook);
  assert.ok(physio.scores.futureOpportunity.score > clerk.scores.futureOpportunity.score + 30);
  assert.ok(clerk.scores.futureOpportunity.cautions.length > 0);
});

test("skill portability lifts future opportunity", () => {
  const mia = profileOf("mia-health");
  const withGraph = matchCareers(mia, occupationData.occupations, jsaOutlook, { graph: skillsGraph, limit: 63 }).find((m) => m.occupation.osca === "2654")!;
  assert.equal(withGraph.scores.futureOpportunity.parts.portability, 1);
});

test("pathway feasibility drops for missing prerequisites in Year 12, not Year 10", () => {
  const gp = byOsca("264231"); // often requires Chemistry
  const y10 = scoreOccupation(profileOf("mia-health", { subjectsStrong: ["biology"], subjectsEnjoyed: ["biology"], yearLevel: 10 }), gp, jsaOutlook, { subjectLabels });
  const y12 = scoreOccupation(profileOf("mia-health", { subjectsStrong: ["biology"], subjectsEnjoyed: ["biology"], yearLevel: 12 }), gp, jsaOutlook, { subjectLabels });
  assert.ok(y10.scores.pathwayFeasibility.score > y12.scores.pathwayFeasibility.score);
  assert.ok(y12.scores.pathwayFeasibility.cautions.some((c) => c.includes("Chemistry")));
});

test("pathway feasibility follows how the student wants to study", () => {
  const electrician = byOsca("381231");
  const jack = scoreOccupation(profileOf("jack-electrical"), electrician, jsaOutlook);
  const uniBound = scoreOccupation(profileOf("jack-electrical", { studyPreference: "university" }), electrician, jsaOutlook);
  assert.ok(jack.scores.pathwayFeasibility.score > uniBound.scores.pathwayFeasibility.score);
});

test("competitive, long pathways are flagged", () => {
  const gp = scoreOccupation(profileOf("priya-tech"), byOsca("264231"), jsaOutlook);
  const cautions = gp.scores.pathwayFeasibility.cautions.join(" ");
  assert.match(cautions, /competitive/);
  assert.match(cautions, /10–12 years/);
});

test("the skills graph links qualifications, skills and related careers", () => {
  const nurse = byOsca("2654");
  const built = skillsGraph.skillsFromQualification("he-nursing", nurse);
  assert.ok(built.includes("sk-clinical-assessment"));
  const related = skillsGraph.related(nurse).map((r) => r.occupation.osca);
  assert.ok(related.includes("264231") || related.includes("269432"));
  assert.ok(!related.includes("2654"));
});

test("career facts give salary, years from now and qualifications", () => {
  const facts = careerFacts(byOsca("381231"), skillsGraph, earningsData, 10);
  assert.deepEqual(facts.timeToQualify.years, [4, 4]);
  assert.deepEqual(facts.timeToQualify.fromNow, [6, 6]);
  assert.equal(facts.pathways[0].qualification?.tgaCode, "UEE30820");
  assert.ok(facts.pathways[0].skillsBuilt.includes("Electrical systems"));
  assert.equal(facts.salary.basis, "indicative");
});

test("imported JSA median earnings are used, falling back to the unit group", () => {
  const earnings: EarningsData = { ...earningsData, byOsca: { "3812": { medianWeekly: 1900 } } };
  const facts = careerFacts(byOsca("381231"), skillsGraph, earnings, 12);
  assert.equal(facts.salary.medianAnnual, 99000);
  assert.equal(facts.salary.basis, "indicative-with-jsa-median");
});

test("ranges read naturally", () => {
  assert.equal(formatRange([75000, 85000]), "$75k–$85k");
  assert.equal(formatYears([4, 4]), "4 years");
  assert.equal(formatYears([3, 4]), "3–4 years");
  assert.equal(formatYears([0.5, 1]), "6 months to 1 year");
  assert.equal(formatYears([0, 1]), "up to 1 year");
  assert.equal(formatYears([1.5, 2]), "1.5–2 years");
});

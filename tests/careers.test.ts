import assert from "node:assert/strict";
import { test } from "node:test";
import { bandFor, computeOutlook } from "../src/lib/careers/outlook.ts";
import type { Occupation } from "../src/lib/careers/types.ts";
import { jsaOutlook, occupationData, skillsGraph } from "../src/lib/data.ts";
import { validateData } from "../scripts/validate-data.ts";

const byOsca = (code: string) => occupationData.occupations.find((o) => o.osca === code)!;

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
  const o = computeOutlook(byOsca("262431"), jsaOutlook);
  assert.equal(o.basis, "jsa-occupation");
  assert.equal(o.growth10Pct, 35.1); // Physiotherapists, JSA Table 6
  assert.equal(o.band10, "strong");
});

// With the full JSA import every career has its own figure, so the fallbacks are tested with
// projections that leave the occupation out.
const withoutOccupation = (code: string, extra: Partial<typeof jsaOutlook> = {}) => ({ ...jsaOutlook, occupations: Object.fromEntries(Object.entries(jsaOutlook.occupations).filter(([k]) => k !== code)), ...extra });

test("major-group estimates are labelled and never claim 'strong'", () => {
  const nurse = byOsca("2654");
  const o = computeOutlook(nurse, withoutOccupation(nurse.anzsco));
  assert.equal(o.basis, "jsa-major-group-adjusted");
  assert.notEqual(o.band10, "strong");
  assert.match(o.summary, /Estimated/);
  assert.equal(computeOutlook(nurse, jsaOutlook).basis, "jsa-occupation");
});

test("a qualitative major-group outlook is used when that's all there is", () => {
  const clerk = byOsca("561131");
  const jsa = withoutOccupation(clerk.anzsco, { majorGroups: { ...jsaOutlook.majorGroups, "5": { name: "Clerical and Administrative Workers", growth5Pct: null, growth10Pct: null, qualitative: "weak or negative" } } });
  const o = computeOutlook(clerk, jsa);
  assert.equal(o.basis, "jsa-major-group-qualitative");
  assert.equal(o.band10, "limited");
  assert.equal(o.band15, "declining"); // high AI exposure, no demand drivers
});

test("every unit group in the JSA projections has a career, except three left out on purpose", () => {
  const covered = new Set(occupationData.occupations.map((o) => o.anzsco));
  const missing = Object.keys(jsaOutlook.occupations).filter((c) => !covered.has(c));
  assert.deepEqual(missing.sort(), ["1392", "4518", "8997"]);
});

test("15-year view moves up for demand drivers and down for high AI exposure", () => {
  const base = byOsca("381231");
  const withDrivers = computeOutlook(base, jsaOutlook);
  const noDrivers = computeOutlook({ ...base, drivers: [] } as Occupation, jsaOutlook);
  const highAi = computeOutlook({ ...base, drivers: [], aiExposure: "high" } as Occupation, jsaOutlook);
  assert.equal(noDrivers.band15, noDrivers.band10);
  assert.notEqual(withDrivers.band15, noDrivers.band15);
  assert.ok(highAi.score < noDrivers.score);
});

test("the skills graph links qualifications, skills and related careers", () => {
  const nurse = byOsca("2654");
  assert.ok(skillsGraph.skillsFromQualification("he-nursing", nurse).includes("sk-clinical-assessment"));
  const related = skillsGraph.related(nurse).map((r) => r.occupation.osca);
  assert.ok(related.includes("264231") || related.includes("269432"));
  assert.ok(!related.includes("2654"));
});

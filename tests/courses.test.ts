import assert from "node:assert/strict";
import { test } from "node:test";
import { careerCatalogue } from "../src/lib/careers/catalogue.ts";
import { courseOptions, subjectsSatisfying, unmet } from "../src/lib/careers/courses.ts";
import { courseOfferings, jsaOutlook, jsaProfiles, occupationData, qualificationData } from "../src/lib/data.ts";

const occ = (title: string) => {
  const o = occupationData.occupations.find((x) => x.title === title);
  assert.ok(o, title);
  return o;
};

test("every career maps to an ANZSCO unit group with a JSA occupation profile", () => {
  for (const o of occupationData.occupations) {
    assert.match(o.anzsco, /^\d{4}$/, o.title);
    const p = jsaProfiles.byUnitGroup[o.anzsco];
    assert.ok(p, `${o.title} has no JSA profile for ${o.anzsco}`);
    assert.equal(o.jsaProfile, p);
    assert.equal(o.anzscoTitle, p.title);
    if (o.anzscoOccupation) {
      assert.match(o.anzscoOccupation.code, /^\d{6}$/);
      assert.equal(o.anzscoOccupation.code.slice(0, 4), o.anzsco, `${o.title} occupation code is outside its unit group`);
    }
  }
});

test("corrected ANZSCO codes stay corrected", () => {
  assert.equal(occ("Aged Care Worker").anzsco, "4231");
  assert.equal(occ("Landscape Gardener").anzsco, "3622");
});

test("prerequisites are read as subject alternatives", () => {
  assert.deepEqual(subjectsSatisfying("Chemistry"), ["chemistry"]);
  assert.deepEqual(subjectsSatisfying("Mathematics Methods ATAR"), ["maths_advanced", "maths_extension"]);
  assert.deepEqual(subjectsSatisfying("Mathematics Specialist"), ["maths_extension"]);
  assert.deepEqual(subjectsSatisfying("One of Mathematics Applications, Methods or Specialist"), ["maths_general", "maths_advanced", "maths_extension"]);
  assert.deepEqual(new Set(subjectsSatisfying("One of Chemistry, Physics or Engineering Studies ATAR")), new Set(["chemistry", "physics", "engineering_studies"]));
  assert.ok(subjectsSatisfying("Physical Education Studies or one science ATAR course")?.includes("pdhpe"));
  assert.equal(subjectsSatisfying("Interview and portfolio"), null);
  // Unknown requirements are never flagged as missing.
  assert.deepEqual(unmet(["Interview and portfolio"], []), []);
  assert.deepEqual(unmet(["Chemistry", "Mathematics Methods"], ["chemistry", "maths_extension"]), []);
  assert.deepEqual(unmet(["Chemistry"], ["biology"]), ["Chemistry"]);
});

test("course options put the student's state first and flag missing prerequisites", () => {
  const r = courseOptions(occ("Electrical Engineer"), { state: "WA", currentSubjects: ["maths_general", "biology"], educationPaths: ["university"] }, courseOfferings);
  assert.equal(r.lead, "university");
  assert.ok(r.university.length > 0 && r.university.length <= 4);
  assert.equal(r.university[0].state, "WA");
  assert.equal(r.university[0].inState, true);
  assert.equal(new Set(r.university.map((u) => u.provider)).size, r.university.length, "one course per provider");
  assert.ok(r.university[0].missingPrerequisites.length >= 1, "no Methods or Physics flagged");
  assert.equal(r.note, null);
  const ok = courseOptions(occ("Electrical Engineer"), { state: "WA", currentSubjects: ["maths_advanced", "physics"], educationPaths: ["university"] }, courseOfferings);
  assert.deepEqual(ok.university[0].missingPrerequisites, []);
});

test("TAFE leads for students who chose TAFE or an apprenticeship, with a note when nothing is local", () => {
  const r = courseOptions(occ("Electrician"), { state: "QLD", currentSubjects: [], educationPaths: ["apprenticeship"] }, courseOfferings);
  assert.equal(r.lead, "tafe");
  assert.ok(r.tafe.length >= 1);
  assert.equal(r.tafe[0].provider, "TAFE NSW");
  assert.ok(r.tafe[0].requirements.length > 0);
  assert.match(r.note ?? "", /QLD/);
});

test("course offerings reference real qualifications in the right sector", () => {
  const byId = new Map(qualificationData.qualifications.map((q) => [q.id, q]));
  for (const u of courseOfferings.university) {
    assert.equal(byId.get(u.qualificationId)?.sector, "higher-ed", u.course);
    assert.ok(courseOfferings.sources[u.source], u.source);
    if (u.atar.value !== null) assert.ok(u.atar.value > 30 && u.atar.value <= 99.95);
  }
  for (const t of courseOfferings.tafe) assert.equal(byId.get(t.qualificationId)?.sector, "vet", t.course);
});

test("career catalogue summarises ATAR ranges and TAFE availability", () => {
  const cat = careerCatalogue(occupationData.occupations, jsaOutlook, courseOfferings);
  const pharm = cat.find((c) => c.title === "Pharmacist");
  assert.ok(pharm?.courses.universities && pharm.courses.atarRange);
  assert.ok(pharm.courses.atarRange[0] <= pharm.courses.atarRange[1]);
  assert.equal(cat.find((c) => c.title === "Electrician")?.courses.tafe, true);
});

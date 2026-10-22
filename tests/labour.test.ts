import assert from "node:assert/strict";
import { test } from "node:test";
import { advise, resultPayload } from "../src/lib/advise.ts";
import { FAMILY_LABELS } from "../src/lib/careers/families.ts";
import { CAREER_FAMILIES } from "../src/lib/careers/types.ts";
import { jsaOutlook, occupationData, questionBank } from "../src/lib/data.ts";
import { PERSONAS, simulate } from "../src/lib/demo/personas.ts";
import { industryData, labourHistory, labourSnapshot, SKILL_LEVELS, vacancyData } from "../src/lib/labour.ts";

const byTitle = (t: string) => occupationData.occupations.find((o) => o.title === t)!;

test("vacancy figures are the ones current when the assessment was done", () => {
  const nurse = byTitle("Registered Nurse");
  const now = labourSnapshot(nurse, "NSW", new Date("2026-10-23T00:00:00Z"), jsaOutlook);
  assert.equal(now.vacancies.tnv?.quarter, vacancyData.tnv.latest);
  assert.equal(now.vacancies.ivi?.month, vacancyData.ivi.latest);
  assert.equal(now.vacancies.ivi?.state, "NSW");
  assert.equal(now.vacancies.ivi?.skillLevel, 1);
  const then = labourSnapshot(nurse, "NSW", new Date("2025-03-15T00:00:00Z"), jsaOutlook);
  assert.equal(then.vacancies.tnv?.quarter, "2025-02");
  assert.equal(then.vacancies.ivi?.month, "2025-03");
  assert.notEqual(then.vacancies.ivi?.ads, now.vacancies.ivi?.ads);
});

test("a job's vacancy estimate is its share of the occupation group's vacancies", () => {
  const nurse = byTitle("Registered Nurse");
  const s = labourSnapshot(nurse, "VIC", new Date("2026-10-23T00:00:00Z"), jsaOutlook);
  const t = s.vacancies.tnv!;
  assert.equal(t.groupCode, "25");
  assert.equal(t.groupTitle, "Health Professionals");
  const share = jsaOutlook.occupations["2544"].employed2025k! / jsaOutlook.occupationGroups!["25"].employed2025k!;
  assert.ok(Math.abs(t.estimate! - t.group! * share) <= 100, `${t.estimate} vs ${t.group! * share}`);
  assert.ok(t.sharePct! > 20 && t.sharePct! < 50);
  assert.equal(s.anzsic?.code, "840");
  assert.equal(s.projection?.growth10Pct, jsaOutlook.occupations["2544"].growth10Pct);
  assert.equal(s.shortage?.majorGroup, "Professionals");
});

test("an unknown state falls back to the national figures", () => {
  const s = labourSnapshot(byTitle("Electrician"), "", new Date(), jsaOutlook);
  assert.equal(s.vacancies.ivi?.state, "AUST");
  assert.equal(s.vacancies.ivi?.skillLevel, 3);
});

test("history series line up with their periods", () => {
  const h = labourHistory(byTitle("Cook"), "QLD", jsaOutlook);
  assert.equal(h.tnv!.values.length, h.tnv!.periods.length);
  assert.equal(h.ivi!.values.length, h.ivi!.periods.length);
  assert.equal(h.ivi!.periods[0], "2016-01");
  assert.equal(h.industry!.values.length, industryData.years.length);
  assert.deepEqual(h.projection!.points.map((p) => p.year), ["2025", "2030", "2035"]);
  assert.ok(h.sources.length >= 4);
});

test("every career has a skill level, an ANZSIC group and a picture family", () => {
  for (const o of occupationData.occupations) {
    assert.ok(o.skillLevels.length && o.skillLevels.includes(o.skillLevel), o.title);
    assert.equal(industryData.industries[o.anzsic.code]?.level, 3, o.title);
    assert.ok(FAMILY_LABELS[o.family], o.title);
  }
  for (const f of CAREER_FAMILIES) assert.ok(FAMILY_LABELS[f], f);
  for (const l of [1, 2, 3, 4, 5]) assert.ok(SKILL_LEVELS[l].definition.length > 40);
});

test("careers generated from JSA unit groups are keyed by ANZSCO until OSCA is mapped", () => {
  const gen = occupationData.occupations.filter((o) => o.origin === "jsa-unit-group");
  assert.ok(gen.length > 280);
  for (const o of gen) {
    assert.equal(o.osca, `A${o.anzsco}`);
    assert.equal(o.oscaSource, "pending");
    assert.ok(o.summary.length > 20 && o.summary.length <= 120, o.title);
  }
  assert.equal(new Set(occupationData.occupations.map((o) => o.osca)).size, occupationData.occupations.length);
});

test("results carry a labour market snapshot for each career", async () => {
  const r = await advise(simulate(questionBank, PERSONAS[1]).answers);
  const at = new Date("2026-06-15T00:00:00Z");
  const payload = resultPayload(r, at);
  for (const m of payload.matches) {
    assert.equal(m.labour.asAt, at.toISOString());
    assert.equal(m.labour.vacancies.tnv?.quarter, "2026-05");
    assert.equal(m.labour.vacancies.ivi?.month, "2026-06");
  }
});

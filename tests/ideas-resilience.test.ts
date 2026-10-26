import assert from "node:assert/strict";
import { test } from "node:test";
import { advise, resultPayload } from "../src/lib/advise.ts";
import { matchCareers, scoreAll } from "../src/lib/careers/matching.ts";
import { resilience } from "../src/lib/careers/resilience.ts";
import { jsaOutlook, occupationData, questionBank, skillsGraph, subjectLabels } from "../src/lib/data.ts";
import { isVisible } from "../src/lib/questionnaire/engine.ts";
import { buildProfile } from "../src/lib/questionnaire/scoring.ts";
import { PERSONAS, simulate } from "./fixtures/personas.ts";

const persona = (key: string) => PERSONAS.find((p) => p.key === key)!;
const ideasQ = questionBank.questions.find((q) => q.id === "idea_source")!;

test("'where did the idea come from' is asked only when a student names a career", () => {
  assert.equal(isVisible(ideasQ, { career_ideas: ["none"] }), false);
  assert.equal(isVisible(ideasQ, {}), false);
  assert.equal(isVisible(ideasQ, { career_ideas: ["264231"] }), true);
  const none = buildProfile(questionBank, simulate(questionBank, persona("noah-leader")).answers);
  assert.deepEqual(none.ideas, { careers: [], sources: [] });
});

test("a student's own ideas are checked against their profile without changing their matches", async () => {
  const mia = persona("mia-health");
  const withIdeas = simulate(questionBank, mia).answers;
  const withoutIdeas = { ...withIdeas, career_ideas: ["none"] };
  delete (withoutIdeas as Record<string, unknown>).idea_source;
  const a = resultPayload(await advise(withIdeas));
  const b = resultPayload(await advise(withoutIdeas));
  assert.deepEqual(a.matches.map((m) => m.osca), b.matches.map((m) => m.osca), "ideas never reorder or replace recommendations");
  assert.deepEqual(a.ideas.careers.map((i) => i.title), ["General Practitioner (Doctor)", "Lawyer (Solicitor)"]);
  assert.equal(b.ideas.careers.length, 0);
  assert.match(a.ideas.note ?? "", /family/);
  for (const i of a.ideas.careers) {
    assert.ok(["strong", "good", "stretch"].includes(i.idea.verdict));
    assert.ok(i.idea.rank >= 1 && i.idea.rank <= i.idea.of);
    assert.ok(i.plan.whyItFits.length > 20, "ideas get the same written detail as matches");
    assert.ok(!/unsuitable|not suited|can't|cannot/i.test(`${i.idea.headline} ${i.plan.whyItFits}`), "never framed as unsuitable");
    for (const alt of i.idea.alternatives) assert.ok(alt.personalFit > i.scores.personalFit.score, "alternatives fit better");
  }
  const gp = a.ideas.careers[0];
  assert.equal(gp.idea.verdict, "strong");
});

test("a far-off idea is a stretch with its biggest gap named, never 'unsuitable'", async () => {
  const jack = { ...persona("jack-electrical"), ideas: ["281331"] }; // a hands-on student who's thinking about law
  const r = resultPayload(await advise(simulate(questionBank, jack).answers));
  const law = r.ideas.careers[0];
  assert.equal(law.idea.verdict, "stretch");
  assert.match(law.idea.headline, /can change/);
  assert.ok(law.idea.holdingBack, "says what holds it back");
});

test("plan B careers are close, fit the student, and come from a different occupation group", async () => {
  const r = resultPayload(await advise(simulate(questionBank, persona("jack-electrical")).answers));
  for (const m of r.matches) {
    assert.ok(m.resilience, `${m.title} has a resilience rating`);
    assert.ok(["High", "Medium", "Low"].includes(m.resilience.level));
    const anz = occupationData.occupations.find((o) => o.osca === m.osca)!.anzsco;
    const groups = new Set<string>();
    for (const n of m.resilience.neighbours) {
      const no = occupationData.occupations.find((o) => o.osca === n.osca)!;
      assert.notEqual(no.anzsco, anz, `${n.title} is a different occupation from ${m.title}`);
      assert.ok(!groups.has(no.anzsco), "no two plan B careers from the same group");
      groups.add(no.anzsco);
      assert.ok(n.similarity >= 45 && n.personalFit >= 45);
      assert.ok(!no.identified);
    }
    assert.ok(m.resilience.neighbours.length <= 3);
  }
  const electrician = r.matches.find((m) => m.title === "Electrician")!;
  assert.ok(electrician.resilience.neighbours.length > 0);
});

test("resilience splits careers into thirds and is the same for every student", () => {
  const levels: Record<string, Record<string, string>> = {};
  for (const key of ["mia-health", "jack-electrical"]) {
    const profile = buildProfile(questionBank, simulate(questionBank, persona(key)).answers);
    const scored = scoreAll(profile, occupationData.occupations, jsaOutlook, { subjectLabels, graph: skillsGraph });
    levels[key] = Object.fromEntries(scored.map((m) => [m.occupation.osca, resilience(m, scored, skillsGraph).level]));
  }
  assert.deepEqual(levels["mia-health"], levels["jack-electrical"]);
  const counts = { High: 0, Medium: 0, Low: 0 } as Record<string, number>;
  for (const l of Object.values(levels["mia-health"])) counts[l]++;
  for (const n of Object.values(counts)) assert.ok(n > 80 && n < 160, JSON.stringify(counts));
  // A sanity check against the data: a data entry job (high automation) is less resilient than a nurse.
  const by = (t: string) => occupationData.occupations.find((o) => o.title === t)!.osca;
  const order = { High: 2, Medium: 1, Low: 0 } as Record<string, number>;
  assert.ok(order[levels["mia-health"][by("Registered Nurse")]] > order[levels["mia-health"][by("Data Entry Operator")]]);
});

test("matching gives the same recommendations whether or not scores are passed in", () => {
  const profile = buildProfile(questionBank, simulate(questionBank, persona("priya-tech")).answers);
  const opts = { limit: 10, subjectLabels, graph: skillsGraph };
  const scored = scoreAll(profile, occupationData.occupations, jsaOutlook, opts);
  assert.deepEqual(
    matchCareers(profile, occupationData.occupations, jsaOutlook, { ...opts, scored }).map((m) => m.occupation.osca),
    matchCareers(profile, occupationData.occupations, jsaOutlook, opts).map((m) => m.occupation.osca),
  );
});

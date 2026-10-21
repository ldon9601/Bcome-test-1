import assert from "node:assert/strict";
import { test } from "node:test";
import { schoolAnalytics, studentsCsv } from "../src/lib/adviser/analytics.ts";
import { DASHBOARD_LABELS } from "../src/lib/adviser/labels.ts";
import { ConsoleMailer } from "../src/lib/auth/mailer.ts";
import { MemoryStore } from "../src/lib/auth/memory-store.ts";
import { AuthService } from "../src/lib/auth/service.ts";
import { seedDemoSchool } from "../src/lib/demo/seed.ts";

const NOW = new Date("2026-10-22T00:00:00Z");

async function demo() {
  const store = new MemoryStore();
  const service = new AuthService({ store, mailer: new ConsoleMailer(), secret: "s", appUrl: "http://x", schoolApproval: "auto", now: () => NOW, hashCost: { logN: 10, r: 8, p: 1 } });
  const { school } = await seedDemoSchool(service, { students: 20, now: NOW });
  return { store, service, school };
}

test("dashboard totals use each student's latest assessment once", async () => {
  const { store, school } = await demo();
  const users = await store.listUsers(school.id);
  const all = await store.listSchoolAssessments(school.id);
  const a = schoolAnalytics(users, all, DASHBOARD_LABELS, { now: NOW });
  const withAny = new Set(all.map((x) => x.userId)).size;
  assert.equal(a.totals.registered, 20, "advisers aren't counted as students");
  assert.equal(a.totals.completed, withAny);
  assert.equal(a.totals.assessments, all.length);
  assert.ok(a.totals.retaken > 0 && a.totals.assessments > a.totals.completed);
  assert.equal(a.totals.notStarted, 20 - withAny);
  assert.equal(a.byYear.reduce((s, y) => s + y.registered, 0), 20);
  assert.equal(a.riasecPrimary.reduce((s, c) => s + c.count, 0), a.totals.completed);
  // Top careers count students, not matches, and #1 counts are within that.
  for (const c of a.topCareers) assert.ok(c.first <= c.students && c.students <= a.totals.completed);
  assert.ok(a.topCareers.length > 3 && a.families.length > 1 && a.educationPaths.length > 1);
  const row = a.students.find((s) => s.assessments > 0)!;
  assert.equal(row.topCareers.length, 3);
  assert.ok(row.latestAssessmentId);
});

test("year filter narrows every figure", async () => {
  const { store, school } = await demo();
  const users = await store.listUsers(school.id);
  const a = schoolAnalytics(users, await store.listSchoolAssessments(school.id), DASHBOARD_LABELS, { year: 11, now: NOW });
  assert.ok(a.students.every((s) => s.yearLevel === 11));
  assert.deepEqual(a.byYear.map((y) => y.year), [11]);
});

test("students who may need a conversation are flagged, with reasons", async () => {
  const { store, school } = await demo();
  const a = schoolAnalytics(await store.listUsers(school.id), await store.listSchoolAssessments(school.id), DASHBOARD_LABELS, { now: NOW });
  assert.ok(a.followUp.length > 0);
  assert.ok(a.followUp.every((f) => f.reasons.length > 0));
  const known = /^(Interests not clear yet|Lots of .not sure. answers|Top career needs a subject change \(.+\)|Pathway to .+ looks hard right now|Unsure about study after school|Due for a six-month check-in)$/;
  for (const r of a.followUp.flatMap((f) => f.reasons)) assert.match(r, known);
});

test("another school's data never appears", async () => {
  const { store, service, school } = await demo();
  const other = await store.createSchool({ ...school, name: "Other School", joinCode: "OTHR-0001", studentDomains: ["other.vic.edu.au"] });
  const [u] = await store.listUsers(school.id, "student");
  await store.saveAssessment({ ...(await store.getAssessment((await store.listAssessments(u.id))[0]?.id ?? ""))!, schoolId: other.id, userId: "someone-else" });
  const a = schoolAnalytics(await store.listUsers(school.id), await store.listSchoolAssessments(school.id), DASHBOARD_LABELS, { now: NOW });
  assert.ok(a.students.every((s) => s.email.endsWith("demo.nsw.edu.au")));
  assert.equal((await store.listSchoolAssessments(other.id)).length, 1);
  void service;
});

test("CSV export quotes fields and defuses spreadsheet formulas", () => {
  const csv = studentsCsv([
    { id: "1", firstName: "=HYPERLINK(\"x\")", lastName: 'O"Brien', username: "u", email: "e", yearLevel: 11, assessments: 1, lastCompletedAt: "2026-10-01T00:00:00Z", latestAssessmentId: "a", hollandCode: "ICR", topCareers: [{ osca: "1", title: "Nurse", personalFit: 90 }], confidence: "High", flags: [] },
  ]);
  const [, line] = csv.split("\r\n");
  assert.ok(line.startsWith(`"'=HYPERLINK(""x"")","O""Brien"`));
  assert.ok(line.includes('"Nurse (90% fit)"'));
});

test("a student with flat interests and many 'not sure' answers is flagged for a conversation", async () => {
  const { advise, resultPayload } = await import("../src/lib/advise.ts");
  const { followUpReasons } = await import("../src/lib/adviser/analytics.ts");
  const { questionBank } = await import("../src/lib/data.ts");
  const { PERSONAS, simulate } = await import("./fixtures/personas.ts");
  const r = await advise(simulate(questionBank, PERSONAS.find((p) => p.key === "ava-flat")!).answers);
  const reasons = followUpReasons(r.profile, resultPayload(r).matches as never, NOW.toISOString(), NOW);
  assert.ok(reasons.some((x) => /Interests not clear|not sure/.test(x)), reasons.join(" | "));
});

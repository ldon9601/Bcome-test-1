import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { activityAction } from "../src/lib/activity/api.ts";
import { actionCards } from "../src/lib/activity/cards.ts";
import { buildCv, cvText } from "../src/lib/activity/cv.ts";
import { cvDocx } from "../src/lib/activity/docx.ts";
import { checkEvidence } from "../src/lib/activity/evidence.ts";
import { checkEvent } from "../src/lib/activity/events.ts";
import { localDate, missionForWeek, missionLibrary, mondayOf, pointsSummary, shiftWeek, weekOf } from "../src/lib/activity/missions.ts";
import { ActivityService } from "../src/lib/activity/service.ts";
import type { StudentContext } from "../src/lib/activity/student.ts";
import { ConsoleMailer } from "../src/lib/auth/mailer.ts";
import { MemoryStore } from "../src/lib/auth/memory-store.ts";
import { AuthService, type CurrentSession } from "../src/lib/auth/service.ts";
import { seedDemoSchool } from "../src/lib/demo/seed.ts";

const NOW = new Date("2026-10-22T01:00:00Z"); // Thursday 22 October, Sydney

async function demo() {
  const store = new MemoryStore();
  const service = new AuthService({ store, mailer: new ConsoleMailer(), secret: "s", appUrl: "http://x", schoolApproval: "auto", now: () => NOW, hashCost: { logN: 10, r: 8, p: 1 } });
  const seeded = await seedDemoSchool(service, { students: 12, now: NOW });
  const session = async (username: string): Promise<CurrentSession> => {
    const user = (await store.findUserByUsername(username))!;
    const school = (await store.getSchool(user.schoolId))!;
    return { user, school, session: { id: "s", userId: user.id, tokenHash: "h", remember: false, createdAt: "", lastSeenAt: "", expiresAt: "" } };
  };
  return { store, service, seeded, session, activity: new ActivityService(store, () => NOW) };
}

test("weeks are ISO weeks in the school's time zone", () => {
  assert.equal(weekOf("2026-10-22"), "2026-W43");
  assert.equal(mondayOf("2026-W43"), "2026-10-19");
  assert.equal(weekOf("2027-01-01"), "2026-W53");
  assert.equal(shiftWeek("2026-W53", 1), "2027-W01");
  assert.equal(shiftWeek("2027-W01", -2), "2026-W52");
  // 11pm Sunday in Perth is already Monday in Sydney.
  const t = new Date("2026-10-25T15:30:00Z");
  assert.equal(localDate(t, "WA"), "2026-10-25");
  assert.equal(localDate(t, "NSW"), "2026-10-26");
  assert.equal(weekOf(localDate(t, "NSW")), "2026-W44");
});

const ctx = (over: Partial<StudentContext> = {}): StudentContext => ({
  userId: "u1",
  firstName: "Mia",
  yearLevel: 11,
  state: "NSW",
  subjects: [],
  careers: [
    {
      osca: "254111",
      title: "Registered Nurse",
      family: "health",
      personalFit: 88,
      lead: "university",
      course: { qualificationId: "he-nursing", course: "Bachelor of Nursing", provider: "The University of Sydney", state: "NSW", atar: "84" },
      tafe: null,
      jsa: { url: "https://www.jobsandskills.gov.au/x", employed: 300000, medianWeeklyEarnings: 2000 },
      challenge: "Building your confidence in science would help.",
    },
    { osca: "241411", title: "Secondary School Teacher", family: "education", personalFit: 84, lead: "university", course: null, tafe: null, jsa: null, challenge: null },
  ],
  ...over,
});

test("missions are personalised, stable through the week and fit the student", () => {
  const a = missionForWeek(ctx(), "2026-W43", []);
  const b = missionForWeek(ctx(), "2026-W43", []);
  assert.ok(a && b);
  assert.deepEqual(a, b);
  assert.ok(a.career);
  assert.doesNotMatch(JSON.stringify(a), /\{\w+\}/, "every placeholder is filled");
  // Over a term, every mission fits: Year 12-only missions never appear for a Year 11 student.
  const seen = new Set<string>();
  const done: { week: string; missionId: string }[] = [];
  for (let w = 1; w <= 30; w++) {
    const week = `2026-W${String(w).padStart(2, "0")}`;
    const m = missionForWeek(ctx(), week, done)!;
    const t = missionLibrary.missions.find((x) => x.id === m.id)!;
    assert.ok(!t.years || t.years.includes(11), `${m.id} is for ${t.years}`);
    assert.ok(!done.slice(-6).some((d) => d.missionId === m.id), `${m.id} repeated within six weeks`);
    done.push({ week, missionId: m.id });
    seen.add(m.id);
  }
  assert.ok(seen.size >= 10, "missions vary");
  assert.equal(missionForWeek(ctx({ careers: [] }), "2026-W43", []), null);
});

test("streaks add bonus points", () => {
  const done = [
    { week: "2026-W41", missionId: "x", points: 50 },
    { week: "2026-W42", missionId: "y", points: 85 },
  ];
  const m = missionForWeek(ctx(), "2026-W43", done)!;
  assert.equal(m.streakBonus, 20);
  assert.equal(m.points, m.basePoints + 20);
  const s = pointsSummary("2026-W43", done);
  assert.equal(s.total, 135);
  assert.equal(s.thisWeek, 0);
  assert.equal(s.streak, 2);
  assert.equal(s.history.length, 8);
  assert.equal(s.history.at(-1)!.week, "2026-W43");
});

test("portfolio entries are checked, and contact details are kept out", () => {
  const ok = checkEvidence({ category: "work", title: "Café attendant", startMonth: "2026-03", description: "Served customers on weekends.", skills: ["Teamwork"] }, NOW);
  assert.ok(ok.ok);
  const phone = checkEvidence({ category: "work", title: "Café attendant", startMonth: "2026-03", description: "Call my boss on 0412 345 678 for a reference." }, NOW);
  assert.ok(!phone.ok && /phone/.test(phone.error));
  const future = checkEvidence({ category: "sport", title: "Netball", startMonth: "2027-03", description: "Played netball every week." }, NOW);
  assert.ok(!future.ok && future.field === "startMonth");
  const backwards = checkEvidence({ category: "sport", title: "Netball", startMonth: "2026-03", endMonth: "2026-01", description: "Played netball every week." }, NOW);
  assert.ok(!backwards.ok && backwards.field === "endMonth");
  assert.ok(!checkEvidence({ category: "party", title: "x", startMonth: "2026-03", description: "aaaaaaaaaaaa" }, NOW).ok);
});

test("events are checked", () => {
  const ok = checkEvent({ kind: "open_day", title: "UNSW Open Day", startsOn: "2026-11-10", yearLevels: [11, 12], families: ["health"], url: "https://example.edu.au" }, "2026-10-22");
  assert.ok(ok.ok);
  assert.ok(!checkEvent({ kind: "open_day", title: "Open day", startsOn: "2026-02-30" }, "2026-10-22").ok);
  assert.ok(!checkEvent({ kind: "open_day", title: "Open day", startsOn: "2026-11-10", url: "javascript:alert(1)" }, "2026-10-22").ok);
  assert.ok(!checkEvent({ kind: "open_day", title: "Open day", startsOn: "2026-11-10", endsOn: "2026-11-01" }, "2026-10-22").ok);
  assert.ok(!checkEvent({ kind: "open_day", title: "Open day", startsOn: "2026-11-10", families: ["wizardry"] }, "2026-10-22").ok);
});

test("the demo student's hub has a mission, points, cards, events and a portfolio", async () => {
  const { activity, session } = await demo();
  const cur = await session("demo.student");
  const hub = await activity.hub(cur);
  assert.equal(hub.week, "2026-W43");
  assert.ok(hub.hasResults);
  assert.ok(hub.mission);
  assert.equal(hub.completed, null);
  assert.equal(hub.points.streak, 3);
  assert.equal(hub.mission.streakBonus, 30);
  assert.equal(hub.evidence.length, 3);
  assert.ok(hub.events.length >= 4);
  assert.ok(hub.events.every((e) => e.forYear), "only events for Year 11");
  assert.ok(hub.cards.some((c) => c.kind === "talk"));
  assert.ok(hub.cards.some((c) => c.kind === "attend" && c.date));
  assert.ok(hub.skillOptions.career.length > 0);
});

test("completing a mission: once a week, only this week's mission, with an optional portfolio entry", async () => {
  const { activity, session } = await demo();
  const cur = await session("demo.student");
  const hub = await activity.hub(cur);
  const wrong = await activity.completeMission(cur, { missionId: "not-this-one", reflection: "I did a thing this week.", addToPortfolio: false });
  assert.ok(!wrong.ok && wrong.status === 409);
  const short = await activity.completeMission(cur, { missionId: hub.mission!.id, reflection: "done", addToPortfolio: false });
  assert.ok(!short.ok && short.field === "reflection");
  const r = await activity.completeMission(cur, { missionId: hub.mission!.id, reflection: "Talked to my adviser about nursing subjects.", addToPortfolio: true });
  assert.ok(r.ok);
  assert.equal(r.completion.points, hub.mission!.points);
  assert.equal(r.points.thisWeek, hub.mission!.points);
  assert.equal(r.points.streak, 4);
  assert.ok(r.evidence);
  const again = await activity.completeMission(cur, { missionId: hub.mission!.id, reflection: "Trying to get double points.", addToPortfolio: false });
  assert.ok(!again.ok && again.status === 409);
  const after = await activity.hub(cur);
  assert.ok(after.completed);
  assert.equal(after.evidence.length, 4);
});

test("advisers manage their own school's calendar; students can't", async () => {
  const { activity, session, service, store } = await demo();
  const adviser = await session("demo.adviser");
  const student = await session("demo.student");
  const body = { kind: "competition", title: "Robotics challenge", startsOn: "2026-11-05", yearLevels: [11], families: ["engineering"] };
  const denied = await activity.createEvent(student, body);
  assert.ok(!denied.ok && denied.status === 403);
  const made = await activity.createEvent(adviser, body);
  assert.ok(made.ok);
  const hub = await activity.hub(student);
  assert.ok(hub.events.some((e) => e.id === made.event.id));
  assert.ok((await activity.setInterest(student, made.event.id, true)).ok);
  const list = await activity.schoolEvents(adviser);
  assert.equal(list.events.find((e) => e.id === made.event.id)?.interested, 1);
  assert.ok(store.auditLog.some((e) => e.event === "event.created" && e.targetId === made.event.id));

  // Another school's adviser can't see or change it.
  const other = await seedDemoSchool(service, {
    students: 1,
    now: NOW,
    school: { name: "Other High", state: "VIC", joinCode: "OTHR-2026", studentDomains: ["other.vic.edu.au"] },
    adviser: { username: "other.adviser", email: "a@other.vic.edu.au", firstName: "A", lastName: "B" },
    student: { username: "other.student", email: "s@other.vic.edu.au", firstName: "C", lastName: "D" },
  });
  assert.ok(other.school.id);
  const otherAdviser = await session("other.adviser");
  assert.ok(!(await activity.deleteEvent(otherAdviser, made.event.id)).ok);
  assert.ok(!(await activity.setInterest(await session("other.student"), made.event.id, true)).ok);
  assert.ok(!(await activity.schoolEvents(otherAdviser)).events.some((e) => e.id === made.event.id));
});

test("the activity API needs a session", async () => {
  const { service } = await demo();
  const r = await activityAction("evidence-add", {}, { service, cookies: {}, meta: { ip: null, userAgent: null } });
  assert.equal(r.status, 401);
});

test("deleting a student removes their activity", async () => {
  const { store, session } = await demo();
  const cur = await session("demo.student");
  assert.ok((await store.listEvidence(cur.user.id)).length);
  await store.deleteUser(cur.user.id);
  assert.equal((await store.listEvidence(cur.user.id)).length, 0);
  assert.equal((await store.listMissionCompletions(cur.user.id)).length, 0);
});

test("action cards skip past events and keep done/dismissed state", () => {
  const ev = { id: "e1", schoolId: "s", createdBy: null, kind: "open_day" as const, title: "Open day", startsOn: "2026-10-30", endsOn: null, time: null, location: null, url: null, description: "", yearLevels: [], families: ["health"], createdAt: "", updatedAt: "" };
  const past = { ...ev, id: "e0", startsOn: "2026-10-02" };
  const cards = actionCards(ctx(), "2026-10", [ev, past], [{ userId: "u1", schoolId: "s", cardKey: "2026-10:talk:254111", status: "done", updatedAt: "" }], "2026-10-22");
  assert.ok(cards.some((c) => c.eventId === "e1" && c.career === "Registered Nurse"));
  assert.ok(!cards.some((c) => c.eventId === "e0"));
  assert.equal(cards.find((c) => c.kind === "talk")?.status, "done");
});

test("the CV is built from the portfolio and downloads as a valid Word file", () => {
  const cv = buildCv({
    firstName: "Mia",
    lastName: "Nguyen",
    yearLevel: 11,
    school: "Demo Secondary College",
    subjects: ["Biology", "English"],
    careers: ["Registered Nurse", "Paramedic"],
    evidence: [
      { id: "1", userId: "u", schoolId: "s", category: "work", title: "Café attendant", organisation: "Local café", startMonth: "2025-06", endMonth: null, description: "Served customers & trained new staff <fast>.", skills: ["Customer service", "Teamwork"], createdAt: "", updatedAt: "" },
      { id: "2", userId: "u", schoolId: "s", category: "sport", title: "Netball captain", organisation: null, startMonth: "2026-02", endMonth: "2026-09", description: "Led the team to the semis.", skills: ["Leadership", "Teamwork"], createdAt: "", updatedAt: "" },
    ],
  });
  assert.equal(cv.sections[0].heading, "Work experience");
  assert.equal(cv.skills[0], "Teamwork");
  assert.match(cv.objective, /career as a registered nurse or a paramedic/);
  const text = cvText(cv, { email: "mia@example.com", phone: "", location: "Parramatta NSW" });
  assert.match(text, /Jun 2025 – present/);
  assert.match(text, /mia@example.com \| Parramatta NSW/);
  const bytes = cvDocx(cv, { email: "mia@example.com", phone: "0400 000 000", location: "" });
  assert.equal(bytes[0], 0x50); // "PK"
  const dir = mkdtempSync(join(tmpdir(), "cv-"));
  writeFileSync(join(dir, "cv.docx"), bytes);
  const listing = execFileSync("unzip", ["-t", join(dir, "cv.docx")]).toString();
  assert.match(listing, /No errors detected/);
  const xml = execFileSync("unzip", ["-p", join(dir, "cv.docx"), "word/document.xml"]).toString();
  assert.match(xml, /Served customers &amp; trained new staff &lt;fast&gt;\./);
});

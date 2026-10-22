import assert from "node:assert/strict";
import { test } from "node:test";
import { adminAction } from "../src/lib/admin/api.ts";
import { auditCsv, ipStats, platformAnalytics, securityStats, trafficStats, usersCsv, subjectsByStudent } from "../src/lib/admin/analytics.ts";
import { COOKIE, type ApiContext } from "../src/lib/auth/api.ts";
import type { Email, Mailer } from "../src/lib/auth/mailer.ts";
import { MemoryStore } from "../src/lib/auth/memory-store.ts";
import { POLICY, sessionLimits } from "../src/lib/auth/policy.ts";
import { AuthService, type CurrentSession, type RequestMeta } from "../src/lib/auth/service.ts";
import type { AssessmentForAnalytics, User } from "../src/lib/auth/store.ts";

const FAST = { logN: 10, r: 8, p: 1 };
const PW = "Purple 7 kangaroos jump!";
const meta: RequestMeta = { ip: "203.0.113.9", userAgent: "Mozilla/5.0 Chrome/130.0 Safari/537.36" };

class CaptureMailer implements Mailer {
  sent: Email[] = [];
  async send(e: Email) {
    this.sent.push(e);
  }
  lastCode() {
    return [...this.sent].reverse()[0]?.text.match(/\b(\d{6})\b/)?.[1] ?? "";
  }
  lastLinkToken() {
    return [...this.sent].reverse().find((e) => e.text.includes("/set-password/"))?.text.match(/\/set-password\/([\w-]+)/)?.[1] ?? "";
  }
}

function setup() {
  const store = new MemoryStore();
  const mailer = new CaptureMailer();
  let t = new Date("2026-10-23T00:00:00Z").getTime();
  const clock = { advance: (ms: number) => (t += ms) };
  const service = new AuthService({ store, mailer, secret: "test-secret", appUrl: "https://bcome.test", schoolApproval: "manual", now: () => new Date(t), hashCost: FAST });
  return { store, mailer, service, clock };
}

/** Creates an administrator and signs in with the emailed code. */
async function signedInAdmin(env: ReturnType<typeof setup>) {
  const created = await env.service.createPlatformAdmin({ firstName: "Luke", lastName: "Admin", email: "luke@bcome.example", username: "luke.admin", password: PW, emailVerified: true });
  assert.ok(created.ok, JSON.stringify(created));
  const s = await env.service.signIn({ identifier: "luke.admin", password: PW, role: "admin", remember: true }, meta);
  assert.ok(s.ok && s.kind === "challenge", "administrators always need an email code");
  assert.equal(s.purpose, "login");
  const v = await env.service.verifyCode({ challengeToken: s.challengeToken, code: env.mailer.lastCode(), trustDevice: true }, meta);
  assert.ok(v.ok && v.kind === "session");
  assert.equal(v.persistent, false, "admin sessions never persist");
  const cur = await env.service.getSession(v.sessionToken);
  assert.ok(cur.ok);
  return { cur: cur as CurrentSession & { ok: true }, token: v.sessionToken };
}

const ctx = (env: ReturnType<typeof setup>, token: string): ApiContext => ({ service: env.service, cookies: { [COOKIE.session]: token }, meta });

test("admin sessions are short and need a code on every sign-in, even from a trusted device", async () => {
  const env = setup();
  await signedInAdmin(env);
  const limits = sessionLimits("admin", true);
  assert.equal(limits.persistent, false);
  assert.equal(limits.absoluteMs, POLICY.session.admin.absoluteMs);
  assert.ok(POLICY.session.admin.idleMs <= 15 * 60e3);
  const again = await env.service.signIn({ identifier: "luke.admin", password: PW, role: "admin", remember: true }, { ...meta, deviceToken: "whatever" });
  assert.ok(again.ok && again.kind === "challenge");
  const wrongPortal = await env.service.signIn({ identifier: "luke.admin", password: PW, role: "adviser", remember: false }, meta);
  assert.ok(!wrongPortal.ok && /administrator sign-in/.test(wrongPortal.error));
});

test("only administrators can use the admin API", async () => {
  const env = setup();
  const { token, cur } = await signedInAdmin(env);
  const school = await adminAction("create-school", { name: "Harbour High School", state: "NSW", studentDomains: "students.harbour.nsw.edu.au" }, ctx(env, token));
  assert.equal(school.status, 200, JSON.stringify(school.body));
  // An adviser at that school can't call it.
  const schoolId = String(school.body.schoolId);
  const made = await adminAction("create-user", { schoolId, role: "adviser", firstName: "Sam", lastName: "Lee", email: "sam.lee@harbour.nsw.edu.au", username: "sam.lee" }, ctx(env, token));
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const linkToken = env.mailer.lastLinkToken();
  assert.ok(linkToken);
  assert.ok((await env.service.setPasswordWithLink({ token: linkToken, password: PW }, meta)).ok);
  const s = await env.service.signIn({ identifier: "sam.lee", password: PW, role: "adviser", remember: false }, meta);
  assert.ok(s.ok && s.kind === "challenge");
  const v = await env.service.verifyCode({ challengeToken: s.challengeToken, code: env.mailer.lastCode(), trustDevice: false }, meta);
  assert.ok(v.ok && v.kind === "session");
  const denied = await adminAction("create-school", { name: "Another School", state: "VIC", studentDomains: "students.other.vic.edu.au" }, ctx(env, v.sessionToken));
  assert.equal(denied.status, 403);
  const anon = await adminAction("purge", {}, { service: env.service, cookies: {}, meta });
  assert.equal(anon.status, 401);
  // The service checks too, not only the API.
  const advSession = await env.service.getSession(v.sessionToken);
  assert.ok(advSession.ok);
  assert.equal((await env.service.adminPurge(advSession, meta)).ok, false);
  assert.ok((await env.service.adminPurge(cur, meta)).ok);
  assert.ok((await env.store.listAllAudit({ limit: 50, event: "admin." })).some((e) => e.event === "admin.school_created" && e.ip === meta.ip));
});

test("admin-created accounts get a one-time set-password link that confirms their email", async () => {
  const env = setup();
  const { cur } = await signedInAdmin(env);
  const school = await env.service.adminCreateSchool(cur, { name: "Ridge High", state: "QLD", studentDomains: ["students.ridge.qld.edu.au"] }, meta);
  assert.ok(school.ok);
  assert.equal(school.school.status, "active");
  const bad = await env.service.adminCreateUser(cur, { schoolId: school.school.id, role: "student", firstName: "Kai", lastName: "Tran", email: "kai@gmail.com", username: "kai.tran", yearLevel: 10, birthYear: 2011, birthMonth: 4 }, meta);
  assert.ok(!bad.ok && bad.field === "email", "students need a school-domain email");
  const r = await env.service.adminCreateUser(cur, { schoolId: school.school.id, role: "student", firstName: "Kai", lastName: "Tran", email: "kai@students.ridge.qld.edu.au", username: "kai.tran", yearLevel: 10, birthYear: 2011, birthMonth: 4 }, meta);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.user.emailVerifiedAt, null);
  const mail = env.mailer.sent.at(-1)!;
  assert.equal(mail.to, "kai@students.ridge.qld.edu.au");
  assert.ok(!mail.text.includes(PW));
  const token = env.mailer.lastLinkToken();
  assert.deepEqual(await env.service.describePasswordLink(token), { username: "kai.tran", emailHint: (await env.service.describePasswordLink(token))!.emailHint });
  assert.ok(!(await env.service.setPasswordWithLink({ token, password: "short" }, meta)).ok);
  const set = await env.service.setPasswordWithLink({ token, password: PW }, meta);
  assert.ok(set.ok && set.role === "student");
  assert.ok((await env.store.getUser(r.user.id))!.emailVerifiedAt, "the link confirms the email address");
  const reuse = await env.service.setPasswordWithLink({ token, password: "Another 9 long passphrase!" }, meta);
  assert.ok(!reuse.ok, "links work once");
  // Links expire after three days.
  await env.service.adminUserAction(cur, r.user.id, "password-link", meta);
  const late = env.mailer.lastLinkToken();
  env.clock.advance(POLICY.passwordLink.ttlMs + 1000);
  assert.equal(await env.service.describePasswordLink(late), null);
  assert.ok(!(await env.service.setPasswordWithLink({ token: late, password: PW }, meta)).ok);
});

test("a password-reset token can't be used as a set-password link", async () => {
  const env = setup();
  const { cur } = await signedInAdmin(env);
  const school = await env.service.adminCreateSchool(cur, { name: "Ridge High", state: "QLD", studentDomains: ["students.ridge.qld.edu.au"] }, meta);
  assert.ok(school.ok);
  await env.service.adminCreateUser(cur, { schoolId: school.school.id, role: "student", firstName: "Kai", lastName: "Tran", email: "kai@students.ridge.qld.edu.au", username: "kai.tran", yearLevel: 10, birthYear: 2011, birthMonth: 4 }, meta);
  const reset = await env.service.requestPasswordReset({ identifier: "kai.tran" }, meta);
  assert.ok(reset.ok);
  const misuse = await env.service.setPasswordWithLink({ token: reset.challengeToken, password: PW }, meta);
  assert.ok(!misuse.ok, "a reset still needs the emailed code");
  const resend = await env.service.resendCode(env.mailer.lastLinkToken());
  assert.ok(!resend.ok, "set-password links aren't codes");
});

test("students can't join the platform record, and admins can't delete themselves or the last admin", async () => {
  const env = setup();
  const { cur } = await signedInAdmin(env);
  const platform = await env.service.platformSchool();
  const join = await env.service.registerStudent(
    { joinCode: platform.joinCode, firstName: "Mia", lastName: "Chen", email: "mia@platform.bcome.invalid", username: "miachen", password: PW, yearLevel: 11, birthYear: 2010, birthMonth: 3, acceptedNotice: true },
    meta,
  );
  assert.ok(!join.ok);
  assert.equal((await env.service.adminUserAction(cur, cur.user.id, "delete", meta)).ok, false);
  assert.equal((await env.service.adminSchoolAction(cur, platform.id, "suspend", meta)).ok, false, "the platform record isn't a school");
});

test("school actions: suspend blocks sign-in, the join code changes and is emailed to advisers", async () => {
  const env = setup();
  const { cur } = await signedInAdmin(env);
  const school = await env.service.adminCreateSchool(cur, { name: "Ridge High", state: "QLD", studentDomains: ["students.ridge.qld.edu.au"] }, meta);
  assert.ok(school.ok);
  const none = await env.service.adminSchoolAction(cur, school.school.id, "email-code", meta);
  assert.ok(!none.ok, "no advisers yet");
  assert.ok((await env.service.adminInviteAdviser(cur, school.school.id, "sam@ridge.qld.edu.au", meta)).ok);
  assert.match(env.mailer.sent.at(-1)!.text, /\/invite\//);
  await env.service.adminCreateUser(cur, { schoolId: school.school.id, role: "adviser", firstName: "Jo", lastName: "Park", email: "jo@ridge.qld.edu.au", username: "jo.park" }, meta);
  const code = await env.service.adminSchoolAction(cur, school.school.id, "join-code", meta);
  assert.ok(code.ok && code.joinCode && code.joinCode !== school.school.joinCode);
  const sent = await env.service.adminSchoolAction(cur, school.school.id, "email-code", meta);
  assert.ok(sent.ok && sent.sent === 1);
  assert.ok(env.mailer.sent.at(-1)!.text.includes(code.joinCode!));
  await env.service.adminSchoolAction(cur, school.school.id, "suspend", meta);
  assert.equal((await env.store.getSchool(school.school.id))!.status, "suspended");
});

test("test email and request logging with purge", async () => {
  const env = setup();
  const { cur } = await signedInAdmin(env);
  assert.ok((await env.service.adminSendTestEmail(cur, "", meta)).ok);
  assert.equal(env.mailer.sent.at(-1)!.to, "luke@bcome.example");
  const now = env.service.now();
  await env.store.logRequest({ at: new Date(now.getTime() - 31 * 864e5).toISOString(), method: "GET", path: "/old", status: 200, ms: 5, ip: "198.51.100.1", userAgent: null });
  await env.store.logRequest({ at: now.toISOString(), method: "GET", path: "/new", status: 200, ms: 5, ip: "198.51.100.1", userAgent: null });
  await env.store.purgeExpired(now);
  const left = await env.store.listRequests(new Date(0).toISOString(), 100);
  assert.deepEqual(left.map((r) => r.path), ["/new"]);
});

// ---------------------------------------------------------------------------
// Analytics and monitoring
// ---------------------------------------------------------------------------

const user = (id: string, o: Partial<User>): User => ({
  id,
  schoolId: "s1",
  role: "student",
  username: id,
  email: `${id}@x.edu.au`,
  firstName: id,
  lastName: "Test",
  yearLevel: 10,
  birthYear: 2010,
  birthMonth: 1,
  passwordHash: "",
  emailVerifiedAt: null,
  failedLogins: 0,
  lockedUntil: null,
  createdAt: "2026-01-01T00:00:00Z",
  lastLoginAt: null,
  ...o,
});
const assessment = (userId: string, at: string, paths: string[], subjects: string[], o: Partial<AssessmentForAnalytics> = {}): AssessmentForAnalytics => ({
  id: `${userId}-${at}`,
  userId,
  schoolId: "s1",
  completedAt: at,
  instrumentVersion: "2",
  algorithmVersion: "2.2.0",
  yearLevel: 10,
  hollandCode: "SAI",
  topOsca: "x",
  topTitle: "Nurse",
  profile: { educationPaths: paths, currentSubjects: subjects },
  matches: [{ family: "health" }],
  ...o,
});

test("platform analytics: users by year and pathway segment, schools, results and subjects", () => {
  const schools = [
    { id: "s1", kind: "school" as const, name: "A", state: "NSW" as const, studentDomains: ["x"], joinCode: "AAAA-AAAA", status: "active" as const, allowAiPlans: false, createdAt: "", approvedAt: null },
    { id: "s2", kind: "school" as const, name: "B", state: "VIC" as const, studentDomains: ["y"], joinCode: "BBBB-BBBB", status: "pending" as const, allowAiPlans: false, createdAt: "", approvedAt: null },
    { id: "p", kind: "platform" as const, name: "Platform", state: "NSW" as const, studentDomains: ["z"], joinCode: "PPPP-PPPP", status: "active" as const, allowAiPlans: false, createdAt: "", approvedAt: null },
  ];
  const users = [
    user("a", { yearLevel: 10 }),
    user("b", { yearLevel: 11 }),
    user("c", { yearLevel: 12 }),
    user("d", { yearLevel: 12, schoolId: "s2" }),
    user("e", { yearLevel: 11 }),
    user("adv", { role: "adviser", yearLevel: null }),
    user("adm", { role: "admin", yearLevel: null, schoolId: "p" }),
  ];
  const assessments = [
    assessment("a", "2026-03-01T00:00:00Z", ["vet"], ["english", "maths_general"]),
    assessment("a", "2026-10-01T00:00:00Z", ["university", "vet"], ["english", "biology"]), // latest wins
    assessment("b", "2026-10-10T00:00:00Z", ["apprenticeship"], ["english"]),
    assessment("c", "2026-10-12T00:00:00Z", ["gap_year", "work_learn"], [], { hollandCode: "RIC", topTitle: "Electrician" }),
    assessment("d", "2026-10-15T00:00:00Z", ["unsure"], ["english"], { schoolId: "s2" }),
  ];
  const a = platformAnalytics({ users, schools, assessments, subjectLabels: { english: "English", biology: "Biology" }, now: new Date("2026-10-23T00:00:00Z") });
  assert.equal(a.totals.students, 5);
  assert.equal(a.totals.schools, 2, "the platform record isn't counted");
  assert.equal(a.totals.advisers, 1);
  assert.equal(a.totals.admins, 1);
  assert.equal(a.totals.assessments, 5);
  assert.equal(a.totals.studentsAssessed, 4);
  assert.deepEqual(a.segments.byYear.map((y) => y.count), [1, 2, 2]);
  const ex = Object.fromEntries(a.segments.exclusive.map((s) => [s.key, s.count]));
  assert.deepEqual(ex, { university: 1, tafe: 1, other: 1, unsure: 1 });
  assert.equal(a.segments.exclusive.reduce((t, s) => t + s.count, 0), a.totals.studentsAssessed, "exclusive segments add up");
  assert.equal(a.segments.notAssessed, 1);
  assert.equal(a.segments.pathways.find((p) => p.key === "tafe")!.count, 2, "non-exclusive counts every pathway considered");
  assert.deepEqual(a.subjects.slice(0, 2).map((s) => [s.label, s.count]), [["English", 3], ["Biology", 1]]);
  assert.equal(a.assessments.topCareers[0].label, "Nurse");
  assert.equal(a.assessments.hollandPrimary.find((h) => h.key === "R")!.label, "Realistic");
  assert.equal(a.assessments.byMonth.at(-1)!.count, 4);
  assert.equal(a.schools.rows.find((s) => s.id === "s1")!.completed, 3);
  const latest = subjectsByStudent(assessments, { english: "English", biology: "Biology" });
  assert.deepEqual(latest.get("a")!.subjects, ["English", "Biology"]);
  const csv = usersCsv(users, new Map([["s1", "A"]]), latest);
  assert.match(csv.split("\n")[1], /"English; Biology"/);
});

test("monitoring: traffic, IP addresses and security events", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const at = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60e3).toISOString();
  const requests = [
    { at: at(5), method: "POST", path: "/api/auth/sign-in", status: 200, ms: 40, ip: "203.0.113.1", userAgent: "Chrome" },
    { at: at(6), method: "GET", path: "/api/careers/A2544/labour", status: 200, ms: 80, ip: "203.0.113.1", userAgent: "Chrome" },
    { at: at(7), method: "GET", path: "/api/careers/261313/labour", status: 500, ms: 900, ip: "198.51.100.9", userAgent: "curl/8" },
    { at: at(60 * 30), method: "GET", path: "/old", status: 200, ms: 1, ip: "192.0.2.1", userAgent: null },
  ];
  const audit = [
    ...Array.from({ length: 6 }, (_, i) => ({ at: at(10 + i), event: "login.failed", actorId: null, schoolId: null, targetId: null, ip: "198.51.100.9", detail: {} })),
    { at: at(4), event: "login.success", actorId: "u", schoolId: "s1", targetId: null, ip: "203.0.113.1", detail: {} },
    { at: at(3), event: "admin.purge_run", actorId: "adm", schoolId: null, targetId: null, ip: "203.0.113.1", detail: {} },
  ];
  const t = trafficStats(requests, now);
  assert.equal(t.total, 3, "only the last 24 hours");
  assert.equal(t.serverErrors, 1);
  assert.equal(t.hours.length, 24);
  assert.equal(t.routes.find((r) => r.route === "GET /api/careers/:osca/labour")!.count, 2, "career routes are grouped");
  const ips = ipStats(requests, audit, now);
  assert.equal(ips[0].ip, "198.51.100.9", "addresses with many failures come first");
  assert.ok(ips[0].flagged);
  assert.equal(ips.find((i) => i.ip === "203.0.113.1")!.signIns, 1);
  assert.ok(!ips.some((i) => i.ip === "192.0.2.1"));
  const s = securityStats(audit, now);
  assert.equal(s.failed, 6);
  assert.equal(s.adminActions, 1);
  const csv = auditCsv([{ ...audit[0], id: "1", ip: "=cmd()" }], new Map());
  assert.ok(csv.includes(`"'=cmd()"`), "CSV cells can't start a formula");
});

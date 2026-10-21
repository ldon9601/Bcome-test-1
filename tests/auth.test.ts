import assert from "node:assert/strict";
import { test } from "node:test";
import { accountAction, adviserAction, authAction, COOKIE, safeNext, serialiseCookie, type ApiContext } from "../src/lib/auth/api.ts";
import { hashPassword, needsRehash, verifyPassword } from "../src/lib/auth/crypto.ts";
import type { Email, Mailer } from "../src/lib/auth/mailer.ts";
import { MemoryStore } from "../src/lib/auth/memory-store.ts";
import { AuthService, type RequestMeta } from "../src/lib/auth/service.ts";
import { checkBirth, checkPassword, checkSchoolDomain, emailMatchesDomains } from "../src/lib/auth/validation.ts";

const FAST = { logN: 10, r: 8, p: 1 };
const GOOD_PW = "Purple 7 kangaroos jump!";
const meta: RequestMeta = { ip: "203.0.113.5", userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36" };

class CaptureMailer implements Mailer {
  sent: Email[] = [];
  async send(e: Email) {
    this.sent.push(e);
  }
  lastCode(to?: string) {
    const e = [...this.sent].reverse().find((x) => !to || x.to === to);
    return e?.text.match(/\b(\d{6})\b/)?.[1] ?? "";
  }
}

function setup(approval: "manual" | "auto" = "manual") {
  const store = new MemoryStore();
  const mailer = new CaptureMailer();
  let t = new Date("2026-10-22T00:00:00Z").getTime();
  const clock = { advance: (ms: number) => (t += ms) };
  const service = new AuthService({ store, mailer, secret: "test-secret", appUrl: "https://bcome.test", schoolApproval: approval, now: () => new Date(t), hashCost: FAST });
  return { store, mailer, service, clock };
}

const SCHOOL = {
  schoolName: "Harbour High School",
  state: "NSW",
  studentDomains: ["students.harbour.nsw.edu.au"],
  firstName: "Alex",
  lastName: "Nguyen",
  email: "alex.nguyen@harbour.nsw.edu.au",
  username: "anguyen",
  password: GOOD_PW,
};

async function activeSchool(env: ReturnType<typeof setup>, overrides: Partial<typeof SCHOOL> = {}) {
  const reg = await env.service.registerSchool({ ...SCHOOL, ...overrides }, meta);
  assert.ok(reg.ok, JSON.stringify(reg));
  const v = await env.service.verifyCode({ challengeToken: reg.challengeToken, code: env.mailer.lastCode(), trustDevice: false }, meta);
  assert.ok(v.ok && v.kind === "pending");
  const school = (await env.store.listSchools())[(await env.store.listSchools()).length - 1];
  await env.service.approveSchool(school.id);
  return (await env.store.getSchool(school.id))!;
}

const student = (joinCode: string, o: Record<string, unknown> = {}) => ({
  joinCode,
  firstName: "Mia",
  lastName: "Chen",
  email: "mia.chen@students.harbour.nsw.edu.au",
  username: "miachen",
  password: GOOD_PW,
  yearLevel: 11,
  birthYear: 2010,
  birthMonth: 3,
  acceptedNotice: true,
  ...o,
});

async function signedUpStudent(env: ReturnType<typeof setup>, trustDevice = true) {
  const school = await activeSchool(env);
  const reg = await env.service.registerStudent(student(school.joinCode), meta);
  assert.ok(reg.ok, JSON.stringify(reg));
  const v = await env.service.verifyCode({ challengeToken: reg.challengeToken, code: env.mailer.lastCode(), trustDevice }, meta);
  assert.ok(v.ok && v.kind === "session");
  return { school, grant: v };
}

test("passwords: at least 14 characters with letters, a number and a symbol; common and personal ones refused (ST4S A2)", () => {
  assert.match(checkPassword("Short 1!")!, /14/);
  assert.match(checkPassword("nonumbershere at all")!, /number/);
  assert.match(checkPassword("Password123456!")!, /common/);
  assert.match(checkPassword("miachen rocks 2026!", ["miachen"])!, /username/);
  assert.equal(checkPassword("I like 3 kinds of pizza!"), null);
});

test("passwords are hashed with salted scrypt and can be upgraded", async () => {
  const h = await hashPassword(GOOD_PW, FAST);
  assert.match(h, /^scrypt\$10\$8\$1\$/);
  assert.notEqual(h, await hashPassword(GOOD_PW, FAST), "salted");
  assert.ok(await verifyPassword(GOOD_PW, h));
  assert.ok(!(await verifyPassword("wrong password 1!", h)));
  assert.ok(needsRehash(h));
});

test("school domains: personal email and non-school domains are refused", () => {
  assert.match(checkSchoolDomain("gmail.com")!, /personal/);
  assert.match(checkSchoolDomain("harbour.com")!, /school domain/);
  assert.equal(checkSchoolDomain("education.nsw.gov.au"), null);
  assert.ok(emailMatchesDomains("a@students.harbour.nsw.edu.au", ["harbour.nsw.edu.au"]), "subdomains count");
  assert.ok(!emailMatchesDomains("a@evilharbour.nsw.edu.au", ["harbour.nsw.edu.au"]));
  assert.match(checkBirth(2020, 1, new Date("2026-10-22"))!, /Years 10 to 12/);
});

test("an adviser registers a school; it waits for approval, then students get the join code", async () => {
  const env = setup();
  const bad = await env.service.registerSchool({ ...SCHOOL, email: "alex@gmail.com" }, meta);
  assert.ok(!bad.ok && bad.field === "email");
  const reg = await env.service.registerSchool(SCHOOL, meta);
  assert.ok(reg.ok && reg.purpose === "verify_email");
  assert.equal(env.mailer.sent[0].to, SCHOOL.email);
  assert.ok(!env.mailer.sent[0].text.includes("Alex"), "code emails carry no names");
  const v = await env.service.verifyCode({ challengeToken: reg.challengeToken, code: env.mailer.lastCode(), trustDevice: false }, meta);
  assert.ok(v.ok && v.kind === "pending");
  const [school] = await env.store.listSchools();
  assert.equal(school.status, "pending");
  // Students can't join a school that hasn't been approved.
  const early = await env.service.registerStudent(student(school.joinCode), meta);
  assert.ok(!early.ok && early.field === "joinCode");
  await env.service.approveSchool(school.id);
  assert.ok(env.mailer.sent.at(-1)!.text.includes(school.joinCode));
});

test("advisers confirm every sign-in with an email code, even on a known device (ST4S A5)", async () => {
  const env = setup();
  await activeSchool(env);
  const s1 = await env.service.signIn({ identifier: "ANguyen", password: GOOD_PW, role: "adviser", remember: true }, meta);
  assert.ok(s1.ok && s1.kind === "challenge" && s1.purpose === "login");
  const v = await env.service.verifyCode({ challengeToken: s1.challengeToken, code: env.mailer.lastCode(), trustDevice: true }, meta);
  assert.ok(v.ok && v.kind === "session");
  assert.equal(v.persistent, false, "no remember me for advisers");
  assert.equal(v.deviceToken, undefined, "adviser devices are never trusted");
  const s2 = await env.service.signIn({ identifier: SCHOOL.email, password: GOOD_PW, role: "adviser", remember: false }, meta);
  assert.ok(s2.ok && s2.kind === "challenge");
});

test("students sign up only with the school code and a school email address", async () => {
  const env = setup();
  const school = await activeSchool(env);
  const wrongCode = await env.service.registerStudent(student("ZZZZ-ZZZZ"), meta);
  assert.ok(!wrongCode.ok && wrongCode.field === "joinCode");
  const personal = await env.service.registerStudent(student(school.joinCode, { email: "mia@gmail.com" }), meta);
  assert.ok(!personal.ok && personal.field === "email" && /students\.harbour\.nsw\.edu\.au/.test(personal.error));
  const noNotice = await env.service.registerStudent(student(school.joinCode, { acceptedNotice: false }), meta);
  assert.ok(!noNotice.ok && noNotice.field === "acceptedNotice");
  const lower = await env.service.registerStudent(student(school.joinCode.toLowerCase().replace("-", " ")), meta);
  assert.ok(lower.ok, "join codes are forgiving about case and spacing");
  const dupe = await env.service.registerStudent(student(school.joinCode, { email: "other@students.harbour.nsw.edu.au", username: "MIACHEN" }), meta);
  assert.ok(!dupe.ok && dupe.field === "username", "usernames are case-insensitive and unique");
  const u = (await env.store.findUserByUsername("miachen"))!;
  assert.deepEqual([u.yearLevel, u.birthYear, u.birthMonth, u.emailVerifiedAt], [11, 2010, 3, null]);
  assert.ok(!("dateOfBirth" in u), "only year and month of birth are kept");
});

test("students need an email code on a new device; a trusted device skips it", async () => {
  const env = setup();
  const { grant } = await signedUpStudent(env, true);
  assert.ok(grant.ok && grant.kind === "session" && grant.deviceToken);
  const known = await env.service.signIn({ identifier: "miachen", password: GOOD_PW, role: "student", remember: false }, { ...meta, deviceToken: grant.deviceToken });
  assert.ok(known.ok && known.kind === "session");
  const fresh = await env.service.signIn({ identifier: "miachen", password: GOOD_PW, role: "student", remember: false }, meta);
  assert.ok(fresh.ok && fresh.kind === "challenge" && fresh.purpose === "login");
  assert.match(env.mailer.sent.at(-1)!.subject, /sign-in code/);
  // Trust expires after 90 days.
  env.clock.advance(91 * 24 * 3600e3);
  const later = await env.service.signIn({ identifier: "miachen", password: GOOD_PW, role: "student", remember: false }, { ...meta, deviceToken: grant.deviceToken });
  assert.ok(later.ok && later.kind === "challenge");
});

test("remember me keeps students signed in for 30 days; otherwise sessions end after 60 idle minutes", async () => {
  const env = setup();
  const { grant } = await signedUpStudent(env);
  assert.ok(grant.ok && grant.kind === "session");
  const deviceMeta = { ...meta, deviceToken: grant.deviceToken };
  const remembered = await env.service.signIn({ identifier: "miachen", password: GOOD_PW, role: "student", remember: true }, deviceMeta);
  assert.ok(remembered.ok && remembered.kind === "session" && remembered.persistent);
  assert.equal(remembered.maxAgeMs, 30 * 24 * 3600e3);
  const short = await env.service.signIn({ identifier: "miachen", password: GOOD_PW, role: "student", remember: false }, deviceMeta);
  assert.ok(short.ok && short.kind === "session" && !short.persistent);
  env.clock.advance(61 * 60e3);
  assert.deepEqual(await env.service.getSession(short.sessionToken), { ok: false, reason: "idle" });
  assert.ok((await env.service.getSession(remembered.sessionToken)).ok);
  env.clock.advance(30 * 24 * 3600e3);
  assert.equal((await env.service.getSession(remembered.sessionToken)).ok, false);
});

test("adviser sessions lock after 15 minutes of inactivity (ST4S A10)", async () => {
  const env = setup();
  await activeSchool(env);
  const s = await env.service.signIn({ identifier: "anguyen", password: GOOD_PW, role: "adviser", remember: false }, meta);
  assert.ok(s.ok && s.kind === "challenge");
  const v = await env.service.verifyCode({ challengeToken: s.challengeToken, code: env.mailer.lastCode(), trustDevice: false }, meta);
  assert.ok(v.ok && v.kind === "session");
  env.clock.advance(14 * 60e3);
  assert.ok((await env.service.getSession(v.sessionToken)).ok);
  env.clock.advance(14 * 60e3);
  assert.ok((await env.service.getSession(v.sessionToken)).ok, "activity resets the idle timer");
  env.clock.advance(16 * 60e3);
  assert.deepEqual(await env.service.getSession(v.sessionToken), { ok: false, reason: "idle" });
});

test("five wrong passwords lock the account for 15 minutes", async () => {
  const env = setup();
  const { grant } = await signedUpStudent(env);
  const m = { ...meta, deviceToken: grant.ok && grant.kind === "session" ? grant.deviceToken : null };
  for (let i = 0; i < 4; i++) {
    const r = await env.service.signIn({ identifier: "miachen", password: "Wrong password 99!", role: "student", remember: false }, m);
    assert.ok(!r.ok && r.status === 401 && r.error === "That username or password isn't right.");
  }
  const fifth = await env.service.signIn({ identifier: "miachen", password: "Wrong password 99!", role: "student", remember: false }, m);
  assert.ok(!fifth.ok && fifth.status === 423);
  const right = await env.service.signIn({ identifier: "miachen", password: GOOD_PW, role: "student", remember: false }, m);
  assert.ok(!right.ok && right.status === 423, "even the right password waits");
  env.clock.advance(16 * 60e3);
  const after = await env.service.signIn({ identifier: "miachen", password: GOOD_PW, role: "student", remember: false }, m);
  assert.ok(after.ok);
  assert.ok(env.store.auditLog.some((e) => e.event === "login.locked"));
});

test("unknown usernames get the same answer as wrong passwords", async () => {
  const env = setup();
  await signedUpStudent(env);
  const r = await env.service.signIn({ identifier: "nobody", password: GOOD_PW, role: "student", remember: false }, meta);
  assert.ok(!r.ok && r.status === 401 && r.error === "That username or password isn't right.");
});

test("email codes: five wrong tries or ten minutes and the code is dead", async () => {
  const env = setup();
  const school = await activeSchool(env);
  const reg = await env.service.registerStudent(student(school.joinCode), meta);
  assert.ok(reg.ok);
  const code = env.mailer.lastCode();
  for (let i = 0; i < 5; i++) await env.service.verifyCode({ challengeToken: reg.challengeToken, code: "000000" === code ? "111111" : "000000", trustDevice: false }, meta);
  const r = await env.service.verifyCode({ challengeToken: reg.challengeToken, code, trustDevice: false }, meta);
  assert.ok(!r.ok && /Too many/.test(r.error));
  // A resend gives a fresh code, but not straight away.
  const quick = await env.service.resendCode(reg.challengeToken);
  assert.ok(!quick.ok && quick.status === 429);
  env.clock.advance(61e3);
  assert.ok((await env.service.resendCode(reg.challengeToken)).ok);
  env.clock.advance(11 * 60e3);
  const late = await env.service.verifyCode({ challengeToken: reg.challengeToken, code: env.mailer.lastCode(), trustDevice: false }, meta);
  assert.ok(!late.ok && /expired/.test(late.error));
});

test("students and advisers use their own sign-in tile", async () => {
  const env = setup();
  await signedUpStudent(env);
  const r = await env.service.signIn({ identifier: "miachen", password: GOOD_PW, role: "adviser", remember: false }, meta);
  assert.ok(!r.ok && /student sign-in/.test(r.error));
});

test("password reset: same answer for unknown accounts; a reset signs out everywhere", async () => {
  const env = setup();
  const { grant } = await signedUpStudent(env);
  assert.ok(grant.ok && grant.kind === "session");
  const unknown = await env.service.requestPasswordReset({ identifier: "ghost@students.harbour.nsw.edu.au" }, meta);
  assert.ok(unknown.ok && unknown.kind === "challenge");
  const sentBefore = env.mailer.sent.length;
  const req = await env.service.requestPasswordReset({ identifier: "mia.chen@students.harbour.nsw.edu.au" }, meta);
  assert.ok(req.ok && env.mailer.sent.length === sentBefore + 1);
  const weak = await env.service.resetPassword({ challengeToken: req.challengeToken, code: env.mailer.lastCode(), password: "short" }, meta);
  assert.ok(!weak.ok && weak.field === "password");
  const done = await env.service.resetPassword({ challengeToken: req.challengeToken, code: env.mailer.lastCode(), password: "Brand new 9 password!" }, meta);
  assert.ok(done.ok);
  assert.equal((await env.service.getSession(grant.sessionToken)).ok, false, "old sessions end");
  assert.equal((await env.store.listDevices((await env.store.findUserByUsername("miachen"))!.id)).length, 0, "trusted devices are forgotten");
  assert.match(env.mailer.sent.at(-1)!.subject, /password was changed/);
});

test("schools are kept apart: an adviser can only manage their own students", async () => {
  const env = setup();
  const a = await activeSchool(env);
  await env.service.registerStudent(student(a.joinCode), meta);
  const b = await activeSchool(env, { schoolName: "Bayside College", email: "sam@bayside.vic.edu.au", username: "sam.b", studentDomains: ["bayside.vic.edu.au"] });
  const s = await env.service.signIn({ identifier: "sam.b", password: GOOD_PW, role: "adviser", remember: false }, meta);
  assert.ok(s.ok && s.kind === "challenge");
  const v = await env.service.verifyCode({ challengeToken: s.challengeToken, code: env.mailer.lastCode(), trustDevice: false }, meta);
  assert.ok(v.ok && v.kind === "session");
  const cur = await env.service.getSession(v.sessionToken);
  assert.ok(cur.ok && cur.school.id === b.id);
  const mia = (await env.store.findUserByUsername("miachen"))!;
  const r = await env.service.removeStudent(cur, mia.id, meta);
  assert.ok(!r.ok && r.status === 404);
  assert.ok(await env.store.getUser(mia.id));
});

test("advisers invite colleagues by email; the invite works once", async () => {
  const env = setup();
  await activeSchool(env);
  const s = await env.service.signIn({ identifier: "anguyen", password: GOOD_PW, role: "adviser", remember: false }, meta);
  assert.ok(s.ok && s.kind === "challenge");
  const v = await env.service.verifyCode({ challengeToken: s.challengeToken, code: env.mailer.lastCode(), trustDevice: false }, meta);
  assert.ok(v.ok && v.kind === "session");
  const cur = await env.service.getSession(v.sessionToken);
  assert.ok(cur.ok);
  assert.ok(!(await env.service.inviteAdviser(cur, "pat@gmail.com", meta)).ok);
  assert.ok((await env.service.inviteAdviser(cur, "pat.lee@harbour.nsw.edu.au", meta)).ok);
  const token = env.mailer.sent.at(-1)!.text.match(/invite\/([\w-]+)/)![1];
  assert.deepEqual(await env.service.describeInvite(token), { email: "pat.lee@harbour.nsw.edu.au", schoolName: "Harbour High School" });
  const acc = { token, firstName: "Pat", lastName: "Lee", username: "plee", password: "Careers 4 everyone!!" };
  assert.ok((await env.service.acceptInvite(acc, meta)).ok);
  assert.ok(!(await env.service.acceptInvite({ ...acc, username: "plee2" }, meta)).ok);
  const pat = (await env.store.findUserByUsername("plee"))!;
  assert.equal(pat.role, "adviser");
  assert.equal(pat.schoolId, cur.school.id);
});

test("API layer: cookies are HttpOnly, the challenge cookie carries the code step, and next paths stay on site", async () => {
  const env = setup();
  const school = await activeSchool(env);
  const cookies: Record<string, string> = {};
  const ctx = (): ApiContext => ({ service: env.service, cookies, meta });
  const apply = (r: { cookies: { name: string; value: string; maxAgeMs: number | null }[] }) => {
    for (const c of r.cookies) if (c.maxAgeMs === 0) delete cookies[c.name];
    else cookies[c.name] = c.value;
  };
  const reg = await authAction("register-student", student(school.joinCode), ctx());
  assert.equal(reg.status, 200);
  assert.match(String(reg.body.next), /^\/verify\?p=verify_email/);
  apply(reg);
  const v = await authAction("verify", { code: env.mailer.lastCode(), trustDevice: true }, ctx());
  assert.equal(v.status, 200, JSON.stringify(v.body));
  apply(v);
  assert.ok(cookies[COOKIE.session] && cookies[COOKIE.device] && !cookies[COOKIE.challenge]);
  assert.equal(v.body.next, "/account");
  const pw = await accountAction("password", { current: GOOD_PW, password: "Another 5 good password!" }, ctx());
  assert.equal(pw.status, 200, JSON.stringify(pw.body));
  const denied = await adviserAction("join-code", {}, ctx());
  assert.equal(denied.status, 403);
  assert.match(serialiseCookie({ name: "x", value: "y", maxAgeMs: null }), /HttpOnly; SameSite=Lax$/);
  assert.equal(safeNext("//evil.example", "/"), "/");
  assert.equal(safeNext("/plan", "/"), "/plan");
  const out = await authAction("sign-out", {}, ctx());
  apply(out);
  assert.equal((await accountAction("year-level", { yearLevel: 12 }, ctx())).status, 401);
});

test("every sign-in, failure, lock and admin action is in the audit log (ST4S L1)", async () => {
  const env = setup();
  await signedUpStudent(env);
  await env.service.signIn({ identifier: "miachen", password: "Wrong password 99!", role: "student", remember: false }, meta);
  const events = env.store.auditLog.map((e) => e.event);
  for (const e of ["school.registered", "email.verified", "school.approved", "student.registered", "login.success", "login.failed"]) assert.ok(events.includes(e), e);
  assert.ok(env.store.auditLog.every((e) => !JSON.stringify(e.detail).includes(GOOD_PW)), "no passwords in logs");
});

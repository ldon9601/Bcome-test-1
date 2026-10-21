import { codeEmail, inviteEmail, passwordChangedEmail, schoolApprovedEmail } from "./emails.ts";
import { hashCode, hashPassword, needsRehash, normaliseJoinCode, OWASP_COST, randomCode, randomJoinCode, randomToken, safeEqual, sha256, verifyPassword, type HashCost } from "./crypto.ts";
import type { Mailer } from "./mailer.ts";
import { POLICY, sessionLimits, type Role } from "./policy.ts";
import { DuplicateError, type AuthStore, type Challenge, type ChallengePurpose, type School, type Session, type User } from "./store.ts";
import {
  checkBirth,
  checkEmail,
  checkName,
  checkPassword,
  checkSchoolDomain,
  checkSchoolName,
  checkUsername,
  checkYearLevel,
  emailDomain,
  emailMatchesDomains,
  normaliseDomain,
  normaliseEmail,
  normaliseUsername,
  STATES,
  type AuState,
} from "./validation.ts";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  /** The browser's device cookie, if it has one. */
  deviceToken?: string | null;
}

export type Fail = { ok: false; status: number; error: string; field?: string };
export type Result<T = object> = ({ ok: true } & T) | Fail;

export interface SessionGrant {
  kind: "session";
  sessionToken: string;
  /** Persistent cookie (remember me) or a browser-session cookie. */
  persistent: boolean;
  maxAgeMs: number;
  role: Role;
  /** Set when this browser has just been trusted; store it in the device cookie. */
  deviceToken?: string;
}
export interface ChallengeGrant {
  kind: "challenge";
  challengeToken: string;
  purpose: ChallengePurpose;
  emailHint: string;
  role: Role;
}
export interface PendingSchool {
  kind: "pending";
}

export interface CurrentSession {
  user: User;
  school: School;
  session: Session;
}

export interface ServiceOptions {
  store: AuthStore;
  mailer: Mailer;
  /** Server secret for keying one-time codes. */
  secret: string;
  appUrl: string;
  /** "manual": new schools wait for a Bcome operator to approve them. "auto": active straight away (development). */
  schoolApproval: "manual" | "auto";
  now?: () => Date;
  hashCost?: HashCost;
}

const fail = (status: number, error: string, field?: string): Fail => ({ ok: false, status, error, field });
const GENERIC_LOGIN = "That username or password isn't right.";

/** "j***@school.edu.au" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}

/** Coarse device label for the "trusted devices" list. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "Chromebook" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export class AuthService {
  store: AuthStore;
  mailer: Mailer;
  secret: string;
  appUrl: string;
  schoolApproval: "manual" | "auto";
  now: () => Date;
  hashCost: HashCost;

  constructor(opts: ServiceOptions) {
    this.store = opts.store;
    this.mailer = opts.mailer;
    this.secret = opts.secret;
    this.appUrl = opts.appUrl.replace(/\/$/, "");
    this.schoolApproval = opts.schoolApproval;
    this.now = opts.now ?? (() => new Date());
    this.hashCost = opts.hashCost ?? OWASP_COST;
  }

  private iso(offsetMs = 0) {
    return new Date(this.now().getTime() + offsetMs).toISOString();
  }

  private async log(event: string, o: { actor?: User | null; schoolId?: string | null; target?: string | null; meta?: RequestMeta; detail?: Record<string, unknown> }) {
    await this.store.audit({
      at: this.iso(),
      event,
      actorId: o.actor?.id ?? null,
      schoolId: o.schoolId ?? o.actor?.schoolId ?? null,
      targetId: o.target ?? null,
      ip: o.meta?.ip ?? null,
      detail: o.detail ?? {},
    });
  }

  private async limited(key: string, rule: { limit: number; windowMs: number }) {
    return (await this.store.hit(key, rule.windowMs, this.now())) > rule.limit;
  }

  private async createUserOrFail(u: Omit<User, "id">): Promise<User | Fail> {
    try {
      return await this.store.createUser(u);
    } catch (e) {
      if (e instanceof DuplicateError && e.field === "username") return fail(409, "That username is taken. Try another.", "username");
      if (e instanceof DuplicateError && e.field === "email") return fail(409, "There's already an account with that email. Sign in or reset your password.", "email");
      throw e;
    }
  }

  private async usernameOrEmailTaken(username: string, email: string): Promise<Fail | null> {
    if (await this.store.findUserByUsername(username)) return fail(409, "That username is taken. Try another.", "username");
    if (await this.store.findUserByEmail(email)) return fail(409, "There's already an account with that email. Sign in or reset your password.", "email");
    return null;
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /** A careers adviser registers their school and their own account. */
  async registerSchool(
    input: { schoolName: string; state: string; studentDomains: string[]; firstName: string; lastName: string; email: string; username: string; password: string },
    meta: RequestMeta,
  ): Promise<Result<ChallengeGrant>> {
    if (meta.ip && (await this.limited(`register:${meta.ip}`, POLICY.rate.registerPerIp))) return fail(429, "Too many attempts from this network. Try again later.");
    const email = normaliseEmail(input.email);
    const username = normaliseUsername(input.username);
    const domains = [...new Set(input.studentDomains.map(normaliseDomain).filter(Boolean))];
    const checks: [string | null, string][] = [
      [checkSchoolName(input.schoolName), "schoolName"],
      [STATES.includes(input.state as AuState) ? null : "Choose your state or territory.", "state"],
      [domains.length === 0 ? "Add the email domain your students use." : domains.length > 5 ? "Add up to five domains." : null, "studentDomains"],
      ...domains.map((d) => [checkSchoolDomain(d), "studentDomains"] as [string | null, string]),
      [checkName(input.firstName, "first name"), "firstName"],
      [checkName(input.lastName, "last name"), "lastName"],
      [checkEmail(email) ?? (checkSchoolDomain(emailDomain(email)) ? "Use your school email address." : null), "email"],
      [checkUsername(username), "username"],
      [checkPassword(input.password, [username, email, input.firstName, input.lastName]), "password"],
    ];
    const bad = checks.find(([m]) => m);
    if (bad) return fail(400, bad[0]!, bad[1]);
    const taken = await this.usernameOrEmailTaken(username, email);
    if (taken) return taken;

    let school: School | null = null;
    for (let i = 0; i < 5 && !school; i++) {
      try {
        school = await this.store.createSchool({
          name: input.schoolName.trim(),
          state: input.state as AuState,
          studentDomains: domains,
          joinCode: randomJoinCode(),
          status: this.schoolApproval === "auto" ? "active" : "pending",
          allowAiPlans: false,
          createdAt: this.iso(),
          approvedAt: this.schoolApproval === "auto" ? this.iso() : null,
        });
      } catch (e) {
        if (!(e instanceof DuplicateError)) throw e;
      }
    }
    if (!school) throw new Error("Couldn't create a unique join code");

    const user = await this.createUserOrFail({
      schoolId: school.id,
      role: "adviser",
      username,
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      yearLevel: null,
      birthYear: null,
      birthMonth: null,
      passwordHash: await hashPassword(input.password, this.hashCost),
      emailVerifiedAt: null,
      failedLogins: 0,
      lockedUntil: null,
      createdAt: this.iso(),
      lastLoginAt: null,
    });
    if ("ok" in user) return user;
    await this.log("school.registered", { actor: user, schoolId: school.id, meta, detail: { name: school.name, status: school.status } });
    return { ok: true, ...(await this.startChallenge(user, "verify_email", false)) };
  }

  /** A student creates an account with their school email and the school code from their adviser. */
  async registerStudent(
    input: {
      joinCode: string;
      firstName: string;
      lastName: string;
      email: string;
      username: string;
      password: string;
      yearLevel: number;
      birthYear: number;
      birthMonth: number;
      acceptedNotice: boolean;
    },
    meta: RequestMeta,
  ): Promise<Result<ChallengeGrant>> {
    if (meta.ip && (await this.limited(`register:${meta.ip}`, POLICY.rate.registerPerIp))) return fail(429, "Too many attempts from this network. Try again later.");
    const school = await this.store.findSchoolByJoinCode(normaliseJoinCode(input.joinCode ?? ""));
    if (!school || school.status !== "active") return fail(400, "That school code isn't right. Check it with your careers adviser.", "joinCode");
    const email = normaliseEmail(input.email);
    const username = normaliseUsername(input.username);
    const checks: [string | null, string][] = [
      [checkName(input.firstName, "first name"), "firstName"],
      [checkName(input.lastName, "last name"), "lastName"],
      [
        checkEmail(email) ??
          (emailMatchesDomains(email, school.studentDomains) ? null : `Use your school email address (ending in @${school.studentDomains[0]}).`),
        "email",
      ],
      [checkUsername(username), "username"],
      [checkPassword(input.password, [username, email, input.firstName, input.lastName]), "password"],
      [checkYearLevel(Number(input.yearLevel)), "yearLevel"],
      [checkBirth(Number(input.birthYear), Number(input.birthMonth), this.now()), "birth"],
      [input.acceptedNotice ? null : "Please read and accept the privacy notice.", "acceptedNotice"],
    ];
    const bad = checks.find(([m]) => m);
    if (bad) return fail(400, bad[0]!, bad[1]);
    const taken = await this.usernameOrEmailTaken(username, email);
    if (taken) return taken;

    const user = await this.createUserOrFail({
      schoolId: school.id,
      role: "student",
      username,
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      yearLevel: Number(input.yearLevel),
      birthYear: Number(input.birthYear),
      birthMonth: Number(input.birthMonth),
      passwordHash: await hashPassword(input.password, this.hashCost),
      emailVerifiedAt: null,
      failedLogins: 0,
      lockedUntil: null,
      createdAt: this.iso(),
      lastLoginAt: null,
    });
    if ("ok" in user) return user;
    await this.log("student.registered", { actor: user, meta });
    return { ok: true, ...(await this.startChallenge(user, "verify_email", false)) };
  }

  // -------------------------------------------------------------------------
  // Email codes
  // -------------------------------------------------------------------------

  private async startChallenge(user: User, purpose: ChallengePurpose, remember: boolean): Promise<ChallengeGrant> {
    await this.store.deleteUserChallenges(user.id, purpose);
    const token = randomToken();
    const code = randomCode();
    const ch = await this.store.createChallenge({
      userId: user.id,
      purpose,
      codeHash: "pending",
      tokenHash: sha256(token),
      attempts: 0,
      sentCount: 1,
      lastSentAt: this.iso(),
      expiresAt: this.iso(POLICY.code.ttlMs),
      consumedAt: null,
      remember,
      createdAt: this.iso(),
    });
    await this.store.updateChallenge(ch.id, { codeHash: hashCode(this.secret, ch.id, code) });
    await this.mailer.send(codeEmail(user.email, purpose, code, POLICY.code.ttlMs / 60000));
    return { kind: "challenge", challengeToken: token, purpose, emailHint: maskEmail(user.email), role: user.role };
  }

  /** Checks a code. Wrong codes count towards the attempt limit; a used or expired code never works again. */
  private async consumeCode(challengeToken: string, code: string, purposes: ChallengePurpose[]): Promise<{ challenge: Challenge; user: User } | Fail> {
    const ch = challengeToken ? await this.store.findChallengeByHash(sha256(challengeToken)) : null;
    const expired = fail(400, "That code has expired. Ask for a new one.", "code");
    if (!ch || !purposes.includes(ch.purpose) || ch.consumedAt || Date.parse(ch.expiresAt) <= this.now().getTime()) return expired;
    if (ch.attempts >= POLICY.code.maxAttempts) return fail(400, "Too many wrong codes. Ask for a new one.", "code");
    const clean = String(code ?? "").replace(/\D/g, "");
    if (clean.length !== 6 || !safeEqual(hashCode(this.secret, ch.id, clean), ch.codeHash)) {
      await this.store.updateChallenge(ch.id, { attempts: ch.attempts + 1 });
      const left = POLICY.code.maxAttempts - ch.attempts - 1;
      await this.log("code.failed", { target: ch.userId, detail: { purpose: ch.purpose } });
      return fail(400, left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Ask for a new one.", "code");
    }
    await this.store.updateChallenge(ch.id, { consumedAt: this.iso() });
    const user = await this.store.getUser(ch.userId);
    if (!user) return expired;
    return { challenge: ch, user };
  }

  async resendCode(challengeToken: string): Promise<Result<{ emailHint: string }>> {
    const ch = challengeToken ? await this.store.findChallengeByHash(sha256(challengeToken)) : null;
    if (!ch || ch.consumedAt) return fail(400, "Start again to get a new code.");
    if (this.now().getTime() - Date.parse(ch.lastSentAt) < POLICY.code.resendCooldownMs) return fail(429, "Wait a minute before asking for another code.");
    if (ch.sentCount >= POLICY.code.maxPerHour) return fail(429, "Too many codes sent. Start again later.");
    const user = await this.store.getUser(ch.userId);
    if (!user) return fail(400, "Start again to get a new code.");
    const code = randomCode();
    await this.store.updateChallenge(ch.id, {
      codeHash: hashCode(this.secret, ch.id, code),
      attempts: 0,
      sentCount: ch.sentCount + 1,
      lastSentAt: this.iso(),
      expiresAt: this.iso(POLICY.code.ttlMs),
    });
    await this.mailer.send(codeEmail(user.email, ch.purpose, code, POLICY.code.ttlMs / 60000));
    return { ok: true, emailHint: maskEmail(user.email) };
  }

  /** Completes email verification or a new-device / adviser sign-in. */
  async verifyCode(input: { challengeToken: string; code: string; trustDevice: boolean }, meta: RequestMeta): Promise<Result<SessionGrant | PendingSchool>> {
    const r = await this.consumeCode(input.challengeToken, input.code, ["verify_email", "login"]);
    if ("ok" in r) return r;
    const { challenge, user } = r;
    if (challenge.purpose === "verify_email") {
      await this.store.updateUser(user.id, { emailVerifiedAt: this.iso() });
      await this.log("email.verified", { actor: user, meta });
    }
    const school = await this.store.getSchool(user.schoolId);
    if (!school || school.status === "suspended") return fail(403, "Your school's Bcome account isn't active. Talk to your careers adviser.");
    if (school.status === "pending") return { ok: true, kind: "pending" };
    const grant = await this.openSession(user, challenge.remember, meta);
    if (user.role === "student" && input.trustDevice) grant.deviceToken = await this.trustDevice(user, meta);
    await this.log("login.success", { actor: user, meta, detail: { method: challenge.purpose === "login" ? "password+email_code" : "email_verification", trusted: !!grant.deviceToken } });
    return { ok: true, ...grant };
  }

  // -------------------------------------------------------------------------
  // Sign in and sessions
  // -------------------------------------------------------------------------

  async signIn(input: { identifier: string; password: string; role: Role; remember: boolean }, meta: RequestMeta): Promise<Result<SessionGrant | ChallengeGrant | PendingSchool>> {
    const id = String(input.identifier ?? "").trim().toLowerCase();
    if (!id || !input.password) return fail(400, "Enter your username or email and your password.");
    if (await this.limited(`signin:${id}`, POLICY.rate.signInPerIdentifier)) return fail(429, "Too many sign-in attempts. Wait 15 minutes or reset your password.");
    const user = id.includes("@") ? await this.store.findUserByEmail(id) : await this.store.findUserByUsername(id);
    if (!user) {
      // Spend the same time as a real check so response times don't reveal which usernames exist.
      await verifyPassword(input.password, await hashPassword("timing-equaliser", this.hashCost));
      await this.log("login.failed", { meta, detail: { reason: "unknown_user" } });
      return fail(401, GENERIC_LOGIN);
    }
    if (user.lockedUntil && Date.parse(user.lockedUntil) > this.now().getTime()) {
      await this.log("login.blocked", { actor: user, meta, detail: { reason: "locked" } });
      return fail(423, "This account is locked after too many attempts. Wait 15 minutes or reset your password.");
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) {
      const failures = user.failedLogins + 1;
      const lock = failures >= POLICY.lockout.maxFailures;
      await this.store.updateUser(user.id, { failedLogins: lock ? 0 : failures, lockedUntil: lock ? this.iso(POLICY.lockout.lockMs) : null });
      await this.log(lock ? "login.locked" : "login.failed", { actor: user, meta, detail: { reason: "bad_password", failures } });
      return lock ? fail(423, "This account is locked after too many attempts. Wait 15 minutes or reset your password.") : fail(401, GENERIC_LOGIN);
    }
    await this.store.updateUser(user.id, {
      failedLogins: 0,
      lockedUntil: null,
      ...(needsRehash(user.passwordHash, this.hashCost) ? { passwordHash: await hashPassword(input.password, this.hashCost) } : {}),
    });
    if (user.role !== input.role) {
      return fail(403, user.role === "adviser" ? "This is a careers adviser account. Use the careers adviser sign-in." : "This is a student account. Use the student sign-in.");
    }
    const school = await this.store.getSchool(user.schoolId);
    if (!school || school.status === "suspended") return fail(403, "Your school's Bcome account isn't active. Talk to your careers adviser.");
    const remember = user.role === "student" && !!input.remember;
    if (!user.emailVerifiedAt) return { ok: true, ...(await this.startChallenge(user, "verify_email", remember)) };
    if (school.status === "pending") return { ok: true, kind: "pending" };
    // Advisers can see a whole school's data, so they confirm every sign-in by email (ST4S A5).
    if (user.role === "adviser") return { ok: true, ...(await this.startChallenge(user, "login", false)) };
    const device = meta.deviceToken ? await this.store.findDevice(user.id, sha256(meta.deviceToken)) : null;
    if (!device || Date.parse(device.expiresAt) <= this.now().getTime()) {
      await this.log("login.new_device", { actor: user, meta });
      return { ok: true, ...(await this.startChallenge(user, "login", remember)) };
    }
    await this.store.updateDevice(device.id, { lastUsedAt: this.iso() });
    await this.log("login.success", { actor: user, meta, detail: { method: "password+trusted_device" } });
    return { ok: true, ...(await this.openSession(user, remember, meta)) };
  }

  private async openSession(user: User, remember: boolean, _meta: RequestMeta): Promise<SessionGrant> {
    const token = randomToken();
    const limits = sessionLimits(user.role, remember);
    await this.store.createSession({
      userId: user.id,
      tokenHash: sha256(token),
      remember: limits.persistent,
      createdAt: this.iso(),
      lastSeenAt: this.iso(),
      expiresAt: this.iso(limits.absoluteMs),
    });
    await this.store.updateUser(user.id, { lastLoginAt: this.iso() });
    return { kind: "session", sessionToken: token, persistent: limits.persistent, maxAgeMs: limits.absoluteMs, role: user.role };
  }

  private async trustDevice(user: User, meta: RequestMeta): Promise<string> {
    const token = meta.deviceToken || randomToken();
    const hash = sha256(token);
    const existing = await this.store.findDevice(user.id, hash);
    if (existing) await this.store.updateDevice(existing.id, { lastUsedAt: this.iso(), expiresAt: this.iso(POLICY.device.trustMs) });
    else {
      await this.store.createDevice({
        userId: user.id,
        tokenHash: hash,
        label: deviceLabel(meta.userAgent),
        createdAt: this.iso(),
        lastUsedAt: this.iso(),
        expiresAt: this.iso(POLICY.device.trustMs),
      });
    }
    return token;
  }

  /** Looks up a session cookie. Ends sessions that are past their absolute or idle limit. */
  async getSession(token: string | null | undefined): Promise<(CurrentSession & { ok: true }) | { ok: false; reason: "none" | "expired" | "idle" }> {
    if (!token) return { ok: false, reason: "none" };
    const session = await this.store.findSessionByHash(sha256(token));
    if (!session) return { ok: false, reason: "none" };
    const user = await this.store.getUser(session.userId);
    const now = this.now().getTime();
    if (!user || Date.parse(session.expiresAt) <= now) {
      await this.store.deleteSession(session.id);
      return { ok: false, reason: "expired" };
    }
    const limits = sessionLimits(user.role, session.remember);
    if (now - Date.parse(session.lastSeenAt) > limits.idleMs) {
      await this.store.deleteSession(session.id);
      await this.log("session.idle_timeout", { actor: user });
      return { ok: false, reason: "idle" };
    }
    const school = await this.store.getSchool(user.schoolId);
    if (!school || school.status !== "active") return { ok: false, reason: "expired" };
    if (now - Date.parse(session.lastSeenAt) > POLICY.session.touchEveryMs) {
      session.lastSeenAt = this.iso();
      await this.store.updateSession(session.id, { lastSeenAt: session.lastSeenAt });
    }
    return { ok: true, user, school, session };
  }

  async signOut(token: string | null | undefined, meta: RequestMeta) {
    if (!token) return;
    const session = await this.store.findSessionByHash(sha256(token));
    if (!session) return;
    await this.store.deleteSession(session.id);
    await this.log("logout", { actor: await this.store.getUser(session.userId), meta });
  }

  // -------------------------------------------------------------------------
  // Passwords
  // -------------------------------------------------------------------------

  /** Always answers the same way, so it can't be used to find out who has an account. */
  async requestPasswordReset(input: { identifier: string }, meta: RequestMeta): Promise<Result<ChallengeGrant>> {
    const id = String(input.identifier ?? "").trim().toLowerCase();
    if (!id) return fail(400, "Enter your username or email.");
    const user = (await this.limited(`reset:${id}`, POLICY.rate.resetPerIdentifier))
      ? null
      : id.includes("@")
        ? await this.store.findUserByEmail(id)
        : await this.store.findUserByUsername(id);
    if (!user) return { ok: true, kind: "challenge", challengeToken: randomToken(), purpose: "reset_password", emailHint: "your email address", role: "student" };
    await this.log("password.reset_requested", { actor: user, meta });
    return { ok: true, ...(await this.startChallenge(user, "reset_password", false)) };
  }

  async resetPassword(input: { challengeToken: string; code: string; password: string }, meta: RequestMeta): Promise<Result<{ role: Role }>> {
    const ch = input.challengeToken ? await this.store.findChallengeByHash(sha256(input.challengeToken)) : null;
    if (ch && !ch.consumedAt) {
      const u = await this.store.getUser(ch.userId);
      const problem = u && checkPassword(input.password, [u.username, u.email, u.firstName, u.lastName]);
      if (problem) return fail(400, problem, "password");
    }
    const r = await this.consumeCode(input.challengeToken, input.code, ["reset_password"]);
    if ("ok" in r) return r;
    const { user } = r;
    await this.store.updateUser(user.id, {
      passwordHash: await hashPassword(input.password, this.hashCost),
      failedLogins: 0,
      lockedUntil: null,
      emailVerifiedAt: user.emailVerifiedAt ?? this.iso(),
    });
    await this.store.deleteUserSessions(user.id);
    await this.store.deleteUserDevices(user.id);
    await this.mailer.send(passwordChangedEmail(user.email));
    await this.log("password.reset", { actor: user, meta });
    return { ok: true, role: user.role };
  }

  async changePassword(cur: CurrentSession, input: { current: string; password: string }, meta: RequestMeta): Promise<Result> {
    const u = cur.user;
    if (!(await verifyPassword(input.current ?? "", u.passwordHash))) return fail(400, "Your current password isn't right.", "current");
    const problem = checkPassword(input.password ?? "", [u.username, u.email, u.firstName, u.lastName]);
    if (problem) return fail(400, problem, "password");
    await this.store.updateUser(u.id, { passwordHash: await hashPassword(input.password, this.hashCost) });
    await this.store.deleteUserSessions(u.id, cur.session.id);
    await this.mailer.send(passwordChangedEmail(u.email));
    await this.log("password.changed", { actor: u, meta });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Student account
  // -------------------------------------------------------------------------

  async updateYearLevel(cur: CurrentSession, yearLevel: number, meta: RequestMeta): Promise<Result> {
    if (cur.user.role !== "student") return fail(403, "Only students have a year level.");
    const problem = checkYearLevel(Number(yearLevel));
    if (problem) return fail(400, problem, "yearLevel");
    await this.store.updateUser(cur.user.id, { yearLevel: Number(yearLevel) });
    await this.log("student.updated", { actor: cur.user, meta, detail: { yearLevel: Number(yearLevel) } });
    return { ok: true };
  }

  async forgetDevice(cur: CurrentSession, deviceId: string, meta: RequestMeta): Promise<Result> {
    await this.store.deleteDevice(cur.user.id, deviceId);
    await this.log("device.removed", { actor: cur.user, meta });
    return { ok: true };
  }

  async signOutEverywhere(cur: CurrentSession, meta: RequestMeta): Promise<Result> {
    await this.store.deleteUserSessions(cur.user.id);
    await this.store.deleteUserDevices(cur.user.id);
    await this.log("logout.everywhere", { actor: cur.user, meta });
    return { ok: true };
  }

  /** Deletes the student's account and every assessment (APP 11.2: destroy data no longer needed). */
  async deleteOwnAccount(cur: CurrentSession, password: string, meta: RequestMeta): Promise<Result> {
    if (cur.user.role !== "student") return fail(403, "Advisers are removed by another adviser at their school.");
    if (!(await verifyPassword(password ?? "", cur.user.passwordHash))) return fail(400, "Your password isn't right.", "password");
    await this.store.deleteUser(cur.user.id);
    await this.log("student.deleted", { schoolId: cur.user.schoolId, target: cur.user.id, meta, detail: { by: "self" } });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Careers advisers
  // -------------------------------------------------------------------------

  private requireAdviser(cur: CurrentSession): Fail | null {
    return cur.user.role === "adviser" ? null : fail(403, "Only careers advisers can do that.");
  }

  async inviteAdviser(cur: CurrentSession, emailInput: string, meta: RequestMeta): Promise<Result<{ inviteId: string }>> {
    const denied = this.requireAdviser(cur);
    if (denied) return denied;
    const email = normaliseEmail(emailInput ?? "");
    const problem = checkEmail(email) ?? (checkSchoolDomain(emailDomain(email)) ? "Use a school email address." : null);
    if (problem) return fail(400, problem, "email");
    if (await this.store.findUserByEmail(email)) return fail(409, "There's already a Bcome account with that email.", "email");
    const token = randomToken();
    const invite = await this.store.createInvite({
      schoolId: cur.school.id,
      email,
      tokenHash: sha256(token),
      invitedBy: cur.user.id,
      expiresAt: this.iso(POLICY.invite.ttlMs),
      acceptedAt: null,
      createdAt: this.iso(),
    });
    await this.mailer.send(inviteEmail(email, cur.school.name, `${cur.user.firstName} ${cur.user.lastName}`, `${this.appUrl}/invite/${token}`, 7));
    await this.log("adviser.invited", { actor: cur.user, meta, detail: { email } });
    return { ok: true, inviteId: invite.id };
  }

  async describeInvite(token: string): Promise<{ email: string; schoolName: string } | null> {
    const inv = token ? await this.store.findInviteByHash(sha256(token)) : null;
    if (!inv || inv.acceptedAt || Date.parse(inv.expiresAt) <= this.now().getTime()) return null;
    const school = await this.store.getSchool(inv.schoolId);
    return school ? { email: inv.email, schoolName: school.name } : null;
  }

  async acceptInvite(input: { token: string; firstName: string; lastName: string; username: string; password: string }, meta: RequestMeta): Promise<Result> {
    const inv = input.token ? await this.store.findInviteByHash(sha256(input.token)) : null;
    if (!inv || inv.acceptedAt || Date.parse(inv.expiresAt) <= this.now().getTime()) return fail(400, "This invitation has expired or been used. Ask your colleague to send a new one.");
    const username = normaliseUsername(input.username);
    const checks: [string | null, string][] = [
      [checkName(input.firstName, "first name"), "firstName"],
      [checkName(input.lastName, "last name"), "lastName"],
      [checkUsername(username), "username"],
      [checkPassword(input.password, [username, inv.email, input.firstName, input.lastName]), "password"],
    ];
    const bad = checks.find(([m]) => m);
    if (bad) return fail(400, bad[0]!, bad[1]);
    const taken = await this.usernameOrEmailTaken(username, inv.email);
    if (taken) return taken;
    const user = await this.createUserOrFail({
      schoolId: inv.schoolId,
      role: "adviser",
      username,
      email: inv.email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      yearLevel: null,
      birthYear: null,
      birthMonth: null,
      passwordHash: await hashPassword(input.password, this.hashCost),
      // The invitation link was sent to this address, which confirms it.
      emailVerifiedAt: this.iso(),
      failedLogins: 0,
      lockedUntil: null,
      createdAt: this.iso(),
      lastLoginAt: null,
    });
    if ("ok" in user) return user;
    await this.store.updateInvite(inv.id, { acceptedAt: this.iso() });
    await this.log("adviser.joined", { actor: user, meta, detail: { invitedBy: inv.invitedBy } });
    return { ok: true };
  }

  async revokeInvite(cur: CurrentSession, inviteId: string, meta: RequestMeta): Promise<Result> {
    const denied = this.requireAdviser(cur);
    if (denied) return denied;
    await this.store.deleteInvite(cur.school.id, inviteId);
    await this.log("adviser.invite_revoked", { actor: cur.user, meta });
    return { ok: true };
  }

  async updateSchool(cur: CurrentSession, input: { studentDomains?: string[]; allowAiPlans?: boolean }, meta: RequestMeta): Promise<Result> {
    const denied = this.requireAdviser(cur);
    if (denied) return denied;
    const patch: Partial<School> = {};
    if (input.studentDomains) {
      const domains = [...new Set(input.studentDomains.map(normaliseDomain).filter(Boolean))];
      if (!domains.length || domains.length > 5) return fail(400, "Add between one and five student email domains.", "studentDomains");
      const problem = domains.map((d) => checkSchoolDomain(d)).find(Boolean);
      if (problem) return fail(400, problem, "studentDomains");
      patch.studentDomains = domains;
    }
    if (typeof input.allowAiPlans === "boolean") patch.allowAiPlans = input.allowAiPlans;
    await this.store.updateSchool(cur.school.id, patch);
    await this.log("school.updated", { actor: cur.user, meta, detail: patch as Record<string, unknown> });
    return { ok: true };
  }

  async regenerateJoinCode(cur: CurrentSession, meta: RequestMeta): Promise<Result<{ joinCode: string }>> {
    const denied = this.requireAdviser(cur);
    if (denied) return denied;
    for (let i = 0; i < 5; i++) {
      const joinCode = randomJoinCode();
      try {
        await this.store.updateSchool(cur.school.id, { joinCode });
        await this.log("school.join_code_changed", { actor: cur.user, meta });
        return { ok: true, joinCode };
      } catch (e) {
        if (!(e instanceof DuplicateError)) throw e;
      }
    }
    throw new Error("Couldn't create a unique join code");
  }

  /** Removes a student at the adviser's own school, with all their assessments. */
  async removeStudent(cur: CurrentSession, studentId: string, meta: RequestMeta): Promise<Result> {
    const denied = this.requireAdviser(cur);
    if (denied) return denied;
    const s = await this.store.getUser(studentId);
    if (!s || s.schoolId !== cur.school.id || s.role !== "student") return fail(404, "Student not found.");
    await this.store.deleteUser(s.id);
    await this.log("student.deleted", { actor: cur.user, target: s.id, meta, detail: { by: "adviser" } });
    return { ok: true };
  }

  async removeAdviser(cur: CurrentSession, adviserId: string, meta: RequestMeta): Promise<Result> {
    const denied = this.requireAdviser(cur);
    if (denied) return denied;
    if (adviserId === cur.user.id) return fail(400, "You can't remove yourself. Ask another adviser at your school.");
    const a = await this.store.getUser(adviserId);
    if (!a || a.schoolId !== cur.school.id || a.role !== "adviser") return fail(404, "Adviser not found.");
    await this.store.deleteUser(a.id);
    await this.log("adviser.removed", { actor: cur.user, target: a.id, meta });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Bcome operators (run from scripts, not the web app)
  // -------------------------------------------------------------------------

  async approveSchool(schoolId: string): Promise<Result> {
    const school = await this.store.getSchool(schoolId);
    if (!school) return fail(404, "School not found.");
    await this.store.updateSchool(schoolId, { status: "active", approvedAt: this.iso() });
    for (const a of await this.store.listUsers(schoolId, "adviser")) {
      await this.mailer.send(schoolApprovedEmail(a.email, school.name, school.joinCode, this.appUrl));
    }
    await this.log("school.approved", { schoolId });
    return { ok: true };
  }

  async setSchoolStatus(schoolId: string, status: "active" | "suspended"): Promise<Result> {
    await this.store.updateSchool(schoolId, { status });
    await this.log(`school.${status}`, { schoolId });
    return { ok: true };
  }
}

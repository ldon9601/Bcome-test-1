import { randomUUID } from "node:crypto";
import type { Role } from "./policy.ts";
import {
  DuplicateError,
  type AssessmentForAnalytics,
  type AssessmentRecord,
  type AssessmentSummary,
  type AuditEvent,
  type AuthStore,
  type Challenge,
  type ChallengePurpose,
  type Device,
  type Invite,
  type School,
  type SchoolStatus,
  type Session,
  type User,
} from "./store.ts";

const clone = <T>(x: T): T => structuredClone(x);

/** In-memory store for tests and for running locally without a database. Data is lost on restart. */
export class MemoryStore implements AuthStore {
  schools = new Map<string, School>();
  users = new Map<string, User>();
  sessions = new Map<string, Session>();
  devices = new Map<string, Device>();
  challenges = new Map<string, Challenge>();
  invites = new Map<string, Invite>();
  assessments = new Map<string, AssessmentRecord>();
  auditLog: (AuditEvent & { id: string })[] = [];
  hits = new Map<string, { windowStart: number; count: number }>();

  async createSchool(s: Omit<School, "id">) {
    if ([...this.schools.values()].some((x) => x.joinCode === s.joinCode)) throw new DuplicateError("join_code");
    const school = { ...clone(s), id: randomUUID() };
    this.schools.set(school.id, school);
    return clone(school);
  }
  async getSchool(id: string) {
    const s = this.schools.get(id);
    return s ? clone(s) : null;
  }
  async findSchoolByJoinCode(code: string) {
    const s = [...this.schools.values()].find((x) => x.joinCode === code);
    return s ? clone(s) : null;
  }
  async updateSchool(id: string, patch: Partial<School>) {
    const s = this.schools.get(id);
    if (!s) return;
    if (patch.joinCode && [...this.schools.values()].some((x) => x.id !== id && x.joinCode === patch.joinCode)) throw new DuplicateError("join_code");
    Object.assign(s, clone(patch));
  }
  async listSchools(status?: SchoolStatus) {
    return [...this.schools.values()].filter((s) => !status || s.status === status).map(clone);
  }

  async createUser(u: Omit<User, "id">) {
    const all = [...this.users.values()];
    if (all.some((x) => x.username === u.username)) throw new DuplicateError("username");
    if (all.some((x) => x.email === u.email)) throw new DuplicateError("email");
    const user = { ...clone(u), id: randomUUID() };
    this.users.set(user.id, user);
    return clone(user);
  }
  async getUser(id: string) {
    const u = this.users.get(id);
    return u ? clone(u) : null;
  }
  async findUserByUsername(username: string) {
    const u = [...this.users.values()].find((x) => x.username === username);
    return u ? clone(u) : null;
  }
  async findUserByEmail(email: string) {
    const u = [...this.users.values()].find((x) => x.email === email);
    return u ? clone(u) : null;
  }
  async updateUser(id: string, patch: Partial<User>) {
    const u = this.users.get(id);
    if (u) Object.assign(u, clone(patch));
  }
  async deleteUser(id: string) {
    this.users.delete(id);
    for (const m of [this.sessions, this.devices, this.challenges, this.assessments] as Map<string, { userId: string }>[]) {
      for (const [k, v] of m) if (v.userId === id) m.delete(k);
    }
  }
  async listUsers(schoolId: string, role?: Role) {
    return [...this.users.values()].filter((u) => u.schoolId === schoolId && (!role || u.role === role)).map(clone);
  }

  async createSession(s: Omit<Session, "id">) {
    const session = { ...clone(s), id: randomUUID() };
    this.sessions.set(session.id, session);
    return clone(session);
  }
  async findSessionByHash(tokenHash: string) {
    const s = [...this.sessions.values()].find((x) => x.tokenHash === tokenHash);
    return s ? clone(s) : null;
  }
  async updateSession(id: string, patch: Partial<Session>) {
    const s = this.sessions.get(id);
    if (s) Object.assign(s, patch);
  }
  async deleteSession(id: string) {
    this.sessions.delete(id);
  }
  async deleteUserSessions(userId: string, exceptId?: string) {
    for (const [k, v] of this.sessions) if (v.userId === userId && k !== exceptId) this.sessions.delete(k);
  }

  async createDevice(d: Omit<Device, "id">) {
    const device = { ...clone(d), id: randomUUID() };
    this.devices.set(device.id, device);
    return clone(device);
  }
  async findDevice(userId: string, tokenHash: string) {
    const d = [...this.devices.values()].find((x) => x.userId === userId && x.tokenHash === tokenHash);
    return d ? clone(d) : null;
  }
  async updateDevice(id: string, patch: Partial<Device>) {
    const d = this.devices.get(id);
    if (d) Object.assign(d, patch);
  }
  async listDevices(userId: string) {
    return [...this.devices.values()].filter((d) => d.userId === userId).map(clone);
  }
  async deleteDevice(userId: string, id: string) {
    const d = this.devices.get(id);
    if (d?.userId === userId) this.devices.delete(id);
  }
  async deleteUserDevices(userId: string) {
    for (const [k, v] of this.devices) if (v.userId === userId) this.devices.delete(k);
  }

  async createChallenge(c: Omit<Challenge, "id">) {
    const ch = { ...clone(c), id: randomUUID() };
    this.challenges.set(ch.id, ch);
    return clone(ch);
  }
  async findChallengeByHash(tokenHash: string) {
    const c = [...this.challenges.values()].find((x) => x.tokenHash === tokenHash);
    return c ? clone(c) : null;
  }
  async updateChallenge(id: string, patch: Partial<Challenge>) {
    const c = this.challenges.get(id);
    if (c) Object.assign(c, patch);
  }
  async deleteUserChallenges(userId: string, purpose?: ChallengePurpose) {
    for (const [k, v] of this.challenges) if (v.userId === userId && (!purpose || v.purpose === purpose)) this.challenges.delete(k);
  }

  async createInvite(i: Omit<Invite, "id">) {
    const inv = { ...clone(i), id: randomUUID() };
    this.invites.set(inv.id, inv);
    return clone(inv);
  }
  async findInviteByHash(tokenHash: string) {
    const i = [...this.invites.values()].find((x) => x.tokenHash === tokenHash);
    return i ? clone(i) : null;
  }
  async updateInvite(id: string, patch: Partial<Invite>) {
    const i = this.invites.get(id);
    if (i) Object.assign(i, patch);
  }
  async listInvites(schoolId: string) {
    return [...this.invites.values()].filter((i) => i.schoolId === schoolId).map(clone);
  }
  async deleteInvite(schoolId: string, id: string) {
    if (this.invites.get(id)?.schoolId === schoolId) this.invites.delete(id);
  }

  async saveAssessment(a: Omit<AssessmentRecord, "id">) {
    const rec = { ...clone(a), id: randomUUID() };
    this.assessments.set(rec.id, rec);
    return { id: rec.id };
  }
  async listAssessments(userId: string): Promise<AssessmentSummary[]> {
    return [...this.assessments.values()]
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .map(({ answers: _a, plan: _p, dna: _d, profile: _pr, ...rest }) => clone(rest));
  }
  async getAssessment(id: string) {
    const a = this.assessments.get(id);
    return a ? clone(a) : null;
  }
  async listSchoolAssessments(schoolId: string): Promise<AssessmentForAnalytics[]> {
    return [...this.assessments.values()]
      .filter((a) => a.schoolId === schoolId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .map(({ answers: _a, plan: _p, dna: _d, ...rest }) => clone(rest));
  }

  async audit(e: AuditEvent) {
    this.auditLog.push({ ...clone(e), id: String(this.auditLog.length + 1) });
  }
  async listAudit(schoolId: string, limit: number) {
    return this.auditLog.filter((e) => e.schoolId === schoolId).slice(-limit).reverse().map(clone);
  }

  async hit(key: string, windowMs: number, now: Date) {
    const t = now.getTime();
    const h = this.hits.get(key);
    if (!h || t - h.windowStart >= windowMs) {
      this.hits.set(key, { windowStart: t, count: 1 });
      return 1;
    }
    h.count += 1;
    return h.count;
  }
}

import { randomUUID } from "node:crypto";
import type { CardState, EventResponse, EvidenceInput, EvidenceItem, EventInput, MissionCompletion, SchoolEvent } from "../activity/types.ts";
import type { Role } from "./policy.ts";
import {
  DuplicateError,
  type AssessmentForAnalytics,
  type AssessmentRecord,
  type AssessmentSummary,
  type AuditEvent,
  type AuditFilter,
  type AuthStore,
  type RequestLogEntry,
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
  requests: RequestLogEntry[] = [];
  evidence = new Map<string, EvidenceItem>();
  missions = new Map<string, MissionCompletion>();
  events = new Map<string, SchoolEvent>();
  responses: EventResponse[] = [];
  cards: CardState[] = [];

  async createSchool(s: Omit<School, "id">) {
    if ([...this.schools.values()].some((x) => x.joinCode === s.joinCode)) throw new DuplicateError("join_code");
    const school = { kind: "school" as const, ...clone(s), id: randomUUID() };
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

  async deleteSchool(id: string) {
    for (const u of [...this.users.values()]) if (u.schoolId === id) await this.deleteUser(u.id);
    for (const [k, v] of this.events) if (v.schoolId === id) this.events.delete(k);
    for (const [k, v] of this.invites) if (v.schoolId === id) this.invites.delete(k);
    this.schools.delete(id);
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
    for (const m of [this.sessions, this.devices, this.challenges, this.assessments, this.evidence, this.missions] as Map<string, { userId: string }>[]) {
      for (const [k, v] of m) if (v.userId === id) m.delete(k);
    }
    this.responses = this.responses.filter((r) => r.userId !== id);
    this.cards = this.cards.filter((c) => c.userId !== id);
    for (const e of this.events.values()) if (e.createdBy === id) e.createdBy = null;
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

  // Activity: portfolio, missions, events and action cards
  async listEvidence(userId: string) {
    return [...this.evidence.values()].filter((e) => e.userId === userId).sort((a, b) => b.startMonth.localeCompare(a.startMonth) || b.createdAt.localeCompare(a.createdAt)).map(clone);
  }
  async createEvidence(e: Omit<EvidenceItem, "id">) {
    const item = { ...clone(e), id: randomUUID() };
    this.evidence.set(item.id, item);
    return clone(item);
  }
  async updateEvidence(userId: string, id: string, patch: Partial<EvidenceInput> & { updatedAt: string }) {
    const e = this.evidence.get(id);
    if (!e || e.userId !== userId) return false;
    Object.assign(e, clone(patch));
    return true;
  }
  async deleteEvidence(userId: string, id: string) {
    if (this.evidence.get(id)?.userId === userId) this.evidence.delete(id);
  }
  async countSchoolEvidence(schoolId: string) {
    const out: Record<string, number> = {};
    for (const e of this.evidence.values()) if (e.schoolId === schoolId) out[e.userId] = (out[e.userId] ?? 0) + 1;
    return out;
  }

  async listMissionCompletions(userId: string) {
    return [...this.missions.values()].filter((m) => m.userId === userId).sort((a, b) => b.week.localeCompare(a.week)).map(clone);
  }
  async createMissionCompletion(c: Omit<MissionCompletion, "id">) {
    if ([...this.missions.values()].some((m) => m.userId === c.userId && m.week === c.week)) return null;
    const rec = { ...clone(c), id: randomUUID() };
    this.missions.set(rec.id, rec);
    return clone(rec);
  }
  async listSchoolMissionCompletions(schoolId: string) {
    return [...this.missions.values()].filter((m) => m.schoolId === schoolId).map(({ userId, week, points, completedAt, title }) => ({ userId, week, points, completedAt, title }));
  }

  async listEvents(schoolId: string, from: string, to: string) {
    return [...this.events.values()]
      .filter((e) => e.schoolId === schoolId && e.startsOn <= to && (e.endsOn ?? e.startsOn) >= from)
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title))
      .map(clone);
  }
  async getEvent(schoolId: string, id: string) {
    const e = this.events.get(id);
    return e && e.schoolId === schoolId ? clone(e) : null;
  }
  async createEvent(e: Omit<SchoolEvent, "id">) {
    const ev = { ...clone(e), id: randomUUID() };
    this.events.set(ev.id, ev);
    return clone(ev);
  }
  async updateEvent(schoolId: string, id: string, patch: Partial<EventInput> & { updatedAt: string }) {
    const e = this.events.get(id);
    if (!e || e.schoolId !== schoolId) return false;
    Object.assign(e, clone(patch));
    return true;
  }
  async deleteEvent(schoolId: string, id: string) {
    if (this.events.get(id)?.schoolId === schoolId) {
      this.events.delete(id);
      this.responses = this.responses.filter((r) => r.eventId !== id);
    }
  }
  async countUpcomingEvents(schoolId: string, from: string) {
    return [...this.events.values()].filter((e) => e.schoolId === schoolId && (e.endsOn ?? e.startsOn) >= from).length;
  }

  async listEventResponses(userId: string) {
    return this.responses.filter((r) => r.userId === userId).map((r) => r.eventId);
  }
  async setEventResponse(r: EventResponse, interested: boolean) {
    this.responses = this.responses.filter((x) => !(x.userId === r.userId && x.eventId === r.eventId));
    if (interested && this.events.get(r.eventId)?.schoolId === r.schoolId) this.responses.push(clone(r));
  }
  async countEventResponses(schoolId: string) {
    const out: Record<string, number> = {};
    for (const r of this.responses) if (r.schoolId === schoolId) out[r.eventId] = (out[r.eventId] ?? 0) + 1;
    return out;
  }

  async listCardStates(userId: string) {
    return this.cards.filter((c) => c.userId === userId).map(clone);
  }
  async setCardState(s: CardState | (Omit<CardState, "status"> & { status: null })) {
    this.cards = this.cards.filter((c) => !(c.userId === s.userId && c.cardKey === s.cardKey));
    if (s.status) this.cards.push(clone(s as CardState));
  }

  // Platform administration
  async listAllUsers() {
    return [...this.users.values()].map(clone);
  }
  async listAllAssessments(): Promise<AssessmentForAnalytics[]> {
    return [...this.assessments.values()].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).map(({ answers: _a, plan: _p, dna: _d, ...rest }) => clone(rest));
  }
  async listAllAudit(f: AuditFilter) {
    return this.auditLog
      .filter((e) => (!f.event || e.event.startsWith(f.event)) && (!f.ip || e.ip === f.ip) && (!f.schoolId || e.schoolId === f.schoolId) && (!f.since || e.at >= f.since))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, f.limit)
      .map(clone);
  }
  async logRequest(e: RequestLogEntry) {
    this.requests.push(clone(e));
    if (this.requests.length > 20000) this.requests.splice(0, this.requests.length - 20000);
  }
  async listRequests(since: string, limit: number) {
    return this.requests
      .filter((r) => r.at >= since)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit)
      .map(clone);
  }
  async countActiveSessions(now: string) {
    return [...this.sessions.values()].filter((s) => s.expiresAt > now).length;
  }
  async purgeExpired(now: Date) {
    const t = now.toISOString();
    for (const [k, v] of this.sessions) if (v.expiresAt < t) this.sessions.delete(k);
    for (const [k, v] of this.devices) if (v.expiresAt < t) this.devices.delete(k);
    const day = new Date(now.getTime() - 864e5).toISOString();
    for (const [k, v] of this.challenges) if (v.expiresAt < day) this.challenges.delete(k);
    const auditCut = new Date(now.getTime() - 400 * 864e5).toISOString();
    this.auditLog = this.auditLog.filter((e) => e.at >= auditCut);
    const reqCut = new Date(now.getTime() - 30 * 864e5).toISOString();
    this.requests = this.requests.filter((r) => r.at >= reqCut);
  }
  async ping() {
    return true;
  }
}

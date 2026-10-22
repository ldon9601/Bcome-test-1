import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CardState, EventInput, EventResponse, EvidenceInput, EvidenceItem, MissionCompletion, SchoolEvent } from "../activity/types.ts";
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

/**
 * Production store: Supabase Postgres (Sydney) through PostgREST with the service role key.
 * Column names are the snake_case form of the TypeScript field names.
 */

type Row = Record<string, unknown>;
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
const out = (o: object): Row => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [toSnake(k), v]));
const inn = <T>(r: Row | null): T | null => (r ? (Object.fromEntries(Object.entries(r).map(([k, v]) => [toCamel(k), v])) as T) : null);
const many = <T>(rows: Row[] | null): T[] => (rows ?? []).map((r) => inn<T>(r)!);

const SUMMARY_COLUMNS = "id,user_id,school_id,completed_at,instrument_version,algorithm_version,year_level,holland_code,top_osca,top_title,matches";

function check<T>(res: { data: T; error: { code?: string; message: string } | null }): T {
  if (res.error) {
    if (res.error.code === "23505") {
      if (res.error.message.includes("username")) throw new DuplicateError("username");
      if (res.error.message.includes("email")) throw new DuplicateError("email");
      if (res.error.message.includes("join_code")) throw new DuplicateError("join_code");
    }
    throw new Error(`Database error: ${res.error.message}`);
  }
  return res.data;
}

export class SupabaseStore implements AuthStore {
  db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private async one<T>(table: string, col: string, val: string): Promise<T | null> {
    return inn<T>(check(await this.db.from(table).select("*").eq(col, val).maybeSingle()));
  }
  private async insert<T>(table: string, row: object): Promise<T> {
    return inn<T>(check(await this.db.from(table).insert(out(row)).select("*").single()))!;
  }
  private async patch(table: string, id: string, patch: object) {
    const p = out(patch);
    if (Object.keys(p).length) check(await this.db.from(table).update(p).eq("id", id));
  }

  createSchool(s: Omit<School, "id">) {
    return this.insert<School>("schools", s);
  }
  getSchool(id: string) {
    return this.one<School>("schools", "id", id);
  }
  findSchoolByJoinCode(code: string) {
    return this.one<School>("schools", "join_code", code);
  }
  updateSchool(id: string, patch: Partial<School>) {
    return this.patch("schools", id, patch);
  }
  async listSchools(status?: SchoolStatus) {
    let q = this.db.from("schools").select("*").order("created_at");
    if (status) q = q.eq("status", status);
    return many<School>(check(await q));
  }

  async deleteSchool(id: string) {
    check(await this.db.from("schools").delete().eq("id", id));
  }

  createUser(u: Omit<User, "id">) {
    return this.insert<User>("app_users", u);
  }
  getUser(id: string) {
    return this.one<User>("app_users", "id", id);
  }
  findUserByUsername(username: string) {
    return this.one<User>("app_users", "username", username);
  }
  findUserByEmail(email: string) {
    return this.one<User>("app_users", "email", email);
  }
  updateUser(id: string, patch: Partial<User>) {
    return this.patch("app_users", id, patch);
  }
  async deleteUser(id: string) {
    check(await this.db.from("app_users").delete().eq("id", id));
  }
  async listUsers(schoolId: string, role?: Role) {
    let q = this.db.from("app_users").select("*").eq("school_id", schoolId).order("last_name").order("first_name");
    if (role) q = q.eq("role", role);
    return many<User>(check(await q));
  }

  createSession(s: Omit<Session, "id">) {
    return this.insert<Session>("sessions", s);
  }
  findSessionByHash(tokenHash: string) {
    return this.one<Session>("sessions", "token_hash", tokenHash);
  }
  updateSession(id: string, patch: Partial<Session>) {
    return this.patch("sessions", id, patch);
  }
  async deleteSession(id: string) {
    check(await this.db.from("sessions").delete().eq("id", id));
  }
  async deleteUserSessions(userId: string, exceptId?: string) {
    let q = this.db.from("sessions").delete().eq("user_id", userId);
    if (exceptId) q = q.neq("id", exceptId);
    check(await q);
  }

  createDevice(d: Omit<Device, "id">) {
    return this.insert<Device>("trusted_devices", d);
  }
  async findDevice(userId: string, tokenHash: string) {
    return inn<Device>(check(await this.db.from("trusted_devices").select("*").eq("user_id", userId).eq("token_hash", tokenHash).maybeSingle()));
  }
  updateDevice(id: string, patch: Partial<Device>) {
    return this.patch("trusted_devices", id, patch);
  }
  async listDevices(userId: string) {
    return many<Device>(check(await this.db.from("trusted_devices").select("*").eq("user_id", userId).order("last_used_at", { ascending: false })));
  }
  async deleteDevice(userId: string, id: string) {
    check(await this.db.from("trusted_devices").delete().eq("user_id", userId).eq("id", id));
  }
  async deleteUserDevices(userId: string) {
    check(await this.db.from("trusted_devices").delete().eq("user_id", userId));
  }

  createChallenge(c: Omit<Challenge, "id">) {
    return this.insert<Challenge>("auth_challenges", c);
  }
  findChallengeByHash(tokenHash: string) {
    return this.one<Challenge>("auth_challenges", "token_hash", tokenHash);
  }
  updateChallenge(id: string, patch: Partial<Challenge>) {
    return this.patch("auth_challenges", id, patch);
  }
  async deleteUserChallenges(userId: string, purpose?: ChallengePurpose) {
    let q = this.db.from("auth_challenges").delete().eq("user_id", userId);
    if (purpose) q = q.eq("purpose", purpose);
    check(await q);
  }

  createInvite(i: Omit<Invite, "id">) {
    return this.insert<Invite>("adviser_invites", i);
  }
  findInviteByHash(tokenHash: string) {
    return this.one<Invite>("adviser_invites", "token_hash", tokenHash);
  }
  updateInvite(id: string, patch: Partial<Invite>) {
    return this.patch("adviser_invites", id, patch);
  }
  async listInvites(schoolId: string) {
    return many<Invite>(check(await this.db.from("adviser_invites").select("*").eq("school_id", schoolId).order("created_at", { ascending: false })));
  }
  async deleteInvite(schoolId: string, id: string) {
    check(await this.db.from("adviser_invites").delete().eq("school_id", schoolId).eq("id", id));
  }

  async saveAssessment(a: Omit<AssessmentRecord, "id">) {
    const row = check(await this.db.from("assessments").insert(out(a)).select("id").single()) as { id: string };
    return { id: row.id };
  }
  async listAssessments(userId: string) {
    return many<AssessmentSummary>(check(await this.db.from("assessments").select(SUMMARY_COLUMNS).eq("user_id", userId).order("completed_at", { ascending: false })));
  }
  getAssessment(id: string) {
    return this.one<AssessmentRecord>("assessments", "id", id);
  }
  async listSchoolAssessments(schoolId: string) {
    const rows = check(await this.db.from("assessments").select(`${SUMMARY_COLUMNS},profile`).eq("school_id", schoolId).order("completed_at", { ascending: false }).limit(20000));
    return many<AssessmentForAnalytics>(rows as Row[]);
  }

  async audit(e: AuditEvent) {
    check(await this.db.from("audit_log").insert(out(e)));
  }
  async listAudit(schoolId: string, limit: number) {
    const rows = check(await this.db.from("audit_log").select("*").eq("school_id", schoolId).order("at", { ascending: false }).limit(limit));
    return many<AuditEvent & { id: string }>(rows as Row[]).map((e) => ({ ...e, id: String(e.id) }));
  }

  async hit(key: string, windowMs: number) {
    return check(await this.db.rpc("rate_limit_hit", { p_key: key, p_window_ms: windowMs })) as number;
  }

  // Activity: portfolio, missions, events and action cards
  async listEvidence(userId: string) {
    return many<EvidenceItem>(check(await this.db.from("evidence_items").select("*").eq("user_id", userId).order("start_month", { ascending: false }).order("created_at", { ascending: false })));
  }
  createEvidence(e: Omit<EvidenceItem, "id">) {
    return this.insert<EvidenceItem>("evidence_items", e);
  }
  async updateEvidence(userId: string, id: string, patch: Partial<EvidenceInput> & { updatedAt: string }) {
    const rows = check(await this.db.from("evidence_items").update(out(patch)).eq("user_id", userId).eq("id", id).select("id")) as Row[];
    return rows.length > 0;
  }
  async deleteEvidence(userId: string, id: string) {
    check(await this.db.from("evidence_items").delete().eq("user_id", userId).eq("id", id));
  }
  async countSchoolEvidence(schoolId: string) {
    const rows = check(await this.db.from("evidence_items").select("user_id").eq("school_id", schoolId).limit(100000)) as { user_id: string }[];
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
    return counts;
  }

  async listMissionCompletions(userId: string) {
    return many<MissionCompletion>(check(await this.db.from("mission_completions").select("*").eq("user_id", userId).order("week", { ascending: false })));
  }
  async createMissionCompletion(c: Omit<MissionCompletion, "id">) {
    const res = await this.db.from("mission_completions").insert(out(c)).select("*").single();
    if (res.error?.code === "23505") return null;
    return inn<MissionCompletion>(check(res));
  }
  async listSchoolMissionCompletions(schoolId: string) {
    const rows = check(await this.db.from("mission_completions").select("user_id,week,points,completed_at,title").eq("school_id", schoolId).limit(100000));
    return many<Pick<MissionCompletion, "userId" | "week" | "points" | "completedAt" | "title">>(rows as Row[]);
  }

  async listEvents(schoolId: string, from: string, to: string) {
    // Overlap: starts on or before `to`, and ends (or starts, for one-day events) on or after `from`.
    const rows = check(
      await this.db
        .from("school_events")
        .select("*")
        .eq("school_id", schoolId)
        .lte("starts_on", to)
        .or(`ends_on.gte.${from},and(ends_on.is.null,starts_on.gte.${from})`)
        .order("starts_on")
        .order("title"),
    );
    return many<SchoolEvent>(rows as Row[]);
  }
  async getEvent(schoolId: string, id: string) {
    return inn<SchoolEvent>(check(await this.db.from("school_events").select("*").eq("school_id", schoolId).eq("id", id).maybeSingle()));
  }
  createEvent(e: Omit<SchoolEvent, "id">) {
    return this.insert<SchoolEvent>("school_events", e);
  }
  async updateEvent(schoolId: string, id: string, patch: Partial<EventInput> & { updatedAt: string }) {
    const rows = check(await this.db.from("school_events").update(out(patch)).eq("school_id", schoolId).eq("id", id).select("id")) as Row[];
    return rows.length > 0;
  }
  async deleteEvent(schoolId: string, id: string) {
    check(await this.db.from("school_events").delete().eq("school_id", schoolId).eq("id", id));
  }
  async countUpcomingEvents(schoolId: string, from: string) {
    const res = await this.db
      .from("school_events")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .or(`ends_on.gte.${from},and(ends_on.is.null,starts_on.gte.${from})`);
    check(res);
    return res.count ?? 0;
  }

  async listEventResponses(userId: string) {
    const rows = check(await this.db.from("event_responses").select("event_id").eq("user_id", userId)) as { event_id: string }[];
    return rows.map((r) => r.event_id);
  }
  async setEventResponse(r: EventResponse, interested: boolean) {
    if (!interested) {
      check(await this.db.from("event_responses").delete().eq("user_id", r.userId).eq("event_id", r.eventId));
      return;
    }
    check(await this.db.from("event_responses").upsert(out(r), { onConflict: "user_id,event_id", ignoreDuplicates: true }));
  }
  async countEventResponses(schoolId: string) {
    const rows = check(await this.db.from("event_responses").select("event_id").eq("school_id", schoolId).limit(100000)) as { event_id: string }[];
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
    return counts;
  }

  async listCardStates(userId: string) {
    return many<CardState>(check(await this.db.from("action_card_states").select("*").eq("user_id", userId)));
  }
  async setCardState(s: CardState | (Omit<CardState, "status"> & { status: null })) {
    if (!s.status) {
      check(await this.db.from("action_card_states").delete().eq("user_id", s.userId).eq("card_key", s.cardKey));
      return;
    }
    check(await this.db.from("action_card_states").upsert(out(s), { onConflict: "user_id,card_key" }));
  }
}

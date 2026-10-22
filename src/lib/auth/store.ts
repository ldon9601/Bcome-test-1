import type { ActivityStore } from "../activity/types.ts";
import type { Role } from "./policy.ts";
import type { AuState } from "./validation.ts";

/**
 * Persistence for accounts, sessions and assessments. Two implementations: MemoryStore (tests and
 * local development) and SupabaseStore (production, Postgres in Sydney). Every query that returns
 * student data takes a school id so one school can never read another's data (ST4S S4).
 * Times are ISO 8601 strings.
 */

export type SchoolStatus = "pending" | "active" | "suspended";

export interface School {
  id: string;
  name: string;
  state: AuState;
  /** Email domains students sign up with, e.g. ["education.nsw.gov.au"]. */
  studentDomains: string[];
  joinCode: string;
  status: SchoolStatus;
  /** ST4S AI controls: whether Claude may write students' plans (off by default; de-identified data only). */
  allowAiPlans: boolean;
  createdAt: string;
  approvedAt: string | null;
}

export interface User {
  id: string;
  schoolId: string;
  role: Role;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Students only. */
  yearLevel: number | null;
  birthYear: number | null;
  birthMonth: number | null;
  passwordHash: string;
  emailVerifiedAt: string | null;
  failedLogins: number;
  lockedUntil: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  remember: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface Device {
  id: string;
  userId: string;
  tokenHash: string;
  /** Coarse label such as "Chrome on Windows". Never the full user agent. */
  label: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export type ChallengePurpose = "verify_email" | "login" | "reset_password";

export interface Challenge {
  id: string;
  userId: string;
  purpose: ChallengePurpose;
  codeHash: string;
  tokenHash: string;
  attempts: number;
  sentCount: number;
  lastSentAt: string;
  expiresAt: string;
  consumedAt: string | null;
  remember: boolean;
  createdAt: string;
}

export interface Invite {
  id: string;
  schoolId: string;
  email: string;
  tokenHash: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface AssessmentRecord {
  id: string;
  userId: string;
  schoolId: string;
  completedAt: string;
  instrumentVersion: string;
  algorithmVersion: string;
  yearLevel: number | null;
  hollandCode: string;
  topOsca: string | null;
  topTitle: string | null;
  answers: unknown;
  profile: unknown;
  dna: unknown;
  matches: unknown[];
  plan: unknown;
}

/** What the dashboard reads: no raw answers or plan text. */
export type AssessmentForAnalytics = Omit<AssessmentRecord, "answers" | "plan" | "dna">;
export type AssessmentSummary = Omit<AssessmentRecord, "answers" | "plan" | "dna" | "profile">;

export interface AuditEvent {
  at: string;
  event: string;
  actorId: string | null;
  schoolId: string | null;
  targetId: string | null;
  ip: string | null;
  detail: Record<string, unknown>;
}

export class DuplicateError extends Error {
  field: "username" | "email" | "join_code";
  constructor(field: "username" | "email" | "join_code") {
    super(`${field} already in use`);
    this.field = field;
  }
}

type New<T> = Omit<T, "id">;

export interface AuthStore extends ActivityStore {
  createSchool(s: New<School>): Promise<School>;
  getSchool(id: string): Promise<School | null>;
  findSchoolByJoinCode(code: string): Promise<School | null>;
  updateSchool(id: string, patch: Partial<Omit<School, "id" | "createdAt">>): Promise<void>;
  listSchools(status?: SchoolStatus): Promise<School[]>;
  /** Removes the school and, by cascade, every account and record in it. Operator tool only. */
  deleteSchool(id: string): Promise<void>;

  createUser(u: New<User>): Promise<User>;
  getUser(id: string): Promise<User | null>;
  findUserByUsername(username: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, patch: Partial<Omit<User, "id" | "schoolId" | "role" | "createdAt">>): Promise<void>;
  /** Removes the user and, by cascade, their sessions, devices, challenges and assessments. */
  deleteUser(id: string): Promise<void>;
  listUsers(schoolId: string, role?: Role): Promise<User[]>;

  createSession(s: New<Session>): Promise<Session>;
  findSessionByHash(tokenHash: string): Promise<Session | null>;
  updateSession(id: string, patch: Partial<Pick<Session, "lastSeenAt" | "expiresAt">>): Promise<void>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string, exceptId?: string): Promise<void>;

  createDevice(d: New<Device>): Promise<Device>;
  findDevice(userId: string, tokenHash: string): Promise<Device | null>;
  updateDevice(id: string, patch: Partial<Pick<Device, "lastUsedAt" | "expiresAt">>): Promise<void>;
  listDevices(userId: string): Promise<Device[]>;
  deleteDevice(userId: string, id: string): Promise<void>;
  deleteUserDevices(userId: string): Promise<void>;

  createChallenge(c: New<Challenge>): Promise<Challenge>;
  findChallengeByHash(tokenHash: string): Promise<Challenge | null>;
  updateChallenge(id: string, patch: Partial<Pick<Challenge, "codeHash" | "attempts" | "sentCount" | "lastSentAt" | "expiresAt" | "consumedAt">>): Promise<void>;
  deleteUserChallenges(userId: string, purpose?: ChallengePurpose): Promise<void>;

  createInvite(i: New<Invite>): Promise<Invite>;
  findInviteByHash(tokenHash: string): Promise<Invite | null>;
  updateInvite(id: string, patch: Partial<Pick<Invite, "acceptedAt">>): Promise<void>;
  listInvites(schoolId: string): Promise<Invite[]>;
  deleteInvite(schoolId: string, id: string): Promise<void>;

  saveAssessment(a: New<AssessmentRecord>): Promise<{ id: string }>;
  listAssessments(userId: string): Promise<AssessmentSummary[]>;
  getAssessment(id: string): Promise<AssessmentRecord | null>;
  listSchoolAssessments(schoolId: string): Promise<AssessmentForAnalytics[]>;

  audit(e: AuditEvent): Promise<void>;
  listAudit(schoolId: string, limit: number): Promise<(AuditEvent & { id: string })[]>;

  /** Counts a hit against a fixed window and returns the count so far, atomically. */
  hit(key: string, windowMs: number, now: Date): Promise<number>;
}

/**
 * Student activity after the Career Profile: the Skills Evidence Portfolio, Weekly Career
 * Missions, Real-World Action Cards and the school's opportunity calendar. Stored per student and
 * always queried with the student's or school's id (ST4S S4). Removed with the account.
 */

export const EVIDENCE_CATEGORIES = ["school", "sport", "work", "volunteering", "other"] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export interface EvidenceItem {
  id: string;
  userId: string;
  schoolId: string;
  category: EvidenceCategory;
  /** What they did, e.g. "Captain, under-16 netball team". */
  title: string;
  /** Where, e.g. "Northside Netball Club". Optional. */
  organisation: string | null;
  /** "YYYY-MM". */
  startMonth: string;
  /** "YYYY-MM", or null if ongoing. */
  endMonth: string | null;
  /** What they did and what came of it. */
  description: string;
  /** Skill labels the student chose (employability skills and skills from their career matches). */
  skills: string[];
  createdAt: string;
  updatedAt: string;
}
export type EvidenceInput = Pick<EvidenceItem, "category" | "title" | "organisation" | "startMonth" | "endMonth" | "description" | "skills">;

export interface MissionCompletion {
  id: string;
  userId: string;
  schoolId: string;
  /** ISO week in the school's time zone, e.g. "2026-W43". One mission per week. */
  week: string;
  missionId: string;
  /** Snapshot of the mission as shown, so history reads the same after the library changes. */
  title: string;
  careerOsca: string | null;
  careerTitle: string | null;
  reflection: string;
  points: number;
  completedAt: string;
}

export const EVENT_KINDS = ["open_day", "work_experience", "competition", "expo", "talk", "workshop", "deadline", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface SchoolEvent {
  id: string;
  schoolId: string;
  createdBy: string | null;
  kind: EventKind;
  title: string;
  /** "YYYY-MM-DD", in the school's local time. */
  startsOn: string;
  endsOn: string | null;
  /** Free text such as "9am to 3pm". */
  time: string | null;
  location: string | null;
  url: string | null;
  description: string;
  /** Empty means every year level. */
  yearLevels: number[];
  /** Career families this suits (empty means everyone). */
  families: string[];
  createdAt: string;
  updatedAt: string;
}
export type EventInput = Pick<SchoolEvent, "kind" | "title" | "startsOn" | "endsOn" | "time" | "location" | "url" | "description" | "yearLevels" | "families">;

export interface EventResponse {
  userId: string;
  schoolId: string;
  eventId: string;
  createdAt: string;
}

export type CardStatus = "done" | "dismissed";
export interface CardState {
  userId: string;
  schoolId: string;
  /** "<YYYY-MM>:<kind>:<reference>", e.g. "2026-10:talk:254111". */
  cardKey: string;
  status: CardStatus;
  updatedAt: string;
}

type New<T> = Omit<T, "id">;

export interface ActivityStore {
  listEvidence(userId: string): Promise<EvidenceItem[]>;
  createEvidence(e: New<EvidenceItem>): Promise<EvidenceItem>;
  updateEvidence(userId: string, id: string, patch: Partial<EvidenceInput> & { updatedAt: string }): Promise<boolean>;
  deleteEvidence(userId: string, id: string): Promise<void>;
  /** Number of evidence items per student, for the adviser dashboard. */
  countSchoolEvidence(schoolId: string): Promise<Record<string, number>>;

  listMissionCompletions(userId: string): Promise<MissionCompletion[]>;
  /** Returns null if this student already completed a mission that week. */
  createMissionCompletion(c: New<MissionCompletion>): Promise<MissionCompletion | null>;
  listSchoolMissionCompletions(schoolId: string): Promise<Pick<MissionCompletion, "userId" | "week" | "points" | "completedAt" | "title">[]>;

  /** Events overlapping [from, to] (inclusive "YYYY-MM-DD"). */
  listEvents(schoolId: string, from: string, to: string): Promise<SchoolEvent[]>;
  getEvent(schoolId: string, id: string): Promise<SchoolEvent | null>;
  createEvent(e: New<SchoolEvent>): Promise<SchoolEvent>;
  updateEvent(schoolId: string, id: string, patch: Partial<EventInput> & { updatedAt: string }): Promise<boolean>;
  deleteEvent(schoolId: string, id: string): Promise<void>;
  countUpcomingEvents(schoolId: string, from: string): Promise<number>;

  listEventResponses(userId: string): Promise<string[]>;
  setEventResponse(r: EventResponse, interested: boolean): Promise<void>;
  /** Interested students per event id. */
  countEventResponses(schoolId: string): Promise<Record<string, number>>;

  listCardStates(userId: string): Promise<CardState[]>;
  setCardState(s: CardState | (Omit<CardState, "status"> & { status: null })): Promise<void>;
}

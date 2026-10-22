import type { CurrentSession, Fail, RequestMeta, Result } from "../auth/service.ts";
import type { AuthStore, User } from "../auth/store.ts";
import { occupationData, skillsData, subjectLabels } from "../data.ts";
import { actionCards, eventFor, type ActionCard } from "./cards.ts";
import { checkEvidence, EMPLOYABILITY_SKILLS, LIMITS } from "./evidence.ts";
import { checkEvent } from "./events.ts";
import { localDate, missionForWeek, pointsSummary, weekOf, mondayOf, type Mission, type PointsSummary } from "./missions.ts";
import { studentContext, type StudentContext } from "./student.ts";
import type { CardStatus, EvidenceItem, MissionCompletion, SchoolEvent } from "./types.ts";

/**
 * The Discover hub after a student's Career Profile: portfolio, weekly missions, action cards
 * and the opportunity calendar. Every method takes the signed-in session and only touches that
 * student's (or that adviser's school's) records.
 */

const fail = (status: number, error: string, field?: string): Fail => ({ ok: false, status, error, field });
const MAX_EVENTS_PER_SCHOOL = 1000;

export interface HubData {
  today: string;
  week: string;
  weekStarts: string;
  hasResults: boolean;
  firstName: string;
  mission: Mission | null;
  /** This week's completed mission, if done. */
  completed: MissionCompletion | null;
  points: PointsSummary;
  recentMissions: MissionCompletion[];
  cards: ActionCard[];
  events: (SchoolEvent & { forYear: boolean; matchesCareer: boolean })[];
  interested: string[];
  evidence: EvidenceItem[];
  skillOptions: { employability: string[]; career: string[] };
}

function addMonths(ymd: string, n: number): string {
  const d = new Date(`${ymd.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export class ActivityService {
  store: AuthStore;
  now: () => Date;
  constructor(store: AuthStore, now: () => Date = () => new Date()) {
    this.store = store;
    this.now = now;
  }

  today(cur: CurrentSession) {
    return localDate(this.now(), cur.school.state);
  }

  private async log(cur: CurrentSession, event: string, target: string | null, meta?: RequestMeta, detail: Record<string, unknown> = {}) {
    await this.store.audit({ at: this.now().toISOString(), event, actorId: cur.user.id, schoolId: cur.school.id, targetId: target, ip: meta?.ip ?? null, detail });
  }

  /** The student's latest results, read the way missions and cards need them. */
  async student(cur: CurrentSession): Promise<StudentContext> {
    const [latest] = await this.store.listAssessments(cur.user.id);
    const full = latest ? await this.store.getAssessment(latest.id) : null;
    return studentContext(cur.user, cur.school, full && full.userId === cur.user.id ? { matches: full.matches, profile: full.profile } : null, subjectLabels);
  }

  skillOptions(s: StudentContext) {
    const label = new Map(skillsData.skills.map((k) => [k.id, k.prefLabel]));
    const career = new Set<string>();
    for (const c of s.careers.slice(0, 3)) {
      const occ = occupationData.occupations.find((o) => o.osca === c.osca);
      for (const id of occ?.skills ?? []) {
        const l = label.get(id);
        if (l) career.add(l);
      }
    }
    return { employability: [...EMPLOYABILITY_SKILLS], career: [...career].slice(0, 14) };
  }

  async hub(cur: CurrentSession): Promise<HubData> {
    const today = this.today(cur);
    const week = weekOf(today);
    const s = await this.student(cur);
    const [completions, evidence, events, interested, states] = await Promise.all([
      this.store.listMissionCompletions(cur.user.id),
      this.store.listEvidence(cur.user.id),
      this.store.listEvents(cur.school.id, addMonths(today, -1), addMonths(today, 7)),
      this.store.listEventResponses(cur.user.id),
      this.store.listCardStates(cur.user.id),
    ]);
    const completed = completions.find((c) => c.week === week) ?? null;
    const visible = events.map((e) => ({ ...e, ...eventFor(e, s) })).filter((e) => e.forYear);
    return {
      today,
      week,
      weekStarts: mondayOf(week),
      hasResults: s.careers.length > 0,
      firstName: cur.user.firstName,
      mission: missionForWeek(s, week, completions),
      completed,
      points: pointsSummary(week, completions),
      recentMissions: completions.slice(0, 6),
      cards: actionCards(s, today.slice(0, 7), events, states, today),
      events: visible,
      interested: interested.filter((id) => visible.some((e) => e.id === id)),
      evidence,
      skillOptions: this.skillOptions(s),
    };
  }

  // -------------------------------------------------------------------------
  // Skills Evidence Portfolio
  // -------------------------------------------------------------------------

  private studentOnly(cur: CurrentSession): Fail | null {
    return cur.user.role === "student" ? null : fail(403, "Only students have a portfolio and missions.");
  }

  async addEvidence(cur: CurrentSession, body: Record<string, unknown>): Promise<Result<{ item: EvidenceItem }>> {
    const denied = this.studentOnly(cur);
    if (denied) return denied;
    const v = checkEvidence(body, this.now());
    if (!v.ok) return fail(400, v.error, v.field);
    const existing = await this.store.listEvidence(cur.user.id);
    if (existing.length >= LIMITS.items) return fail(400, `You can keep up to ${LIMITS.items} entries. Remove an old one first.`);
    const at = this.now().toISOString();
    const item = await this.store.createEvidence({ ...v.value, userId: cur.user.id, schoolId: cur.school.id, createdAt: at, updatedAt: at });
    return { ok: true, item };
  }

  async updateEvidence(cur: CurrentSession, id: string, body: Record<string, unknown>): Promise<Result<{ item: EvidenceItem }>> {
    const denied = this.studentOnly(cur);
    if (denied) return denied;
    const v = checkEvidence(body, this.now());
    if (!v.ok) return fail(400, v.error, v.field);
    const updatedAt = this.now().toISOString();
    if (!(await this.store.updateEvidence(cur.user.id, id, { ...v.value, updatedAt }))) return fail(404, "That entry wasn't found.");
    const item = (await this.store.listEvidence(cur.user.id)).find((e) => e.id === id)!;
    return { ok: true, item };
  }

  async deleteEvidence(cur: CurrentSession, id: string): Promise<Result> {
    const denied = this.studentOnly(cur);
    if (denied) return denied;
    await this.store.deleteEvidence(cur.user.id, id);
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Weekly Career Missions
  // -------------------------------------------------------------------------

  async completeMission(
    cur: CurrentSession,
    input: { missionId: string; reflection: string; addToPortfolio: boolean },
    meta?: RequestMeta,
  ): Promise<Result<{ completion: MissionCompletion; points: PointsSummary; evidence: EvidenceItem | null }>> {
    const denied = this.studentOnly(cur);
    if (denied) return denied;
    const reflection = input.reflection.trim();
    if (reflection.length < 10) return fail(400, "Write a sentence about what you did or found out.", "reflection");
    if (reflection.length > 600) return fail(400, "Keep your note under 600 characters.", "reflection");
    const today = this.today(cur);
    const week = weekOf(today);
    const s = await this.student(cur);
    const completions = await this.store.listMissionCompletions(cur.user.id);
    if (completions.some((c) => c.week === week)) return fail(409, "You've already done this week's mission. A new one unlocks on Monday.");
    const mission = missionForWeek(s, week, completions);
    if (!mission) return fail(400, "Complete your Career Profile first to get missions.");
    if (mission.id !== input.missionId) return fail(409, "Your mission has changed (for example, after new results). Refresh to see this week's mission.");
    const completion = await this.store.createMissionCompletion({
      userId: cur.user.id,
      schoolId: cur.school.id,
      week,
      missionId: mission.id,
      title: mission.title,
      careerOsca: mission.career?.osca ?? null,
      careerTitle: mission.career?.title ?? null,
      reflection,
      points: mission.points,
      completedAt: this.now().toISOString(),
    });
    if (!completion) return fail(409, "You've already done this week's mission. A new one unlocks on Monday.");
    let evidence: EvidenceItem | null = null;
    if (input.addToPortfolio) {
      const r = await this.addEvidence(cur, {
        category: "other",
        title: mission.title.slice(0, 120),
        organisation: "Bcome Weekly Career Mission",
        startMonth: today.slice(0, 7),
        endMonth: today.slice(0, 7),
        description: reflection,
        skills: mission.kind === "talk" ? ["Communication", "Initiative"] : mission.kind === "do" ? ["Initiative", "Problem solving"] : ["Initiative", "Learning new things quickly"],
      });
      if (r.ok) evidence = r.item;
    }
    await this.log(cur, "mission.completed", null, meta, { week, missionId: mission.id, points: mission.points });
    return { ok: true, completion, points: pointsSummary(week, [completion, ...completions]), evidence };
  }

  // -------------------------------------------------------------------------
  // Action cards and the calendar
  // -------------------------------------------------------------------------

  async setCard(cur: CurrentSession, cardKey: string, status: CardStatus | null): Promise<Result> {
    const denied = this.studentOnly(cur);
    if (denied) return denied;
    if (!/^\d{4}-\d{2}:(talk|attend|investigate):[\w.-]{1,80}$/.test(cardKey)) return fail(400, "Unknown card.");
    await this.store.setCardState({ userId: cur.user.id, schoolId: cur.school.id, cardKey, status, updatedAt: this.now().toISOString() } as Parameters<AuthStore["setCardState"]>[0]);
    return { ok: true };
  }

  async setInterest(cur: CurrentSession, eventId: string, interested: boolean): Promise<Result> {
    const denied = this.studentOnly(cur);
    if (denied) return denied;
    const e = await this.store.getEvent(cur.school.id, eventId);
    if (!e) return fail(404, "That event wasn't found.");
    await this.store.setEventResponse({ userId: cur.user.id, schoolId: cur.school.id, eventId, createdAt: this.now().toISOString() }, interested);
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Advisers: the school's opportunity calendar
  // -------------------------------------------------------------------------

  private adviserOnly(cur: CurrentSession): Fail | null {
    return cur.user.role === "adviser" ? null : fail(403, "Only careers advisers can change the school calendar.");
  }

  async schoolEvents(cur: CurrentSession, opts: { pastMonths?: number; aheadMonths?: number } = {}) {
    const today = this.today(cur);
    const [events, counts] = await Promise.all([
      this.store.listEvents(cur.school.id, addMonths(today, -(opts.pastMonths ?? 3)), addMonths(today, opts.aheadMonths ?? 18)),
      this.store.countEventResponses(cur.school.id),
    ]);
    return { today, events: events.map((e) => ({ ...e, interested: counts[e.id] ?? 0 })) };
  }

  async createEvent(cur: CurrentSession, body: Record<string, unknown>, meta?: RequestMeta): Promise<Result<{ event: SchoolEvent }>> {
    const denied = this.adviserOnly(cur);
    if (denied) return denied;
    const today = this.today(cur);
    const v = checkEvent(body, today);
    if (!v.ok) return fail(400, v.error, v.field);
    if ((await this.store.countUpcomingEvents(cur.school.id, addMonths(today, -24))) >= MAX_EVENTS_PER_SCHOOL) return fail(400, "Your calendar is full. Remove some old events first.");
    const at = this.now().toISOString();
    const event = await this.store.createEvent({ ...v.value, schoolId: cur.school.id, createdBy: cur.user.id, createdAt: at, updatedAt: at });
    await this.log(cur, "event.created", event.id, meta, { title: event.title, startsOn: event.startsOn });
    return { ok: true, event };
  }

  async updateEvent(cur: CurrentSession, id: string, body: Record<string, unknown>, meta?: RequestMeta): Promise<Result<{ event: SchoolEvent }>> {
    const denied = this.adviserOnly(cur);
    if (denied) return denied;
    const v = checkEvent(body, this.today(cur));
    if (!v.ok) return fail(400, v.error, v.field);
    if (!(await this.store.updateEvent(cur.school.id, id, { ...v.value, updatedAt: this.now().toISOString() }))) return fail(404, "That event wasn't found.");
    await this.log(cur, "event.updated", id, meta, { title: v.value.title });
    return { ok: true, event: (await this.store.getEvent(cur.school.id, id))! };
  }

  async deleteEvent(cur: CurrentSession, id: string, meta?: RequestMeta): Promise<Result> {
    const denied = this.adviserOnly(cur);
    if (denied) return denied;
    const e = await this.store.getEvent(cur.school.id, id);
    if (!e) return fail(404, "That event wasn't found.");
    await this.store.deleteEvent(cur.school.id, id);
    await this.log(cur, "event.deleted", id, meta, { title: e.title });
    return { ok: true };
  }

  /** Dashboard engagement figures for a school. */
  async engagement(schoolId: string, students: User[], today: string) {
    const week = weekOf(today);
    const [missions, evidence, upcoming] = await Promise.all([
      this.store.listSchoolMissionCompletions(schoolId),
      this.store.countSchoolEvidence(schoolId),
      this.store.countUpcomingEvents(schoolId, today),
    ]);
    const ids = new Set(students.map((u) => u.id));
    const mine = missions.filter((m) => ids.has(m.userId));
    const byStudent = new Map<string, { points: number; missions: number; lastWeek: string | null }>();
    for (const m of mine) {
      const s = byStudent.get(m.userId) ?? { points: 0, missions: 0, lastWeek: null };
      s.points += m.points;
      s.missions += 1;
      if (!s.lastWeek || m.week > s.lastWeek) s.lastWeek = m.week;
      byStudent.set(m.userId, s);
    }
    const missionCounts = new Map<string, number>();
    for (const m of mine) missionCounts.set(m.title, (missionCounts.get(m.title) ?? 0) + 1);
    return {
      week,
      missionsThisWeek: mine.filter((m) => m.week === week).length,
      missionsTotal: mine.length,
      activeStudents: byStudent.size,
      studentsWithPortfolio: Object.keys(evidence).filter((id) => ids.has(id) && evidence[id] > 0).length,
      evidenceItems: Object.entries(evidence).filter(([id]) => ids.has(id)).reduce((t, [, n]) => t + n, 0),
      upcomingEvents: upcoming,
      byStudent: Object.fromEntries([...byStudent].map(([id, v]) => [id, { ...v, evidence: evidence[id] ?? 0 }])),
      evidenceByStudent: evidence,
      popularMissions: [...missionCounts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value })),
    };
  }
}

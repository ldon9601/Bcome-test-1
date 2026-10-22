import type { AssessmentForAnalytics, AuditEvent, RequestLogEntry, School, User } from "../auth/store.ts";

/**
 * Platform-wide figures for Bcome administrators: users by segment, schools, assessment results
 * and subjects, plus traffic, security and incoming IP addresses from the request and audit logs.
 * Pure functions over store data, so they're easy to test.
 */

type Profile = { educationPaths?: string[]; currentSubjects?: string[] };
type SavedMatch = { title?: string; family?: string };

export interface Count {
  key: string;
  label: string;
  count: number;
}

const tally = (items: string[], labels: Record<string, string> = {}): Count[] => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m].map(([key, count]) => ({ key, label: labels[key] ?? key, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

/** The most recent assessment for each student. */
export function latestByStudent(assessments: AssessmentForAnalytics[]): Map<string, AssessmentForAnalytics> {
  const latest = new Map<string, AssessmentForAnalytics>();
  for (const a of assessments) {
    const cur = latest.get(a.userId);
    if (!cur || a.completedAt > cur.completedAt) latest.set(a.userId, a);
  }
  return latest;
}

export const PATHWAY_SEGMENTS: { key: string; label: string; paths: string[] }[] = [
  { key: "university", label: "University", paths: ["university"] },
  { key: "tafe", label: "TAFE, VET or apprenticeship", paths: ["vet", "apprenticeship"] },
  { key: "other", label: "Other (work, business, defence, gap year)", paths: ["work_learn", "business", "defence_public", "gap_year"] },
  { key: "unsure", label: "Not sure yet", paths: ["unsure"] },
];

const RIASEC_NAMES: Record<string, string> = { R: "Realistic", I: "Investigative", A: "Artistic", S: "Social", E: "Enterprising", C: "Conventional" };

export function platformAnalytics(input: { users: User[]; schools: School[]; assessments: AssessmentForAnalytics[]; subjectLabels: Record<string, string>; now: Date }) {
  const { users, assessments, subjectLabels, now } = input;
  const schools = input.schools.filter((s) => s.kind !== "platform");
  const schoolIds = new Set(schools.map((s) => s.id));
  const students = users.filter((u) => u.role === "student" && schoolIds.has(u.schoolId));
  const studentIds = new Set(students.map((s) => s.id));
  const real = assessments.filter((a) => studentIds.has(a.userId));
  const latest = latestByStudent(real);
  const profiles = [...latest.values()].map((a) => (a.profile ?? {}) as Profile);

  const byYear = [10, 11, 12].map((y) => ({ key: `y${y}`, label: `Year ${y}`, count: students.filter((s) => s.yearLevel === y).length }));
  const pathways = PATHWAY_SEGMENTS.map((seg) => ({ key: seg.key, label: seg.label, count: profiles.filter((p) => (p.educationPaths ?? []).some((x) => seg.paths.includes(x))).length }));
  const notAssessed = students.length - latest.size;
  // One segment per student, so the figures add up: university if they'd consider it, then TAFE/VET,
  // then any other route, otherwise unsure.
  const segmentOf = (p: Profile) => {
    const paths = p.educationPaths ?? [];
    return PATHWAY_SEGMENTS.find((seg) => seg.key !== "unsure" && paths.some((x) => seg.paths.includes(x)))?.key ?? "unsure";
  };
  const exclusive = PATHWAY_SEGMENTS.map((seg) => ({ key: seg.key, label: seg.label, count: profiles.filter((p) => segmentOf(p) === seg.key).length }));

  const day = 864e5;
  const since30 = new Date(now.getTime() - 30 * day).toISOString();
  const months: { key: string; label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({ key, label: d.toLocaleDateString("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" }), count: real.filter((a) => a.completedAt.startsWith(key)).length });
  }

  const schoolRows = schools
    .map((s) => {
      const ss = students.filter((u) => u.schoolId === s.id);
      const done = ss.filter((u) => latest.has(u.id)).length;
      const last = real.filter((a) => a.schoolId === s.id).reduce<string | null>((m, a) => (!m || a.completedAt > m ? a.completedAt : m), null);
      return { id: s.id, name: s.name, state: s.state, status: s.status, joinCode: s.joinCode, createdAt: s.createdAt, students: ss.length, advisers: users.filter((u) => u.role === "adviser" && u.schoolId === s.id).length, completed: done, lastAssessment: last };
    })
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));

  const stateOf = new Map(schools.map((s) => [s.id, s.state]));
  return {
    totals: {
      users: users.filter((u) => u.role !== "admin").length,
      students: students.length,
      advisers: users.filter((u) => u.role === "adviser").length,
      admins: users.filter((u) => u.role === "admin").length,
      schools: schools.length,
      assessments: real.length,
      studentsAssessed: latest.size,
      completionRate: students.length ? Math.round((latest.size / students.length) * 100) : 0,
      last30Days: real.filter((a) => a.completedAt >= since30).length,
      newStudents30Days: students.filter((s) => s.createdAt >= since30).length,
    },
    segments: { byYear, pathways, exclusive, notAssessed },
    schools: {
      byStatus: tally(schools.map((s) => s.status), { active: "Active", pending: "Waiting for approval", suspended: "Suspended" }),
      byState: tally(schools.map((s) => s.state)),
      rows: schoolRows,
    },
    studentsByState: tally(students.map((s) => stateOf.get(s.schoolId) ?? "?")),
    assessments: {
      byMonth: months,
      topCareers: tally([...latest.values()].map((a) => a.topTitle ?? "").filter(Boolean)).slice(0, 12),
      families: tally([...latest.values()].map((a) => ((a.matches?.[0] ?? {}) as SavedMatch).family ?? "").filter(Boolean)).slice(0, 12),
      hollandPrimary: tally([...latest.values()].map((a) => a.hollandCode?.[0] ?? "").filter(Boolean), RIASEC_NAMES),
    },
    subjects: tally(profiles.flatMap((p) => p.currentSubjects ?? []), subjectLabels),
  };
}
export type PlatformAnalytics = ReturnType<typeof platformAnalytics>;

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

/** API traffic over the last 24 hours, by hour and by route. */
export function trafficStats(requests: RequestLogEntry[], now: Date) {
  const since = now.getTime() - 24 * 3600e3;
  const recent = requests.filter((r) => Date.parse(r.at) >= since);
  const hours = Array.from({ length: 24 }, (_, i) => {
    const start = since + i * 3600e3;
    const inHour = recent.filter((r) => Date.parse(r.at) >= start && Date.parse(r.at) < start + 3600e3);
    return { start: new Date(start).toISOString(), count: inHour.length, errors: inHour.filter((r) => r.status >= 500).length };
  });
  const routes = new Map<string, RequestLogEntry[]>();
  for (const r of recent) {
    // Group career pages together so the table stays short.
    const key = `${r.method} ${r.path.replace(/^\/api\/careers\/[^/]+\//, "/api/careers/:osca/")}`;
    routes.set(key, [...(routes.get(key) ?? []), r]);
  }
  return {
    total: recent.length,
    serverErrors: recent.filter((r) => r.status >= 500).length,
    clientErrors: recent.filter((r) => r.status >= 400 && r.status < 500).length,
    p50: percentile(recent.map((r) => r.ms), 50),
    p95: percentile(recent.map((r) => r.ms), 95),
    hours,
    routes: [...routes]
      .map(([route, rs]) => ({ route, count: rs.length, errors: rs.filter((r) => r.status >= 400).length, avgMs: Math.round(rs.reduce((t, r) => t + r.ms, 0) / rs.length) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
  };
}

const FAILURE_EVENTS = new Set(["login.failed", "login.locked", "login.blocked", "code.failed", "login.wrong_portal"]);

/** Incoming IP addresses in the last 24 hours, with requests, sign-ins and failures. */
export function ipStats(requests: RequestLogEntry[], audit: AuditEvent[], now: Date, limit = 25) {
  const since = new Date(now.getTime() - 24 * 3600e3).toISOString();
  const ips = new Map<string, { ip: string; requests: number; signIns: number; failures: number; lastSeen: string; userAgent: string | null }>();
  const get = (ip: string) => {
    let e = ips.get(ip);
    if (!e) ips.set(ip, (e = { ip, requests: 0, signIns: 0, failures: 0, lastSeen: "", userAgent: null }));
    return e;
  };
  for (const r of requests) {
    if (r.at < since || !r.ip) continue;
    const e = get(r.ip);
    e.requests += 1;
    if (r.at > e.lastSeen) {
      e.lastSeen = r.at;
      e.userAgent = r.userAgent;
    }
  }
  for (const a of audit) {
    if (a.at < since || !a.ip) continue;
    const e = get(a.ip);
    if (a.event === "login.success") e.signIns += 1;
    if (FAILURE_EVENTS.has(a.event)) e.failures += 1;
    if (a.at > e.lastSeen) e.lastSeen = a.at;
  }
  return [...ips.values()]
    .map((e) => ({ ...e, flagged: e.failures >= 5 }))
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.requests + b.failures - (a.requests + a.failures))
    .slice(0, limit);
}

/** Sign-in and security events in the last 24 hours. */
export function securityStats(audit: AuditEvent[], now: Date) {
  const since = new Date(now.getTime() - 24 * 3600e3).toISOString();
  const recent = audit.filter((a) => a.at >= since);
  const n = (e: string) => recent.filter((a) => a.event === e).length;
  return {
    signIns: n("login.success"),
    failed: n("login.failed"),
    locked: n("login.locked"),
    wrongCodes: n("code.failed"),
    newDevices: n("login.new_device"),
    passwordResets: n("password.reset") + n("password.set_by_link"),
    adminActions: recent.filter((a) => a.event.startsWith("admin.")).length,
  };
}

export function auditCsv(rows: (AuditEvent & { id: string })[], names: Map<string, string>): string {
  const head = ["time", "event", "actor", "school", "target", "ip", "detail"];
  return [head.join(","), ...rows.map((r) => [r.at, r.event, names.get(r.actorId ?? "") ?? r.actorId, names.get(r.schoolId ?? "") ?? r.schoolId, names.get(r.targetId ?? "") ?? r.targetId, r.ip, JSON.stringify(r.detail)].map(csvCell).join(","))].join("\n");
}

/** Each student's subjects from their latest assessment, for the users table and CSV. */
export function subjectsByStudent(assessments: AssessmentForAnalytics[], subjectLabels: Record<string, string>): Map<string, { subjects: string[]; topTitle: string | null; hollandCode: string; completedAt: string; pathways: string[] }> {
  const out = new Map<string, { subjects: string[]; topTitle: string | null; hollandCode: string; completedAt: string; pathways: string[] }>();
  for (const [id, a] of latestByStudent(assessments)) {
    const p = (a.profile ?? {}) as Profile;
    out.set(id, { subjects: (p.currentSubjects ?? []).map((s) => subjectLabels[s] ?? s), topTitle: a.topTitle, hollandCode: a.hollandCode, completedAt: a.completedAt, pathways: p.educationPaths ?? [] });
  }
  return out;
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Stop spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function usersCsv(users: User[], schoolName: Map<string, string>, latest: ReturnType<typeof subjectsByStudent>): string {
  const head = ["first_name", "last_name", "username", "email", "role", "school", "year", "email_confirmed", "created", "last_sign_in", "holland_code", "top_career", "pathways", "subjects", "assessed"];
  return [
    head.join(","),
    ...users.map((u) => {
      const r = latest.get(u.id);
      return [u.firstName, u.lastName, u.username, u.email, u.role, schoolName.get(u.schoolId), u.yearLevel, u.emailVerifiedAt ? "yes" : "no", u.createdAt.slice(0, 10), u.lastLoginAt?.slice(0, 10), r?.hollandCode, r?.topTitle, r?.pathways.join("; "), r?.subjects.join("; "), r?.completedAt.slice(0, 10)]
        .map(csvCell)
        .join(",");
    }),
  ].join("\n");
}

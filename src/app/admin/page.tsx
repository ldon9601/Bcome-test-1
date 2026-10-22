import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/BarList.tsx";
import { RIASEC_COLOURS } from "@/components/Charts.tsx";
import { Icon } from "@/components/Icon.tsx";
import { ipStats, platformAnalytics, securityStats, trafficStats } from "@/lib/admin/analytics.ts";
import { healthChecks } from "@/lib/admin/health.ts";
import { EVENT_LABELS } from "@/lib/auth/event-labels.ts";
import { auth, requireAdmin } from "@/lib/auth/server.ts";
import { FAMILY_LABELS } from "@/lib/careers/families.ts";
import { subjectLabels } from "@/lib/data.ts";
import type { RiasecType } from "@/lib/questionnaire/types.ts";
import { PurgeButton, TestEmailForm } from "./AdminForms.tsx";
import { AdminTabs, Columns, dateOnly, HealthList, IpTable, Kpi, when } from "./AdminWidgets.tsx";

export const metadata: Metadata = { title: "Administration | Bcome" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const cur = await requireAdmin("/admin");
  const service = await auth();
  const store = service.store;
  const now = service.now();
  const day = new Date(now.getTime() - 864e5).toISOString();
  const [users, schools, assessments, requests, audit, sessions, health] = await Promise.all([
    store.listAllUsers(),
    store.listSchools(),
    store.listAllAssessments(),
    store.listRequests(day, 20000),
    store.listAllAudit({ limit: 5000, since: day }),
    store.countActiveSessions(now.toISOString()),
    healthChecks(service),
  ]);
  const a = platformAnalytics({ users, schools, assessments, subjectLabels, now });
  const traffic = trafficStats(requests, now);
  const sec = securityStats(audit, now);
  const ips = ipStats(requests, audit, now, 10);
  const names = new Map([...users.map((u) => [u.id, `${u.firstName} ${u.lastName}`] as const), ...schools.map((s) => [s.id, s.name] as const)]);
  const assessed = a.totals.studentsAssessed;
  const pending = a.schools.rows.filter((s) => s.status === "pending");

  return (
    <main className="admin-page">
      <section className="hero">
        <div>
          <h1>
            Platform <span className="grad-text">administration</span>
          </h1>
          <p className="hero-sub">
            Every school, account and assessment on Bcome. Signed in as {cur.user.username}. Figures as at {when(now.toISOString())} (Sydney time).
          </p>
        </div>
      </section>
      <AdminTabs current="overview" />

      {pending.length > 0 && (
        <p className="notice warn">
          <Icon name="alert" size={18} /> {pending.length} school{pending.length === 1 ? " is" : "s are"} waiting for approval: {pending.map((s) => s.name).join(", ")}.{" "}
          <Link href="/admin/schools?status=pending">Review</Link>
        </p>
      )}

      <section className="kpis" aria-label="Platform totals">
        <Kpi icon="users" tone="blue" value={a.totals.students} label={`students (${a.totals.newStudents30Days} new in 30 days)`} />
        <Kpi icon="school" tone="teal" value={a.totals.schools} label="schools" />
        <Kpi icon="user" tone="purple" value={a.totals.advisers} label={`careers advisers · ${a.totals.admins} administrator${a.totals.admins === 1 ? "" : "s"}`} />
        <Kpi icon="check" tone="green" value={a.totals.assessments} label={`assessments (${a.totals.last30Days} in 30 days)`} />
        <Kpi icon="target" tone="amber" value={`${a.totals.completionRate}%`} label={`of students have a Career Profile (${assessed})`} />
        <Kpi icon="device" tone="pink" value={sessions} label="people signed in now" />
      </section>

      <h2 className="admin-h2">Users by segment</h2>
      <div className="dash-grid">
        <section className="side-card" aria-labelledby="seg-year">
          <h2 id="seg-year">Students by year</h2>
          <p className="small">Every registered student.</p>
          <BarList total={a.totals.students} items={a.segments.byYear} colour="#3b82f6" empty="No students yet." />
        </section>
        <section className="side-card" aria-labelledby="seg-path">
          <h2 id="seg-path">Students by pathway</h2>
          <p className="small">
            From each student&apos;s latest Career Profile. University first, then TAFE, then other routes, so each student counts once. {a.segments.notAssessed} haven&apos;t done it yet.
          </p>
          <BarList total={assessed} items={a.segments.exclusive} colour="var(--teal)" />
          <details className="small-details">
            <summary>Everyone who&apos;d consider each pathway</summary>
            <BarList total={assessed} items={a.segments.pathways} colour="#a78bfa" />
          </details>
        </section>
        <section className="side-card" aria-labelledby="seg-other">
          <h2 id="seg-other">All accounts</h2>
          <p className="small">Including staff.</p>
          <BarList
            total={a.totals.students + a.totals.advisers + a.totals.admins}
            unit="accounts"
            items={[
              { key: "students", label: "Students", count: a.totals.students },
              { key: "advisers", label: "Careers advisers", count: a.totals.advisers },
              { key: "admins", label: "Bcome administrators", count: a.totals.admins },
            ]}
            colour="#f59e0b"
            empty="No accounts yet."
          />
          <h3 className="small-h3">Students by state</h3>
          <BarList total={a.totals.students} items={a.studentsByState} colour="#64748b" empty="No students yet." />
        </section>
      </div>

      <h2 className="admin-h2">Assessment results</h2>
      <div className="dash-grid">
        <section className="side-card" aria-labelledby="by-month">
          <h2 id="by-month">Assessments by month</h2>
          <p className="small">Completed Career Profiles over the last 12 months, including retakes.</p>
          <Columns items={a.assessments.byMonth} label="Assessments by month" every={2} />
        </section>
        <section className="side-card" aria-labelledby="top-careers">
          <h2 id="top-careers">Top career matches</h2>
          <p className="small">Each student&apos;s #1 match from their latest profile.</p>
          <BarList total={assessed} items={a.assessments.topCareers} colour="var(--grad-bar)" />
        </section>
        <section className="side-card" aria-labelledby="holland">
          <h2 id="holland">Strongest interest type</h2>
          <p className="small">The first letter of each student&apos;s Holland code.</p>
          <BarList total={assessed} items={a.assessments.hollandPrimary.map((h) => ({ ...h, colour: RIASEC_COLOURS[h.key as RiasecType] }))} />
        </section>
        <section className="side-card" aria-labelledby="areas">
          <h2 id="areas">Career areas</h2>
          <p className="small">The area of each student&apos;s #1 match.</p>
          <BarList total={assessed} items={a.assessments.families.map((f) => ({ ...f, label: FAMILY_LABELS[f.key as keyof typeof FAMILY_LABELS] ?? f.label }))} colour="#ec4899" />
        </section>
        <section className="side-card wide" aria-labelledby="subjects">
          <h2 id="subjects">Subjects chosen</h2>
          <p className="small">
            Subjects students are studying now, from their latest profile. See each student&apos;s subjects in <Link href="/admin/users?role=student">Users</Link>.
          </p>
          <BarList total={assessed} items={a.subjects.slice(0, 20)} colour="#22c55e" />
          {a.subjects.length > 20 && <p className="small">And {a.subjects.length - 20} more subjects.</p>}
        </section>
      </div>

      <h2 className="admin-h2">Schools</h2>
      <section className="side-card">
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th scope="col">School</th>
                <th scope="col">State</th>
                <th scope="col">Status</th>
                <th scope="col">Students</th>
                <th scope="col">Completed</th>
                <th scope="col">Advisers</th>
                <th scope="col">Last assessment</th>
              </tr>
            </thead>
            <tbody>
              {a.schools.rows.slice(0, 10).map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/users?school=${s.id}`}>{s.name}</Link>
                  </td>
                  <td>{s.state}</td>
                  <td>
                    <span className={`status-chip ${s.status}`}>{s.status === "pending" ? "Waiting" : s.status === "active" ? "Active" : "Suspended"}</span>
                  </td>
                  <td>{s.students}</td>
                  <td>
                    {s.completed} {s.students ? <span className="small">({Math.round((s.completed / s.students) * 100)}%)</span> : null}
                  </td>
                  <td>{s.advisers}</td>
                  <td>{dateOnly(s.lastAssessment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small" style={{ marginTop: "0.75rem" }}>
          {a.schools.byStatus.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(" · ")} · <Link href="/admin/schools">Manage schools</Link>
        </p>
      </section>

      <h2 className="admin-h2">Monitoring (last 24 hours)</h2>
      <section className="kpis" aria-label="Traffic">
        <Kpi icon="chart" tone="blue" value={traffic.total.toLocaleString("en-AU")} label="API requests" />
        <Kpi icon="alert" tone={traffic.serverErrors ? "pink" : "green"} value={traffic.serverErrors} label={`server errors · ${traffic.clientErrors} refused or invalid`} />
        <Kpi icon="clock" tone="purple" value={traffic.p95 != null ? `${traffic.p95} ms` : "—"} label={`slowest 5% (typical ${traffic.p50 ?? "—"} ms)`} />
        <Kpi icon="lock" tone={sec.failed + sec.locked > 20 ? "pink" : "teal"} value={sec.failed} label={`failed sign-ins · ${sec.locked} lockouts · ${sec.wrongCodes} wrong codes`} />
      </section>
      <div className="dash-grid">
        <section className="side-card" aria-labelledby="traffic">
          <h2 id="traffic">Requests by hour</h2>
          <p className="small">Red shows server errors.</p>
          <Columns
            items={traffic.hours.map((h) => ({ key: h.start, label: new Date(h.start).toLocaleTimeString("en-AU", { hour: "numeric", timeZone: "Australia/Sydney" }), count: h.count, alert: h.errors }))}
            label="Requests by hour"
            colour="#93c5fd"
            every={4}
          />
        </section>
        <section className="side-card" aria-labelledby="health">
          <h2 id="health">System health</h2>
          <HealthList checks={health} />
        </section>
        <section className="side-card" aria-labelledby="security">
          <h2 id="security">Sign-ins and security</h2>
          <ul className="stat-list">
            <li>
              <strong>{sec.signIns}</strong> successful sign-ins
            </li>
            <li>
              <strong>{sec.newDevices}</strong> new-device codes sent
            </li>
            <li>
              <strong>{sec.passwordResets}</strong> passwords reset or set
            </li>
            <li>
              <strong>{sec.adminActions}</strong> administrator actions
            </li>
          </ul>
        </section>
      </div>

      <section className="side-card" aria-labelledby="ips">
        <div className="group-head" style={{ marginTop: 0 }}>
          <h2 id="ips">Incoming IP addresses</h2>
          <p>
            The busiest addresses in the last 24 hours. Addresses with five or more failed sign-ins or codes are flagged first. <Link href="/admin/logs">All logs</Link>
          </p>
        </div>
        <IpTable rows={ips} />
      </section>

      <div className="dash-grid">
        <section className="side-card wide" aria-labelledby="recent">
          <h2 id="recent">Recent activity</h2>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">What</th>
                  <th scope="col">Who</th>
                  <th scope="col">School</th>
                  <th scope="col">IP address</th>
                </tr>
              </thead>
              <tbody>
                {audit.slice(0, 15).map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{when(e.at)}</td>
                    <td>{EVENT_LABELS[e.event] ?? e.event}</td>
                    <td>{names.get(e.actorId ?? "") ?? names.get(e.targetId ?? "") ?? "—"}</td>
                    <td>{names.get(e.schoolId ?? "") ?? "—"}</td>
                    <td className="mono">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {audit.length === 0 && <p className="muted">Nothing in the last 24 hours.</p>}
        </section>
        <section className="side-card" aria-labelledby="tools">
          <h2 id="tools">System tools</h2>
          <h3 className="small-h3">Check email delivery</h3>
          <TestEmailForm email={cur.user.email} />
          <h3 className="small-h3">Clean up</h3>
          <p className="small">Removes expired sessions, sign-in codes and trusted devices, request logs older than 30 days and audit entries older than 13 months. This also runs daily.</p>
          <PurgeButton />
          <h3 className="small-h3">Add an administrator</h3>
          <p className="small">
            For security, administrators can only be created from the command line by someone with database access: <code>npm run admin -- create</code>. See the README.
          </p>
        </section>
      </div>
    </main>
  );
}

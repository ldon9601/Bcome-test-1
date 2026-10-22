import { isIP } from "node:net";
import type { Metadata } from "next";
import { ipStats, securityStats, trafficStats } from "@/lib/admin/analytics.ts";
import { EVENT_LABELS } from "@/lib/auth/event-labels.ts";
import { auth, requireAdmin } from "@/lib/auth/server.ts";
import { AdminTabs, browser, IpTable, Kpi, when } from "../AdminWidgets.tsx";

export const metadata: Metadata = { title: "Logs | Bcome administration" };
export const dynamic = "force-dynamic";

const GROUPS: [string, string][] = [
  ["login.", "Sign-ins"],
  ["code.", "Email codes"],
  ["password.", "Passwords"],
  ["student.", "Students"],
  ["adviser.", "Advisers"],
  ["school.", "Schools"],
  ["admin.", "Administrator actions"],
];

export default async function AdminLogs({ searchParams }: { searchParams: Promise<{ event?: string; ip?: string; school?: string; days?: string }> }) {
  const raw = await searchParams;
  // Only well-formed IP addresses are passed to the database.
  const sp = { ...raw, ip: raw.ip && isIP(raw.ip.trim()) ? raw.ip.trim() : undefined };
  const badIp = Boolean(raw.ip?.trim()) && !sp.ip;
  await requireAdmin("/admin/logs");
  const service = await auth();
  const now = service.now();
  const days = [1, 7, 30, 90, 400].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const since = new Date(now.getTime() - days * 864e5).toISOString();
  const day = new Date(now.getTime() - 864e5).toISOString();
  const [audit, recentAudit, requests, users, schools] = await Promise.all([
    service.store.listAllAudit({ limit: 300, event: sp.event || undefined, ip: sp.ip || undefined, schoolId: sp.school || undefined, since }),
    service.store.listAllAudit({ limit: 5000, since: day }),
    service.store.listRequests(day, 20000),
    service.store.listAllUsers(),
    service.store.listSchools(),
  ]);
  const names = new Map([...users.map((u) => [u.id, `${u.firstName} ${u.lastName}`] as const), ...schools.map((s) => [s.id, s.kind === "platform" ? "Bcome" : s.name] as const)]);
  const traffic = trafficStats(requests, now);
  const sec = securityStats(recentAudit, now);
  const ips = ipStats(requests, recentAudit, now, 50);
  const ipRequests = sp.ip ? requests.filter((r) => r.ip === sp.ip) : requests;
  const exportQuery = new URLSearchParams(Object.fromEntries(Object.entries({ ...sp, days: String(days) }).filter(([, v]) => v)) as Record<string, string>).toString();

  return (
    <main className="admin-page">
      <section className="hero">
        <div>
          <h1>
            Logs and <span className="grad-text">monitoring</span>
          </h1>
          <p className="hero-sub">
            The audit log of sign-ins and changes (kept 13 months) and the API request log with incoming IP addresses (kept 30 days). Neither records passwords, codes or answers.
          </p>
        </div>
      </section>
      <AdminTabs current="logs" />

      <section className="kpis" aria-label="Last 24 hours">
        <Kpi icon="chart" tone="blue" value={traffic.total.toLocaleString("en-AU")} label="requests in 24 hours" />
        <Kpi icon="map" tone="teal" value={ips.length} label="IP addresses seen" />
        <Kpi icon="alert" tone={traffic.serverErrors ? "pink" : "green"} value={traffic.serverErrors} label="server errors" />
        <Kpi icon="lock" tone={ips.some((i) => i.flagged) ? "pink" : "purple"} value={sec.failed + sec.wrongCodes} label={`failed sign-ins and codes · ${ips.filter((i) => i.flagged).length} flagged addresses`} />
      </section>

      <section className="side-card" aria-labelledby="audit">
        <h2 id="audit">Audit log</h2>
        <form className="table-tools" role="search">
          <label>
            Events
            <select name="event" defaultValue={sp.event ?? ""}>
              <option value="">All</option>
              {GROUPS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
              <option value="login.failed">Failed sign-ins only</option>
            </select>
          </label>
          <label>
            School
            <select name="school" defaultValue={sp.school ?? ""}>
              <option value="">All</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.kind === "platform" ? "Bcome administration" : s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            IP
            <input name="ip" defaultValue={sp.ip} placeholder="Any" className="ip-input" spellCheck={false} />
          </label>
          <label>
            Period
            <select name="days" defaultValue={String(days)}>
              <option value="1">24 hours</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="400">13 months</option>
            </select>
          </label>
          <button className="button secondary small-btn">Filter</button>
          {badIp && <span className="field-error">That isn&apos;t an IP address, so it was ignored.</span>}
          <a className="button ghost small-btn" href={`/admin/logs/export?${exportQuery}`}>
            Download CSV
          </a>
        </form>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">What</th>
                <th scope="col">Who</th>
                <th scope="col">Account affected</th>
                <th scope="col">School</th>
                <th scope="col">IP address</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((e) => (
                <tr key={e.id} className={/failed|locked|blocked/.test(e.event) ? "row-warn" : undefined}>
                  <td className="nowrap">{when(e.at)}</td>
                  <td>{EVENT_LABELS[e.event] ?? e.event}</td>
                  <td>{e.actorId ? (names.get(e.actorId) ?? "Deleted account") : "—"}</td>
                  <td>{e.targetId ? (names.get(e.targetId) ?? "Deleted account") : "—"}</td>
                  <td>{names.get(e.schoolId ?? "") ?? "—"}</td>
                  <td className="mono">{e.ip ? <a href={`/admin/logs?ip=${encodeURIComponent(e.ip)}&days=${days}`}>{e.ip}</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {audit.length === 0 ? <p className="muted">No events match.</p> : <p className="small">Showing the latest {audit.length}. Download the CSV for up to 10,000.</p>}
      </section>

      <section className="side-card" aria-labelledby="ips">
        <h2 id="ips">Incoming IP addresses (24 hours)</h2>
        <p className="small">Select an address to see its audit events. Addresses with five or more failures are flagged; sign-in rate limits already slow them down.</p>
        <IpTable rows={ips} />
      </section>

      <section className="side-card" aria-labelledby="requests">
        <h2 id="requests">Latest requests{sp.ip ? ` from ${sp.ip}` : ""}</h2>
        <p className="small">The latest 50. Paths only: query strings, bodies and cookies are never logged.</p>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Request</th>
                <th scope="col">Result</th>
                <th scope="col">Time</th>
                <th scope="col">IP address</th>
                <th scope="col">Browser</th>
              </tr>
            </thead>
            <tbody>
              {ipRequests.slice(0, 50).map((r, i) => (
                <tr key={`${r.at}-${i}`} className={r.status >= 500 ? "row-flag" : r.status >= 400 ? "row-warn" : undefined}>
                  <td className="nowrap">{when(r.at)}</td>
                  <td className="mono">
                    {r.method} {r.path}
                  </td>
                  <td>{r.status}</td>
                  <td>{r.ms} ms</td>
                  <td className="mono">{r.ip ?? "—"}</td>
                  <td className="ua">{browser(r.userAgent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ipRequests.length === 0 && <p className="muted">No requests logged in the last 24 hours.</p>}
      </section>

      <section className="side-card admin-narrow" aria-labelledby="routes">
        <h2 id="routes">Busiest API routes (24 hours)</h2>
        {traffic.routes.length === 0 ? (
          <p className="muted">No requests yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col">Requests</th>
                  <th scope="col">Errors</th>
                  <th scope="col">Average</th>
                </tr>
              </thead>
              <tbody>
                {traffic.routes.map((r) => (
                  <tr key={r.route}>
                    <td className="mono">{r.route}</td>
                    <td>{r.count}</td>
                    <td>{r.errors}</td>
                    <td>{r.avgMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

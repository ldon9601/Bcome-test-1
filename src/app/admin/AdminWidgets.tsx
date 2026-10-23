import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon.tsx";
import type { HealthCheck } from "@/lib/admin/health.ts";
import sourcesJson from "../../../data/sources.json" with { type: "json" };

interface DataSource {
  id: string;
  title: string;
  publisher: string;
  pages: string[];
  mode: "auto" | "review";
  frequency: string;
  why?: string;
  latest: { file: string; url: string | null; importedAt: string | null; checkedAt: string | null; period?: string | null; status: string };
}

export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" }) : "—";
export const dateOnly = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" }) : "—");

export function AdminTabs({ current }: { current: "overview" | "schools" | "users" | "logs" }) {
  const tabs: [typeof current, string, string, IconName][] = [
    ["overview", "Overview", "/admin", "chart"],
    ["schools", "Schools", "/admin/schools", "school"],
    ["users", "Users", "/admin/users", "users"],
    ["logs", "Logs and monitoring", "/admin/logs", "shield"],
  ];
  return (
    <nav className="admin-tabs" aria-label="Administration">
      {tabs.map(([k, l, href, icon]) => (
        <Link key={k} href={href} aria-current={k === current ? "page" : undefined}>
          <Icon name={icon} size={16} /> {l}
        </Link>
      ))}
    </nav>
  );
}

export function Kpi({ icon, tone, value, label }: { icon: IconName; tone: string; value: string | number; label: string }) {
  return (
    <div className="kpi">
      <span className={`kpi-icon tone-${tone}`}>
        <Icon name={icon} size={22} />
      </span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/** Small column chart (pure CSS), with the values available to screen readers as a list. */
export function Columns({ items, label, colour = "var(--violet)", every = 1 }: { items: { key: string; label: string; count: number; alert?: number }[]; label: string; colour?: string; every?: number }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <figure className="col-chart" aria-label={label}>
      <ul role="list">
        {items.map((i, n) => (
          <li key={i.key} aria-label={`${i.label}: ${i.count}`}>
            <span className="col" style={{ height: `${(i.count / max) * 100}%`, background: colour }} title={`${i.label}: ${i.count}`}>
              {i.alert ? <span className="col-alert" style={{ height: `${(i.alert / Math.max(i.count, 1)) * 100}%` }} /> : null}
            </span>
            <span className="col-label" aria-hidden="true">
              {n % every === 0 ? i.label : ""}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function HealthList({ checks }: { checks: HealthCheck[] }) {
  const icon = { ok: "check", warn: "alert", error: "close" } as const;
  return (
    <ul className="health-list">
      {checks.map((c) => (
        <li key={c.label} className={`health-${c.status}`}>
          <span className="health-dot" aria-hidden="true">
            <Icon name={icon[c.status]} size={14} strokeWidth={3} />
          </span>
          <span>
            <strong>{c.label}</strong>
            <span className="sr-only"> ({c.status === "ok" ? "OK" : c.status === "warn" ? "warning" : "problem"})</span>
            <span className="small">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function IpTable({ rows }: { rows: { ip: string; requests: number; signIns: number; failures: number; lastSeen: string; userAgent: string | null; flagged: boolean }[] }) {
  if (!rows.length) return <p className="muted">No requests logged in the last 24 hours.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table compact">
        <thead>
          <tr>
            <th scope="col">IP address</th>
            <th scope="col">Requests</th>
            <th scope="col">Sign-ins</th>
            <th scope="col">Failures</th>
            <th scope="col">Last seen</th>
            <th scope="col">Browser</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ip} className={r.flagged ? "row-flag" : undefined}>
              <td>
                <Link href={`/admin/logs?ip=${encodeURIComponent(r.ip)}`} className="mono">
                  {r.ip}
                </Link>
                {r.flagged && <span className="flag-chip">Many failures</span>}
              </td>
              <td>{r.requests}</td>
              <td>{r.signIns}</td>
              <td>{r.failures}</td>
              <td>{when(r.lastSeen)}</td>
              <td className="ua">{browser(r.userAgent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A short browser and OS name from a user agent. */
export function browser(ua: string | null): string {
  if (!ua) return "—";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /curl|bot|spider|python|node/i.test(ua) ? "Script or bot" : "Other";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "ChromeOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} on ${os}` : b;
}

const REPO = "https://github.com/ldon9601/bcome-test-1";

/** Where each spreadsheet comes from, what's loaded and how it's kept up to date (data/sources.json). */
export function DataSources() {
  const sources = (sourcesJson as unknown as { sources: DataSource[] }).sources;
  return (
    <section className="side-card" aria-labelledby="sources">
      <div className="group-head" style={{ marginTop: 0 }}>
        <h2 id="sources">Data sources and automatic updates</h2>
        <p>
          Every Monday a GitHub workflow checks these Jobs and Skills Australia pages for newer spreadsheets.{" "}
          <a href={`${REPO}/actions/workflows/refresh-data.yml`} target="_blank" rel="noopener noreferrer">
            Run it now or see past runs
          </a>
        </p>
      </div>
      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Published</th>
              <th scope="col">Loaded now</th>
              <th scope="col">Updated</th>
              <th scope="col">When new data appears</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className={s.latest.status.startsWith("problem") ? "row-flag" : undefined}>
                <td>
                  <a href={s.pages[0]} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>
                  <span className="small block">{s.publisher}</span>
                </td>
                <td>{s.frequency}</td>
                <td className="ua">
                  {s.latest.url ? (
                    <a href={s.latest.url} target="_blank" rel="noopener noreferrer">
                      {s.latest.file}
                    </a>
                  ) : (
                    s.latest.file
                  )}
                </td>
                <td className="nowrap">
                  {dateOnly(s.latest.importedAt)}
                  <span className="small block">{s.latest.status}</span>
                </td>
                <td>
                  {s.mode === "auto" ? "Goes live automatically once the checks pass" : "Opens a pull request to review"}
                  {s.why && <span className="small block">{s.why}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

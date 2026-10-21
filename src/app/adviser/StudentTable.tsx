"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon.tsx";
import type { StudentRow } from "@/lib/adviser/analytics.ts";

type Sort = "recent" | "name" | "year";
type Show = "all" | "done" | "not-started" | "follow-up";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function StudentTable({ rows, year }: { rows: StudentRow[]; year: number | null }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [show, setShow] = useState<Show>("all");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (!term || `${r.firstName} ${r.lastName} ${r.username} ${r.email} ${r.topCareers.map((c) => c.title).join(" ")}`.toLowerCase().includes(term)) &&
        (show === "all" || (show === "done" ? r.assessments > 0 : show === "not-started" ? r.assessments === 0 : r.flags.length > 0)),
    );
    if (sort === "name") out.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    if (sort === "year") out.sort((a, b) => (a.yearLevel ?? 0) - (b.yearLevel ?? 0) || a.lastName.localeCompare(b.lastName));
    return out;
  }, [rows, q, sort, show]);

  return (
    <section className="side-card" aria-labelledby="students">
      <div className="group-head">
        <h2 id="students">Students</h2>
        <a href={`/adviser/export${year ? `?year=${year}` : ""}`} className="button secondary small-btn" download>
          <Icon name="download" size={16} /> Export CSV
        </a>
      </div>
      <div className="table-tools">
        <span className="search" style={{ margin: 0 }}>
          <Icon name="search" size={18} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names or careers" aria-label="Search students" />
        </span>
        <label>
          Show{" "}
          <select value={show} onChange={(e) => setShow(e.target.value as Show)}>
            <option value="all">Everyone</option>
            <option value="done">Completed</option>
            <option value="not-started">Not started</option>
            <option value="follow-up">Follow up</option>
          </select>
        </label>
        <label>
          Sort{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recent">Most recent</option>
            <option value="name">Last name</option>
            <option value="year">Year</option>
          </select>
        </label>
      </div>
      <p className="small" aria-live="polite">
        {list.length} of {rows.length} students
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Year</th>
              <th scope="col">Latest</th>
              <th scope="col">Interests</th>
              <th scope="col">Top matches (personal fit)</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/adviser/students/${r.id}`}>
                    <strong>
                      {r.firstName} {r.lastName}
                    </strong>
                  </Link>
                  <span className="small block">{r.username}</span>
                </td>
                <td>{r.yearLevel ?? "—"}</td>
                <td>
                  {r.assessments ? (
                    <>
                      {fmt(r.lastCompletedAt)}
                      {r.assessments > 1 && <span className="small block">{r.assessments} assessments</span>}
                    </>
                  ) : (
                    <span className="pill grey">Not started</span>
                  )}
                </td>
                <td>{r.hollandCode ? <span className="pill">{r.hollandCode}</span> : "—"}</td>
                <td>
                  {r.topCareers.length ? (
                    <ol className="mini-careers">
                      {r.topCareers.map((c) => (
                        <li key={c.osca}>
                          {c.title} <span className="small">{c.personalFit}%</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {r.flags.map((f) => (
                    <span key={f} className="flag-chip">
                      {f}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

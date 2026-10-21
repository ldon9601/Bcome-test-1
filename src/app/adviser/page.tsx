import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/BarList.tsx";
import { RiasecRadar, RIASEC_COLOURS } from "@/components/Charts.tsx";
import { Icon } from "@/components/Icon.tsx";
import { OccupationArt } from "@/components/OccupationArt.tsx";
import { schoolAnalytics } from "@/lib/adviser/analytics.ts";
import { DASHBOARD_LABELS } from "@/lib/adviser/labels.ts";
import { auth, requireAdviser } from "@/lib/auth/server.ts";
import type { RiasecType } from "@/lib/questionnaire/types.ts";
import { JoinCodeCard } from "./AdviserWidgets.tsx";
import StudentTable from "./StudentTable.tsx";

export const metadata: Metadata = { title: "School dashboard | Bcome" };
export const dynamic = "force-dynamic";

export default async function AdviserDashboard({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: y } = await searchParams;
  const year = ["10", "11", "12"].includes(y ?? "") ? Number(y) : null;
  const cur = await requireAdviser("/adviser");
  const store = (await auth()).store;
  const [users, assessments] = await Promise.all([store.listUsers(cur.school.id), store.listSchoolAssessments(cur.school.id)]);
  const a = schoolAnalytics(users, assessments, DASHBOARD_LABELS, { year });
  const done = a.totals.completed;
  const filter = (v: number | null) => (v ? `/adviser?year=${v}` : "/adviser");

  return (
    <main className="page-grid">
      <div className="main-col">
        <section className="hero">
          <div>
            <h1>
              School <span className="grad-text">dashboard</span>
            </h1>
            <p className="hero-sub">
              {cur.school.name} · {year ? `Year ${year}` : "Years 10 to 12"}. Figures use each student&apos;s latest assessment.
            </p>
          </div>
        </section>

        <nav className="filters" aria-label="Filter by year">
          {[null, 10, 11, 12].map((v) => (
            <Link key={v ?? "all"} href={filter(v)} aria-current={v === year ? "page" : undefined} className="filter-link">
              {v ? `Year ${v}` : "All years"}
            </Link>
          ))}
        </nav>

        <section className="kpis" aria-label="Summary">
          <div className="kpi">
            <span className="kpi-icon tone-blue">
              <Icon name="users" size={22} />
            </span>
            <strong>{a.totals.registered}</strong>
            <span>students registered</span>
          </div>
          <div className="kpi">
            <span className="kpi-icon tone-teal">
              <Icon name="check" size={22} />
            </span>
            <strong>{a.totals.completionRate}%</strong>
            <span>
              completed ({done} of {a.totals.registered})
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-icon tone-purple">
              <Icon name="history" size={22} />
            </span>
            <strong>{a.totals.last30Days}</strong>
            <span>assessments in the last 30 days</span>
          </div>
          <div className="kpi">
            <span className="kpi-icon tone-amber">
              <Icon name="flag" size={22} />
            </span>
            <strong>{a.followUp.length}</strong>
            <span>students to follow up</span>
          </div>
        </section>

        <section className="side-card" aria-labelledby="top-careers">
          <div className="group-head">
            <h2 id="top-careers">Most recommended careers</h2>
            <p>How many students have each career in their top five matches.</p>
          </div>
          {a.topCareers.length === 0 ? (
            <p className="muted">No completed assessments yet.</p>
          ) : (
            <ol className="career-rank">
              {a.topCareers.map((c) => (
                <li key={c.osca}>
                  <span className="rank-art">
                    <OccupationArt family={c.family} />
                  </span>
                  <span className="rank-main">
                    <strong>{c.title}</strong>
                    <span className="bar" aria-hidden="true">
                      <span style={{ width: `${(c.students / Math.max(done, 1)) * 100}%`, background: "var(--grad-bar)" }} />
                    </span>
                    <span className="small">
                      #1 match for {c.first} · average personal fit {c.avgFit}%
                    </span>
                  </span>
                  <span className="rank-count">
                    {c.students}
                    <span className="small"> students</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="dash-grid">
          <section className="side-card" aria-labelledby="interests">
            <h2 id="interests">Interests (RIASEC)</h2>
            <p className="small">Each student&apos;s strongest interest type, and the average profile.</p>
            <div className="riasec-wrap">
              <RiasecRadar scores={a.riasecAverage} size={150} />
              <BarList
                total={done}
                items={a.riasecPrimary.map((c) => ({ ...c, colour: c.key === "mixed" ? "#cbd5e1" : RIASEC_COLOURS[c.key as RiasecType] }))}
              />
            </div>
            {a.hollandPairs.length > 0 && (
              <p className="small" style={{ marginTop: "0.75rem" }}>
                Most common pairs: {a.hollandPairs.slice(0, 3).map((p) => `${p.label} (${p.count})`).join(", ")}
              </p>
            )}
          </section>
          <section className="side-card" aria-labelledby="families">
            <h2 id="families">Career areas</h2>
            <p className="small">Students with at least one top-five match in each area.</p>
            <BarList total={done} items={a.families.slice(0, 8)} colour="var(--teal)" />
          </section>
          <section className="side-card" aria-labelledby="paths">
            <h2 id="paths">Pathways they&apos;d consider</h2>
            <p className="small">Students could choose more than one.</p>
            <BarList total={done} items={a.educationPaths} colour="#3b82f6" />
          </section>
          <section className="side-card" aria-labelledby="tolerance">
            <h2 id="tolerance">How long they&apos;d study or train</h2>
            <BarList total={done} items={a.studyTolerance} colour="#f59e0b" />
          </section>
          <section className="side-card" aria-labelledby="values">
            <h2 id="values">What matters most to them</h2>
            <p className="small">Each student&apos;s highest-rated work value.</p>
            <BarList total={done} items={a.topValues} colour="#f43f5e" />
          </section>
          <section className="side-card" aria-labelledby="subjects">
            <h2 id="subjects">Subjects they enjoy</h2>
            <p className="small">Students rating each subject area 4 or 5 out of 5 for enjoyment.</p>
            <BarList total={done} items={a.subjects.map((s) => ({ key: s.key, label: s.label, count: s.enjoy, note: `confidence ${Math.round(s.avgConfidence / 25 + 1)}/5` }))} colour="#22c55e" />
          </section>
        </div>

        <StudentTable rows={a.students} year={year} />
      </div>

      <aside className="side-col" aria-label="School tools">
        <JoinCodeCard joinCode={cur.school.joinCode} domains={cur.school.studentDomains} />

        <section className="side-card" aria-labelledby="by-year">
          <h2 id="by-year">Completion by year</h2>
          <ul className="year-bars">
            {a.byYear.map((b) => (
              <li key={b.year}>
                <span>Year {b.year}</span>
                <span className="progress" aria-hidden="true">
                  <span style={{ width: `${b.registered ? (b.completed / b.registered) * 100 : 0}%` }} />
                </span>
                <span className="small">
                  {b.completed}/{b.registered}
                </span>
              </li>
            ))}
          </ul>
          {a.totals.retaken > 0 && <p className="small">{a.totals.retaken} students have done the Career Profile more than once.</p>}
        </section>

        <section className="side-card" aria-labelledby="follow">
          <div className="side-head">
            <span className="side-icon" style={{ background: "var(--tone-amber)", color: "#b45309" }}>
              <Icon name="flag" size={22} />
            </span>
            <div>
              <h2 id="follow">Worth a conversation</h2>
              <p>Based on their latest answers</p>
            </div>
          </div>
          {a.followUp.length === 0 ? (
            <p className="muted">Nobody flagged right now.</p>
          ) : (
            <ul className="follow-list">
              {a.followUp.slice(0, 8).map((f) => (
                <li key={f.id}>
                  <Link href={`/adviser/students/${f.id}`}>
                    <strong>{f.name}</strong>
                    {f.yearLevel ? <span className="small"> · Year {f.yearLevel}</span> : null}
                  </Link>
                  <span className="small">{f.reasons.join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
          {a.followUp.length > 8 && <p className="small">And {a.followUp.length - 8} more. Filter the student list by &ldquo;Follow up&rdquo;.</p>}
        </section>

        <section className="side-card">
          <h2>School settings</h2>
          <p className="small">Student email domains, AI-written plans, other advisers and the audit log.</p>
          <Link href="/adviser/settings" className="button secondary">
            <Icon name="settings" size={18} /> Settings
          </Link>
        </section>
      </aside>
    </main>
  );
}

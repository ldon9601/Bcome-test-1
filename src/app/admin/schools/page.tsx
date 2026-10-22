import type { Metadata } from "next";
import Link from "next/link";
import { platformAnalytics } from "@/lib/admin/analytics.ts";
import { auth, requireAdmin } from "@/lib/auth/server.ts";
import { subjectLabels } from "@/lib/data.ts";
import { CreateSchoolForm, SchoolActions } from "../AdminForms.tsx";
import { AdminTabs, dateOnly } from "../AdminWidgets.tsx";

export const metadata: Metadata = { title: "Schools | Bcome administration" };
export const dynamic = "force-dynamic";

const STATUS = { pending: "Waiting for approval", active: "Active", suspended: "Suspended" } as const;

export default async function AdminSchools({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  await requireAdmin("/admin/schools");
  const service = await auth();
  const [users, schools, assessments] = await Promise.all([service.store.listAllUsers(), service.store.listSchools(), service.store.listAllAssessments()]);
  const a = platformAnalytics({ users, schools, assessments, subjectLabels, now: service.now() });
  const byId = new Map(schools.map((s) => [s.id, s]));
  const query = (q ?? "").trim().toLowerCase();
  const rows = a.schools.rows.filter((s) => (!status || s.status === status) && (!query || s.name.toLowerCase().includes(query) || byId.get(s.id)?.studentDomains.some((d) => d.includes(query))));

  return (
    <main className="admin-page">
      <section className="hero">
        <div>
          <h1>
            <span className="grad-text">Schools</span>
          </h1>
          <p className="hero-sub">Add schools, approve new ones, change or email their sign-up codes and invite careers advisers.</p>
        </div>
      </section>
      <AdminTabs current="schools" />

      <div className="admin-split">
        <section className="side-card" aria-labelledby="add-school">
          <h2 id="add-school">Add a school</h2>
          <p className="small">Schools you add are active straight away. Then invite a careers adviser, who can invite colleagues and share the student sign-up code.</p>
          <CreateSchoolForm />
        </section>

        <section className="side-card" aria-labelledby="list">
          <h2 id="list">
            {rows.length} school{rows.length === 1 ? "" : "s"}
          </h2>
          <form className="table-tools" role="search">
            <input className="search" type="search" name="q" defaultValue={q} placeholder="Search by name or email domain" aria-label="Search schools" />
            <label>
              Status
              <select name="status" defaultValue={status ?? ""}>
                <option value="">All</option>
                {Object.entries(STATUS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary small-btn">Filter</button>
          </form>
          <ul className="school-admin-list">
            {rows.map((s) => {
              const school = byId.get(s.id)!;
              return (
                <li key={s.id}>
                  <div className="school-admin-head">
                    <div>
                      <h3>{s.name}</h3>
                      <p className="small">
                        {s.state} · @{school.studentDomains.join(", @")} · added {dateOnly(s.createdAt)}
                      </p>
                    </div>
                    <span className={`status-chip ${s.status}`}>{STATUS[s.status]}</span>
                  </div>
                  <dl className="school-facts">
                    <div>
                      <dt>Sign-up code</dt>
                      <dd className="mono">{s.joinCode}</dd>
                    </div>
                    <div>
                      <dt>Students</dt>
                      <dd>
                        <Link href={`/admin/users?school=${s.id}&role=student`}>{s.students}</Link>
                      </dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>{s.completed}</dd>
                    </div>
                    <div>
                      <dt>Advisers</dt>
                      <dd>
                        <Link href={`/admin/users?school=${s.id}&role=adviser`}>{s.advisers}</Link>
                      </dd>
                    </div>
                    <div>
                      <dt>Last assessment</dt>
                      <dd>{dateOnly(s.lastAssessment)}</dd>
                    </div>
                  </dl>
                  <SchoolActions schoolId={s.id} status={s.status} name={s.name} />
                </li>
              );
            })}
          </ul>
          {rows.length === 0 && <p className="muted">No schools match.</p>}
        </section>
      </div>
    </main>
  );
}

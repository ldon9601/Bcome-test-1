import type { Metadata } from "next";
import Link from "next/link";
import { subjectsByStudent } from "@/lib/admin/analytics.ts";
import { auth, requireAdmin } from "@/lib/auth/server.ts";
import { subjectLabels } from "@/lib/data.ts";
import { CreateUserForm, UserActions } from "../AdminForms.tsx";
import { AdminTabs, dateOnly, when } from "../AdminWidgets.tsx";

export const metadata: Metadata = { title: "Users | Bcome administration" };
export const dynamic = "force-dynamic";

const ROLE = { student: "Student", adviser: "Careers adviser", admin: "Administrator" } as const;
const PATH = { university: "Uni", vet: "TAFE", apprenticeship: "Apprenticeship", work_learn: "Work", business: "Business", defence_public: "Defence", gap_year: "Gap year", unsure: "Unsure" } as Record<string, string>;
const PAGE = 100;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; school?: string; year?: string; page?: string }> }) {
  const sp = await searchParams;
  const cur = await requireAdmin("/admin/users");
  const service = await auth();
  const now = service.now();
  const [users, schools, assessments] = await Promise.all([service.store.listAllUsers(), service.store.listSchools(), service.store.listAllAssessments()]);
  const schoolName = new Map(schools.map((s) => [s.id, s.kind === "platform" ? "Bcome" : s.name]));
  const latest = subjectsByStudent(assessments, subjectLabels);
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = users
    .filter(
      (u) =>
        (!sp.role || u.role === sp.role) &&
        (!sp.school || u.schoolId === sp.school) &&
        (!sp.year || u.yearLevel === Number(sp.year)) &&
        (!q || `${u.firstName} ${u.lastName} ${u.username} ${u.email}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => (schoolName.get(a.schoolId) ?? "").localeCompare(schoolName.get(b.schoolId) ?? "") || a.lastName.localeCompare(b.lastName));
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.ceil(filtered.length / PAGE);
  const link = (p: number) => `/admin/users?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) })}`;
  const realSchools = schools.filter((s) => s.kind !== "platform").sort((a, b) => a.name.localeCompare(b.name));
  const exportQuery = new URLSearchParams(Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")) as Record<string, string>).toString();

  return (
    <main className="admin-page">
      <section className="hero">
        <div>
          <h1>
            <span className="grad-text">Users</span>
          </h1>
          <p className="hero-sub">Every account on Bcome. Create students and advisers, email password links, unlock, sign out or delete accounts.</p>
        </div>
      </section>
      <AdminTabs current="users" />

      <section className="side-card" aria-labelledby="list">
        <h2 id="list">
          {filtered.length.toLocaleString("en-AU")} account{filtered.length === 1 ? "" : "s"}
        </h2>
        <form className="table-tools" role="search">
          <input className="search" type="search" name="q" defaultValue={sp.q} placeholder="Name, username or email" aria-label="Search accounts" />
          <label>
            Type
            <select name="role" defaultValue={sp.role ?? ""}>
              <option value="">All</option>
              {Object.entries(ROLE).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <select name="year" defaultValue={sp.year ?? ""}>
              <option value="">All</option>
              {[10, 11, 12].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label>
            School
            <select name="school" defaultValue={sp.school ?? ""}>
              <option value="">All</option>
              {realSchools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary small-btn">Filter</button>
          <a className="button ghost small-btn" href={`/admin/users/export${exportQuery ? `?${exportQuery}` : ""}`}>
            Download CSV
          </a>
        </form>
        <div className="table-wrap">
          <table className="data-table compact users-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">School</th>
                <th scope="col">Latest result</th>
                <th scope="col">Subjects chosen</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const r = latest.get(u.id);
                const locked = Boolean(u.lockedUntil && Date.parse(u.lockedUntil) > now.getTime());
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>
                        {u.firstName} {u.lastName}
                      </strong>
                      <span className="small block">
                        {u.username} · {u.email}
                      </span>
                      {!u.emailVerifiedAt && <span className="flag-chip">Email not confirmed</span>}
                      {locked && <span className="flag-chip">Locked</span>}
                    </td>
                    <td>
                      {ROLE[u.role]}
                      {u.yearLevel ? <span className="small block">Year {u.yearLevel}</span> : null}
                    </td>
                    <td>{schoolName.get(u.schoolId)}</td>
                    <td>
                      {r ? (
                        <>
                          {r.topTitle ?? "—"}
                          <span className="small block">
                            {r.hollandCode} · {r.pathways.map((p) => PATH[p] ?? p).join(", ")} · {dateOnly(r.completedAt)}
                          </span>
                        </>
                      ) : u.role === "student" ? (
                        <span className="muted">Not done yet</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="subjects-cell">{r?.subjects.length ? r.subjects.join(", ") : "—"}</td>
                    <td>{u.lastLoginAt ? when(u.lastLoginAt) : "Never"}</td>
                    <td>
                      <UserActions userId={u.id} name={`${u.firstName} ${u.lastName}`} locked={locked} self={u.id === cur.user.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="muted">No accounts match.</p>}
        {pages > 1 && (
          <nav className="history-tabs" aria-label="Pages" style={{ marginTop: "0.75rem" }}>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link key={p} href={link(p)} aria-current={p === page ? "page" : undefined}>
                {p}
              </Link>
            ))}
          </nav>
        )}
      </section>

      <section className="side-card admin-narrow" aria-labelledby="add-user">
        <h2 id="add-user">Create an account</h2>
        <p className="small">For a student who can&apos;t sign up themselves, or an adviser you&apos;re setting up. To create another administrator, use the command line (see the README).</p>
        <CreateUserForm schools={realSchools.map((s) => ({ id: s.id, name: s.name, domains: s.studentDomains }))} thisYear={now.getFullYear()} />
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlanView, { type Result } from "@/app/plan/PlanView.tsx";
import { Icon } from "@/components/Icon.tsx";
import { EvidenceList } from "@/components/Portfolio.tsx";
import { localDate, pointsSummary, weekOf } from "@/lib/activity/missions.ts";
import { auth, requireAdviser } from "@/lib/auth/server.ts";
import { RemoveStudent } from "../../AdviserWidgets.tsx";

export const metadata: Metadata = { title: "Student | Bcome" };
export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string }> }) {
  const { id } = await params;
  const { a: selected } = await searchParams;
  const cur = await requireAdviser(`/adviser/students/${id}`);
  const service = await auth();
  const s = /^[0-9a-f-]{36}$/i.test(id) ? await service.store.getUser(id) : null;
  // Advisers only ever see students at their own school.
  if (!s || s.schoolId !== cur.school.id || s.role !== "student") notFound();
  const history = await service.store.listAssessments(s.id);
  const pick = history.find((h) => h.id === selected) ?? history[0];
  const a = pick ? await service.store.getAssessment(pick.id) : null;
  const [evidence, missions, interested] = await Promise.all([service.store.listEvidence(s.id), service.store.listMissionCompletions(s.id), service.store.listEventResponses(s.id)]);
  const today = localDate(service.now(), cur.school.state);
  const points = pointsSummary(weekOf(today), missions);
  const events = interested.length ? (await service.store.listEvents(cur.school.id, today, "9999-12-31")).filter((e) => interested.includes(e.id)) : [];
  await service.store.audit({ at: new Date().toISOString(), event: "student.viewed", actorId: cur.user.id, schoolId: cur.school.id, targetId: s.id, ip: null, detail: {} });

  return (
    <>
      <section className="student-bar">
        <p className="crumbs">
          <Link href="/adviser">← School dashboard</Link>
        </p>
        <div className="student-head">
          <span className="avatar big" aria-hidden="true">
            {s.firstName[0]}
            {s.lastName[0]}
          </span>
          <div>
            <h1>
              {s.firstName} {s.lastName}
            </h1>
            <p className="muted">
              Year {s.yearLevel} · {s.username} · {s.email} · born {s.birthMonth ? MONTHS[s.birthMonth - 1] : ""} {s.birthYear}
            </p>
          </div>
          <RemoveStudent studentId={s.id} name={`${s.firstName} ${s.lastName}`} />
        </div>
        {history.length > 0 && (
          <nav className="history-tabs" aria-label="Assessments">
            <Icon name="history" size={18} />
            {history.map((h) => (
              <Link key={h.id} href={`/adviser/students/${s.id}?a=${h.id}`} aria-current={h.id === pick?.id ? "page" : undefined}>
                {fmt(h.completedAt)}
                <span className="small"> {h.hollandCode}</span>
              </Link>
            ))}
          </nav>
        )}
      </section>
      {a ? (
        <PlanView
          mode="adviser"
          initial={{ dna: a.dna, matches: a.matches, ideas: a.ideas ?? undefined, plan: a.plan, saved: true } as Result}
          title={
            <>
              {s.firstName}&apos;s <span className="grad-text">results</span>
            </>
          }
          subtitle={`Completed ${fmt(a.completedAt)}${a.yearLevel ? ` in Year ${a.yearLevel}` : ""}. Careers are ordered by personal fit.`}
        />
      ) : (
        <main className="page">
          <p className="lead">{s.firstName} hasn&apos;t completed the Career Profile yet.</p>
        </main>
      )}
      <main className="page-grid activity-strip">
        <div className="main-col">
          <section className="card side-card" aria-labelledby="st-portfolio">
            <div className="group-head" style={{ marginTop: 0 }}>
              <h2 id="st-portfolio">
                <Icon name="clipboard" size={22} /> Skills Evidence Portfolio
              </h2>
              <span className="small">{evidence.length} entries</span>
            </div>
            {evidence.length ? <EvidenceList items={evidence} /> : <p className="muted">{s.firstName} hasn&apos;t added any evidence yet.</p>}
          </section>
        </div>
        <aside className="side-col">
          <section className="side-card" aria-labelledby="st-missions">
            <div className="side-head">
              <span className="side-icon" style={{ background: "var(--tone-amber)", color: "#b45309" }}>
                <Icon name="target" size={22} />
              </span>
              <div>
                <h2 id="st-missions">Weekly missions</h2>
                <p>
                  {points.total} points · {points.completed} done · {points.streak}-week streak
                </p>
              </div>
            </div>
            {missions.length === 0 ? (
              <p className="muted">No missions completed yet.</p>
            ) : (
              <ul className="recent-missions">
                {missions.slice(0, 8).map((m) => (
                  <li key={m.id}>
                    <span className="pill">+{m.points}</span>
                    <span>
                      <strong>{m.title}</strong>
                      <span className="small">
                        {fmt(m.completedAt)} · &ldquo;{m.reflection}&rdquo;
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="side-card" aria-labelledby="st-events">
            <h2 id="st-events">Interested in</h2>
            {events.length === 0 ? (
              <p className="muted">No upcoming events marked.</p>
            ) : (
              <ul className="follow-list">
                {events.map((e) => (
                  <li key={e.id}>
                    <Link href="/adviser/events">
                      <strong>{e.title}</strong>
                      <span className="small"> · {new Date(`${e.startsOn}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </>
  );
}

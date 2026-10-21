import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlanView, { type Result } from "@/app/plan/PlanView.tsx";
import { Icon } from "@/components/Icon.tsx";
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
          initial={{ dna: a.dna, matches: a.matches, plan: a.plan, saved: true } as Result}
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
    </>
  );
}

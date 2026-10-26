import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlanView, { type Result } from "@/app/plan/PlanView.tsx";
import { auth, requireStudent } from "@/lib/auth/server.ts";

export const metadata: Metadata = { title: "Saved results | Bcome" };
export const dynamic = "force-dynamic";

export default async function SavedAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cur = await requireStudent(`/account/assessments/${id}`);
  const a = /^[0-9a-f-]{36}$/i.test(id) ? await (await auth()).store.getAssessment(id) : null;
  if (!a || a.userId !== cur.user.id) notFound();
  const date = new Date(a.completedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  return (
    <>
      <p className="crumbs">
        <Link href="/account">← My profile</Link>
      </p>
      <PlanView
        mode="history"
        initial={{ dna: a.dna, matches: a.matches, ideas: a.ideas ?? undefined, plan: a.plan, saved: true } as Result}
        title={
          <>
            Results from <span className="grad-text">{date}</span>
          </>
        }
        subtitle={`Your Career Profile${a.yearLevel ? ` from Year ${a.yearLevel}` : ""}, with careers ordered by personal fit.`}
      />
    </>
  );
}

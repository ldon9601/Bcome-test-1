import { schoolAnalytics, studentsCsv } from "@/lib/adviser/analytics.ts";
import { DASHBOARD_LABELS } from "@/lib/adviser/labels.ts";
import { auth, clientIp, currentSession } from "@/lib/auth/server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV of the school's students and their latest results. Advisers only; every export is logged. */
export async function GET(request: Request) {
  const cur = await currentSession();
  if (!cur || cur.user.role !== "adviser") return new Response("Please sign in as a careers adviser.", { status: 401 });
  const y = new URL(request.url).searchParams.get("year");
  const year = ["10", "11", "12"].includes(y ?? "") ? Number(y) : null;
  const service = await auth();
  const [users, assessments] = await Promise.all([service.store.listUsers(cur.school.id), service.store.listSchoolAssessments(cur.school.id)]);
  const a = schoolAnalytics(users, assessments, DASHBOARD_LABELS, { year });
  await service.store.audit({
    at: new Date().toISOString(),
    event: "students.exported",
    actorId: cur.user.id,
    schoolId: cur.school.id,
    targetId: null,
    ip: clientIp(request.headers),
    detail: { year, rows: a.students.length },
  });
  const name = `bcome-students-${year ? `year${year}-` : ""}${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(`﻿${studentsCsv(a.students)}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}

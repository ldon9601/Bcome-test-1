import { subjectsByStudent, usersCsv } from "@/lib/admin/analytics.ts";
import { auth, clientIp, currentSession } from "@/lib/auth/server.ts";
import { subjectLabels } from "@/lib/data.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV of accounts, with each student's latest result and subjects. Administrators only; logged. */
export async function GET(request: Request) {
  const cur = await currentSession();
  if (!cur || cur.user.role !== "admin" || cur.school.kind !== "platform") return new Response("Please sign in as a Bcome administrator.", { status: 401 });
  const sp = new URL(request.url).searchParams;
  const service = await auth();
  const [users, schools, assessments] = await Promise.all([service.store.listAllUsers(), service.store.listSchools(), service.store.listAllAssessments()]);
  const q = (sp.get("q") ?? "").toLowerCase();
  const rows = users.filter(
    (u) =>
      (!sp.get("role") || u.role === sp.get("role")) &&
      (!sp.get("school") || u.schoolId === sp.get("school")) &&
      (!sp.get("year") || u.yearLevel === Number(sp.get("year"))) &&
      (!q || `${u.firstName} ${u.lastName} ${u.username} ${u.email}`.toLowerCase().includes(q)),
  );
  const names = new Map(schools.map((s) => [s.id, s.kind === "platform" ? "Bcome" : s.name]));
  await service.store.audit({ at: new Date().toISOString(), event: "admin.users_exported", actorId: cur.user.id, schoolId: sp.get("school"), targetId: null, ip: clientIp(request.headers), detail: { rows: rows.length } });
  return new Response(`﻿${usersCsv(rows, names, subjectsByStudent(assessments, subjectLabels))}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bcome-users-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}

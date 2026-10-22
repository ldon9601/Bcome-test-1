import { isIP } from "node:net";
import { auditCsv } from "@/lib/admin/analytics.ts";
import { auth, clientIp, currentSession } from "@/lib/auth/server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV of the audit log (up to 10,000 rows) with the same filters as the logs page. Logged. */
export async function GET(request: Request) {
  const cur = await currentSession();
  if (!cur || cur.user.role !== "admin" || cur.school.kind !== "platform") return new Response("Please sign in as a Bcome administrator.", { status: 401 });
  const sp = new URL(request.url).searchParams;
  const service = await auth();
  const days = Math.min(400, Math.max(1, Number(sp.get("days")) || 30));
  const [rows, users, schools] = await Promise.all([
    service.store.listAllAudit({ limit: 10000, event: sp.get("event") || undefined, ip: isIP(sp.get("ip") ?? "") ? sp.get("ip")! : undefined, schoolId: sp.get("school") || undefined, since: new Date(Date.now() - days * 864e5).toISOString() }),
    service.store.listAllUsers(),
    service.store.listSchools(),
  ]);
  const names = new Map([...users.map((u) => [u.id, `${u.firstName} ${u.lastName} (${u.username})`] as const), ...schools.map((s) => [s.id, s.name] as const)]);
  await service.store.audit({ at: new Date().toISOString(), event: "admin.audit_exported", actorId: cur.user.id, schoolId: null, targetId: null, ip: clientIp(request.headers), detail: { rows: rows.length, days } });
  return new Response(`﻿${auditCsv(rows, names)}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bcome-audit-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}

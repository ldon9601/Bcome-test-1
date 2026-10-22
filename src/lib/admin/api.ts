import { requireSession, type ApiContext, type ApiResult } from "../auth/api.ts";
import type { Result } from "../auth/service.ts";

/**
 * Handlers for /api/admin/[action]. Every action checks the session here and again in the
 * service (role admin, attached to the platform record), and is written to the audit log.
 */

type Body = Record<string, unknown>;
const str = (b: Body, k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
const list = (b: Body, k: string) =>
  Array.isArray(b[k]) ? (b[k] as unknown[]).filter((x): x is string => typeof x === "string") : str(b, k).split(/[\s,;]+/).filter(Boolean);
const ok = (body: Body = {}): ApiResult => ({ status: 200, body: { ok: true, ...body }, cookies: [] });

function respond<T>(r: Result<T>, then: (v: T) => ApiResult): ApiResult {
  if (r.ok) return then(r as T);
  const f = r as { status: number; error: string; field?: string };
  return { status: f.status, body: { ok: false, error: f.error, field: f.field }, cookies: [] };
}

const SCHOOL_ACTIONS = ["approve", "suspend", "activate", "join-code", "email-code"] as const;
const USER_ACTIONS = ["password-link", "unlock", "sign-out", "delete"] as const;

export async function adminAction(action: string, body: Body, ctx: ApiContext): Promise<ApiResult> {
  const cur = await requireSession(ctx);
  if ("status" in cur) return cur;
  if (cur.user.role !== "admin" || cur.school.kind !== "platform") return { status: 403, body: { ok: false, error: "Only Bcome administrators can do that." }, cookies: [] };
  const s = ctx.service;
  switch (action) {
    case "create-school":
      return respond(await s.adminCreateSchool(cur, { name: str(body, "name"), state: str(body, "state"), studentDomains: list(body, "studentDomains") }, ctx.meta), (r) =>
        ok({ schoolId: r.school.id, joinCode: r.school.joinCode }),
      );
    case "school-action": {
      const a = str(body, "action") as (typeof SCHOOL_ACTIONS)[number];
      if (!SCHOOL_ACTIONS.includes(a)) return { status: 400, body: { ok: false, error: "Unknown school action" }, cookies: [] };
      return respond(await s.adminSchoolAction(cur, str(body, "schoolId"), a, ctx.meta), (r) => ok({ joinCode: r.joinCode, sent: r.sent }));
    }
    case "invite-adviser":
      return respond(await s.adminInviteAdviser(cur, str(body, "schoolId"), str(body, "email"), ctx.meta), () => ok());
    case "create-user":
      return respond(
        await s.adminCreateUser(
          cur,
          {
            schoolId: str(body, "schoolId"),
            role: str(body, "role"),
            firstName: str(body, "firstName"),
            lastName: str(body, "lastName"),
            email: str(body, "email"),
            username: str(body, "username"),
            yearLevel: Number(body.yearLevel),
            birthYear: Number(body.birthYear),
            birthMonth: Number(body.birthMonth),
          },
          ctx.meta,
        ),
        (r) => ok({ userId: r.user.id }),
      );
    case "user-action": {
      const a = str(body, "action") as (typeof USER_ACTIONS)[number];
      if (!USER_ACTIONS.includes(a)) return { status: 400, body: { ok: false, error: "Unknown account action" }, cookies: [] };
      return respond(await s.adminUserAction(cur, str(body, "userId"), a, ctx.meta), () => ok());
    }
    case "test-email":
      return respond(await s.adminSendTestEmail(cur, str(body, "to"), ctx.meta), () => ok());
    case "purge":
      return respond(await s.adminPurge(cur, ctx.meta), () => ok());
    default:
      return { status: 404, body: { ok: false, error: "Unknown action" }, cookies: [] };
  }
}

import { requireSession, type ApiContext, type ApiResult } from "../auth/api.ts";
import type { Result } from "../auth/service.ts";
import { ActivityService } from "./service.ts";

/**
 * Handlers for /api/activity/[action]: the student's portfolio, missions, action cards and
 * event interest, and the adviser's calendar events. Same-origin, JSON-only and session-checked
 * like the other API routes.
 */

type Body = Record<string, unknown>;
const str = (b: Body, k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");

function reply<T>(r: Result<T>): ApiResult {
  if (!r.ok) return { status: r.status, body: { ok: false, error: r.error, field: r.field }, cookies: [] };
  const { ok: _ok, ...rest } = r as { ok: true } & Record<string, unknown>;
  return { status: 200, body: { ok: true, ...rest }, cookies: [] };
}

export async function activityAction(action: string, body: Body, ctx: ApiContext): Promise<ApiResult> {
  const cur = await requireSession(ctx);
  if ("status" in cur) return cur;
  const a = new ActivityService(ctx.service.store, ctx.service.now);
  switch (action) {
    case "evidence-add":
      return reply(await a.addEvidence(cur, body));
    case "evidence-update":
      return reply(await a.updateEvidence(cur, str(body, "id"), body));
    case "evidence-delete":
      return reply(await a.deleteEvidence(cur, str(body, "id")));
    case "mission-complete":
      return reply(await a.completeMission(cur, { missionId: str(body, "missionId"), reflection: str(body, "reflection"), addToPortfolio: body.addToPortfolio === true }, ctx.meta));
    case "card":
      return reply(await a.setCard(cur, str(body, "key"), body.status === "done" || body.status === "dismissed" ? body.status : null));
    case "interest":
      return reply(await a.setInterest(cur, str(body, "eventId"), body.interested === true));
    case "event-add":
      return reply(await a.createEvent(cur, body, ctx.meta));
    case "event-update":
      return reply(await a.updateEvent(cur, str(body, "id"), body, ctx.meta));
    case "event-delete":
      return reply(await a.deleteEvent(cur, str(body, "id"), ctx.meta));
    default:
      return { status: 404, body: { ok: false, error: "Unknown action" }, cookies: [] };
  }
}

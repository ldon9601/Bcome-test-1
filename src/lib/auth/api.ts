import { POLICY } from "./policy.ts";
import type { AuthService, ChallengeGrant, CurrentSession, PendingSchool, RequestMeta, Result, SessionGrant } from "./service.ts";

/**
 * Framework-free handlers for the auth, account and adviser API routes. The Next.js route files
 * only translate requests and cookies, so the whole flow can be tested without a server.
 */

const secure = process.env.NODE_ENV === "production";
/** __Host- cookies must be Secure, Path=/ and have no Domain, so they can't be set by subdomains. */
const prefix = secure ? "__Host-" : "";
export const COOKIE = {
  session: `${prefix}bcome_session`,
  challenge: `${prefix}bcome_challenge`,
  device: `${prefix}bcome_device`,
} as const;

export interface CookieSpec {
  name: string;
  value: string;
  /** Milliseconds; null makes a browser-session cookie; 0 deletes it. */
  maxAgeMs: number | null;
}

export function serialiseCookie(c: CookieSpec): string {
  const parts = [`${c.name}=${encodeURIComponent(c.value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (c.maxAgeMs !== null) parts.push(`Max-Age=${Math.floor(c.maxAgeMs / 1000)}`);
  return parts.join("; ");
}

export interface ApiContext {
  service: AuthService;
  cookies: Record<string, string | undefined>;
  meta: RequestMeta;
}

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
  cookies: CookieSpec[];
}

type Body = Record<string, unknown>;
const str = (b: Body, k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
const num = (b: Body, k: string) => Number(b[k]);
const bool = (b: Body, k: string) => b[k] === true || b[k] === "true" || b[k] === "on";
const list = (b: Body, k: string) =>
  Array.isArray(b[k]) ? (b[k] as unknown[]).filter((x): x is string => typeof x === "string") : str(b, k).split(/[\s,;]+/).filter(Boolean);

const ok = (body: Record<string, unknown> = {}, cookies: CookieSpec[] = []): ApiResult => ({ status: 200, body: { ok: true, ...body }, cookies });
const error = (r: { status: number; error: string; field?: string }): ApiResult => ({ status: r.status, body: { ok: false, error: r.error, field: r.field }, cookies: [] });

/** Only same-site relative paths are followed after sign-in. */
export function safeNext(next: unknown, fallback: string): string {
  return typeof next === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : fallback;
}

const home = (role: string) => (role === "adviser" ? "/adviser" : "/account");

function grantResponse(r: SessionGrant | ChallengeGrant | PendingSchool, next: string | undefined, ctx: ApiContext): ApiResult {
  if (r.kind === "pending") return ok({ next: "/register-school/pending" }, [{ name: COOKIE.challenge, value: "", maxAgeMs: 0 }]);
  if (r.kind === "challenge") {
    const q = new URLSearchParams({ p: r.purpose, to: r.emailHint, role: r.role });
    if (next) q.set("next", next);
    const page = r.purpose === "reset_password" ? "/forgot-password/code" : "/verify";
    return ok({ next: `${page}?${q}` }, [{ name: COOKIE.challenge, value: r.challengeToken, maxAgeMs: POLICY.code.ttlMs * POLICY.code.maxPerHour }]);
  }
  const cookies: CookieSpec[] = [
    { name: COOKIE.session, value: r.sessionToken, maxAgeMs: r.persistent ? r.maxAgeMs : null },
    { name: COOKIE.challenge, value: "", maxAgeMs: 0 },
  ];
  if (r.deviceToken) cookies.push({ name: COOKIE.device, value: r.deviceToken, maxAgeMs: POLICY.device.cookieMaxAgeMs });
  void ctx;
  return ok({ next: safeNext(next, home(r.role)), role: r.role }, cookies);
}

function respond<T>(r: Result<T>, then: (v: T) => ApiResult): ApiResult {
  return r.ok ? then(r as T) : error(r);
}

export async function authAction(action: string, body: Body, ctx: ApiContext): Promise<ApiResult> {
  const s = ctx.service;
  const next = str(body, "next") || undefined;
  switch (action) {
    case "register-school":
      return respond(
        await s.registerSchool(
          {
            schoolName: str(body, "schoolName"),
            state: str(body, "state"),
            studentDomains: list(body, "studentDomains"),
            firstName: str(body, "firstName"),
            lastName: str(body, "lastName"),
            email: str(body, "email"),
            username: str(body, "username"),
            password: str(body, "password"),
          },
          ctx.meta,
        ),
        (g) => grantResponse(g, undefined, ctx),
      );
    case "register-student":
      return respond(
        await s.registerStudent(
          {
            joinCode: str(body, "joinCode"),
            firstName: str(body, "firstName"),
            lastName: str(body, "lastName"),
            email: str(body, "email"),
            username: str(body, "username"),
            password: str(body, "password"),
            yearLevel: num(body, "yearLevel"),
            birthYear: num(body, "birthYear"),
            birthMonth: num(body, "birthMonth"),
            acceptedNotice: bool(body, "acceptedNotice"),
          },
          ctx.meta,
        ),
        (g) => grantResponse(g, next, ctx),
      );
    case "sign-in": {
      const role = str(body, "role") === "adviser" ? "adviser" : "student";
      return respond(
        await s.signIn({ identifier: str(body, "identifier"), password: str(body, "password"), role, remember: bool(body, "remember") }, ctx.meta),
        (g) => grantResponse(g, next, ctx),
      );
    }
    case "verify":
      return respond(
        await s.verifyCode({ challengeToken: ctx.cookies[COOKIE.challenge] ?? "", code: str(body, "code"), trustDevice: bool(body, "trustDevice") }, ctx.meta),
        (g) => grantResponse(g, next, ctx),
      );
    case "resend":
      return respond(await s.resendCode(ctx.cookies[COOKIE.challenge] ?? ""), (r) => ok({ emailHint: r.emailHint }));
    case "forgot":
      return respond(await s.requestPasswordReset({ identifier: str(body, "identifier") }, ctx.meta), (g) => grantResponse(g, undefined, ctx));
    case "reset":
      return respond(
        await s.resetPassword({ challengeToken: ctx.cookies[COOKIE.challenge] ?? "", code: str(body, "code"), password: str(body, "password") }, ctx.meta),
        (r) => ok({ next: r.role === "adviser" ? "/login/adviser?reset=1" : "/login/student?reset=1" }, [{ name: COOKIE.challenge, value: "", maxAgeMs: 0 }]),
      );
    case "accept-invite":
      return respond(
        await s.acceptInvite(
          { token: str(body, "token"), firstName: str(body, "firstName"), lastName: str(body, "lastName"), username: str(body, "username"), password: str(body, "password") },
          ctx.meta,
        ),
        () => ok({ next: "/login/adviser?joined=1" }),
      );
    case "sign-out":
      await s.signOut(ctx.cookies[COOKIE.session], ctx.meta);
      return ok({ next: "/" }, [{ name: COOKIE.session, value: "", maxAgeMs: 0 }]);
    default:
      return { status: 404, body: { ok: false, error: "Unknown action" }, cookies: [] };
  }
}

async function requireSession(ctx: ApiContext): Promise<CurrentSession | ApiResult> {
  const cur = await ctx.service.getSession(ctx.cookies[COOKIE.session]);
  if (!cur.ok) {
    return { status: 401, body: { ok: false, error: cur.reason === "idle" ? "You were signed out after a period of inactivity." : "Please sign in again." }, cookies: [{ name: COOKIE.session, value: "", maxAgeMs: 0 }] };
  }
  return cur;
}

export async function accountAction(action: string, body: Body, ctx: ApiContext): Promise<ApiResult> {
  const cur = await requireSession(ctx);
  if ("status" in cur) return cur;
  const s = ctx.service;
  switch (action) {
    case "password":
      return respond(await s.changePassword(cur, { current: str(body, "current"), password: str(body, "password") }, ctx.meta), () => ok());
    case "year-level":
      return respond(await s.updateYearLevel(cur, num(body, "yearLevel"), ctx.meta), () => ok());
    case "forget-device":
      return respond(await s.forgetDevice(cur, str(body, "deviceId"), ctx.meta), () => ok());
    case "sign-out-everywhere":
      return respond(await s.signOutEverywhere(cur, ctx.meta), () =>
        ok({ next: "/" }, [
          { name: COOKIE.session, value: "", maxAgeMs: 0 },
          { name: COOKIE.device, value: "", maxAgeMs: 0 },
        ]),
      );
    case "delete":
      return respond(await s.deleteOwnAccount(cur, str(body, "password"), ctx.meta), () =>
        ok({ next: "/?deleted=1" }, [
          { name: COOKIE.session, value: "", maxAgeMs: 0 },
          { name: COOKIE.device, value: "", maxAgeMs: 0 },
        ]),
      );
    default:
      return { status: 404, body: { ok: false, error: "Unknown action" }, cookies: [] };
  }
}

export async function adviserAction(action: string, body: Body, ctx: ApiContext): Promise<ApiResult> {
  const cur = await requireSession(ctx);
  if ("status" in cur) return cur;
  if (cur.user.role !== "adviser") return { status: 403, body: { ok: false, error: "Only careers advisers can do that." }, cookies: [] };
  const s = ctx.service;
  switch (action) {
    case "invite":
      return respond(await s.inviteAdviser(cur, str(body, "email"), ctx.meta), () => ok());
    case "revoke-invite":
      return respond(await s.revokeInvite(cur, str(body, "inviteId"), ctx.meta), () => ok());
    case "update-school":
      return respond(
        await s.updateSchool(
          cur,
          { studentDomains: body.studentDomains !== undefined ? list(body, "studentDomains") : undefined, allowAiPlans: typeof body.allowAiPlans === "boolean" ? body.allowAiPlans : undefined },
          ctx.meta,
        ),
        () => ok(),
      );
    case "join-code":
      return respond(await s.regenerateJoinCode(cur, ctx.meta), (r) => ok({ joinCode: r.joinCode }));
    case "remove-student":
      return respond(await s.removeStudent(cur, str(body, "studentId"), ctx.meta), () => ok());
    case "remove-adviser":
      return respond(await s.removeAdviser(cur, str(body, "adviserId"), ctx.meta), () => ok());
    default:
      return { status: 404, body: { ok: false, error: "Unknown action" }, cookies: [] };
  }
}

import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { COOKIE, serialiseCookie, type ApiContext, type ApiResult } from "./api.ts";
import { recordRequest } from "../admin/requests.ts";
import { auth, clientIp } from "./server.ts";

const MAX_BODY = 16 * 1024;

/**
 * Shared POST handling for the auth, account and adviser routes: same-origin check (CSRF), a
 * small JSON body limit, and no caching.
 */
export async function handle(request: Request, run: (body: Record<string, unknown>, ctx: ApiContext) => Promise<ApiResult>) {
  const started = performance.now();
  let res: Response;
  try {
    res = await handleInner(request, run);
  } catch (e) {
    // Never a bare crash: log the details with a short reference the person can quote, and tell
    // them where to look. /api/health explains most set-up problems.
    const ref = randomBytes(3).toString("hex").toUpperCase();
    console.error(`[bcome error] ref ${ref} ${request.method} ${new URL(request.url).pathname}:`, e);
    res = NextResponse.json(
      { ok: false, error: `Bcome couldn't do that because of a problem on our side (reference ${ref}). Please try again shortly. If you run Bcome, open /api/health to check the set-up.` },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
  await recordRequest(request, res.status, started);
  return res;
}

async function handleInner(request: Request, run: (body: Record<string, unknown>, ctx: ApiContext) => Promise<ApiResult>) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ ok: false, error: "Cross-site request refused" }, { status: 403 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Send JSON" }, { status: 400 });
  }
  const cookies = Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((c) => c.trim().split("="))
      .filter(([k]) => k)
      .map(([k, ...v]) => {
        try {
          return [k, decodeURIComponent(v.join("="))];
        } catch {
          return [k, ""];
        }
      }),
  );
  const result = await run(body, {
    service: await auth(),
    cookies,
    meta: { ip: clientIp(request.headers), userAgent: request.headers.get("user-agent"), deviceToken: cookies[COOKIE.device] ?? null },
  });
  const res = NextResponse.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
  for (const c of result.cookies) res.headers.append("set-cookie", serialiseCookie(c));
  return res;
}

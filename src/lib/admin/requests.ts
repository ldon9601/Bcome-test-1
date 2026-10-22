import "server-only";
import { auth, clientIp } from "../auth/server.ts";

/**
 * Records one API request for the administrator's monitoring dashboard: time, method, path,
 * status, duration, IP address and user agent. Never the body, query string or cookies.
 * Logging failures never break the request.
 */
export async function recordRequest(request: Request, status: number, startedAt: number) {
  try {
    const url = new URL(request.url);
    await (await auth()).store.logRequest({
      at: new Date().toISOString(),
      method: request.method,
      path: url.pathname.slice(0, 200),
      status,
      ms: Math.round(performance.now() - startedAt),
      ip: clientIp(request.headers),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
  } catch (e) {
    console.error("[bcome] couldn't record request", e);
  }
}

import { randomBytes } from "node:crypto";
import { configChecks, describeDatabaseError, type ConfigCheck } from "@/lib/admin/config-check.ts";
import { getAuth } from "@/lib/auth/server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health: is the live site set up correctly? Lists each required setting as OK or what's
 * wrong with it, then tries the database. Shows no values, keys or personal data, so it's safe to
 * open in a browser. ?format=json for monitoring tools.
 */
export async function GET(request: Request) {
  const checks: ConfigCheck[] = configChecks(process.env);
  if (!checks.some((c) => c.status === "error")) {
    try {
      const service = getAuth();
      const t = performance.now();
      await service.store.ping();
      checks.push({ setting: "Database", status: "ok", message: `Connected, the tables are there (${Math.round(performance.now() - t)} ms)` });
    } catch (e) {
      const ref = randomBytes(3).toString("hex").toUpperCase();
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[bcome health] ref ${ref}:`, message);
      checks.push({ setting: "Database", status: "error", message: `${describeDatabaseError(message)} (reference ${ref})` });
    }
  } else {
    checks.push({ setting: "Database", status: "warn", message: "Not tested until the settings above are fixed." });
  }
  const ok = !checks.some((c) => c.status === "error");
  const headers = { "cache-control": "no-store" };
  if (new URL(request.url).searchParams.get("format") === "json") return Response.json({ ok, checks, checkedAt: new Date().toISOString() }, { headers });
  const icon = { ok: "OK     ", warn: "CHECK  ", error: "PROBLEM" } as const;
  const text = [
    ok ? "Bcome is set up correctly." : "Bcome isn't set up correctly yet. Fix each PROBLEM in Vercel > Settings > Environment Variables, then redeploy.",
    "",
    ...checks.map((c) => `${icon[c.status]}  ${c.setting}: ${c.message}`),
    "",
    `Checked ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} (Sydney time). Values are never shown here.`,
  ].join("\n");
  return new Response(text, { status: ok ? 200 : 503, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
}

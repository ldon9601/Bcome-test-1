import "server-only";
import { isIP } from "node:net";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE } from "./api.ts";
import { mailerFromEnv } from "./mailer.ts";
import { MemoryStore } from "./memory-store.ts";
import { AuthService, type CurrentSession, type RequestMeta } from "./service.ts";
import type { AuthStore } from "./store.ts";
import { SupabaseStore } from "./supabase-store.ts";

/**
 * Wiring for Next.js: one AuthService per server instance, backed by Supabase when it is
 * configured and by an in-memory store for local development otherwise.
 */

const g = globalThis as unknown as { __bcomeAuth?: AuthService; __bcomeSeed?: Promise<unknown> };

export function databaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getAuth(): AuthService {
  if (g.__bcomeAuth) return g.__bcomeAuth;
  const production = process.env.NODE_ENV === "production";
  const secret = process.env.AUTH_SECRET;
  if (production && (!secret || secret.length < 32)) throw new Error("AUTH_SECRET must be set to a random value of at least 32 characters");
  let store: AuthStore;
  if (databaseConfigured()) store = new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  else if (production) throw new Error("Accounts need Supabase: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  else store = new MemoryStore();
  g.__bcomeAuth = new AuthService({
    store,
    mailer: mailerFromEnv(),
    secret: secret ?? "dev-only-secret-change-me-dev-only-secret",
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    // Without a database (local development) schools are approved straight away.
    schoolApproval: process.env.SCHOOL_APPROVAL === "auto" || !databaseConfigured() ? "auto" : "manual",
  });
  if (store instanceof MemoryStore && process.env.DEMO_DATA !== "off") {
    const service = g.__bcomeAuth;
    g.__bcomeSeed = import("../demo/seed.ts")
      .then(({ seedDemoSchool }) => seedDemoSchool(service))
      .then((d) =>
        console.info(
          `[bcome] No database configured: using in-memory accounts with a demo school.\n  Adviser: ${d.adviserUsername} / ${d.password}\n  Student: ${d.studentUsername} / ${d.password}\n  School code for new students: ${d.school.joinCode} (emails @${d.domain})\n  Email codes are printed here instead of being sent.`,
        ),
      );
  }
  return g.__bcomeAuth;
}

/** The service, once any local demo data has loaded. */
export async function auth(): Promise<AuthService> {
  const service = getAuth();
  await g.__bcomeSeed;
  return service;
}

/** Vercel sets x-forwarded-for; only the first (client) address is used, and only if it's a valid IP. */
export function clientIp(h: Headers): string | null {
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  return isIP(ip) ? ip : null;
}

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const c = await cookies();
  return { ip: clientIp(h), userAgent: h.get("user-agent"), deviceToken: c.get(COOKIE.device)?.value ?? null };
}

/** The signed-in user for a server component, or null. */
export async function currentSession(): Promise<CurrentSession | null> {
  const c = await cookies();
  const token = c.get(COOKIE.session)?.value;
  if (!token) return null;
  const r = await (await auth()).getSession(token);
  return r.ok ? r : null;
}

export async function requireStudent(next: string): Promise<CurrentSession> {
  const cur = await currentSession();
  if (!cur || cur.user.role !== "student") redirect(`/login/student?next=${encodeURIComponent(next)}`);
  return cur;
}

export async function requireAdviser(next: string): Promise<CurrentSession> {
  const cur = await currentSession();
  if (!cur || cur.user.role !== "adviser") redirect(`/login/adviser?next=${encodeURIComponent(next)}`);
  return cur;
}

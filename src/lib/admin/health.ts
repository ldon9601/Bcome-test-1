import "server-only";
import type { AuthService } from "../auth/service.ts";
import { ALGORITHM_VERSION } from "../careers/matching.ts";
import { genAiData, jsaOutlook, occupationData } from "../data.ts";
import { industryData, vacancyData } from "../labour.ts";

export interface HealthCheck {
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

/** Configuration and dependency checks for the administrator dashboard. Never shows secret values. */
export async function healthChecks(service: AuthService, env: NodeJS.ProcessEnv = process.env): Promise<HealthCheck[]> {
  const t = performance.now();
  let dbOk = false;
  try {
    dbOk = await service.store.ping();
  } catch {
    dbOk = false;
  }
  const dbMs = Math.round(performance.now() - t);
  const supabase = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const email = env.EMAIL_PROVIDER ?? "console";
  const secret = env.AUTH_SECRET ?? "";
  return [
    { label: "Database", status: dbOk ? (supabase ? "ok" : "warn") : "error", detail: dbOk ? `${supabase ? "Supabase" : "In-memory (development only)"}, responded in ${dbMs} ms` : "Not responding" },
    {
      label: "Email",
      status: email === "ses" || email === "resend" ? "ok" : "warn",
      detail: email === "ses" ? `Amazon SES (${env.AWS_SES_REGION ?? "ap-southeast-2"})` : email === "resend" ? "Resend (processes email in the US)" : "Console only: codes are written to the server log, not sent",
    },
    {
      label: "Session secret",
      status: secret.length >= 32 ? "ok" : env.NODE_ENV === "production" ? "error" : "warn",
      detail: secret.length >= 32 ? "Set" : env.NODE_ENV === "production" ? "AUTH_SECRET missing or shorter than 32 characters" : "Using the development fallback. Set AUTH_SECRET before going live.",
    },
    { label: "School approval", status: "ok", detail: env.SCHOOL_APPROVAL === "auto" || !supabase ? "Automatic (new schools are active straight away)" : "Manual (new schools wait for an administrator)" },
    { label: "AI-written plans", status: "ok", detail: env.ANTHROPIC_API_KEY ? "Available to schools that turn them on" : "Not configured: plans use Bcome's templates" },
    { label: "App URL", status: env.APP_URL ? "ok" : "warn", detail: env.APP_URL ?? "APP_URL not set: email links use localhost" },
    { label: "Hosting region", status: "ok", detail: env.VERCEL_REGION ? `Vercel ${env.VERCEL_REGION}` : env.NODE_ENV === "production" ? "Production" : "Local development" },
    {
      label: "Career data",
      status: "ok",
      detail: `${occupationData.occupations.length} careers · matching ${ALGORITHM_VERSION} · projections ${jsaOutlook.source.retrieved} · vacancies to ${vacancyData.ivi.latest} · industries ${industryData.source.reference} · Gen AI exposure ${genAiData.source.released ?? genAiData.source.retrieved}`,
    },
  ];
}

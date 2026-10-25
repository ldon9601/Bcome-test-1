/**
 * Plain-English checks of the live site's settings (Vercel environment variables), for the public
 * /api/health page. Says which setting is missing or malformed and how to fix it; never shows a
 * value. Pure, so it can be tested without a server.
 */

export type CheckStatus = "ok" | "warn" | "error";
export interface ConfigCheck {
  setting: string;
  status: CheckStatus;
  message: string;
}

const looksLikeSupabaseUrl = (v: string) => /^https:\/\/[a-z0-9-]+\.supabase\.(co|com|in)\/?$/i.test(v.trim()) || /^https:\/\/[^\s/]+\/?$/.test(v.trim());

export function configChecks(env: Record<string, string | undefined>): ConfigCheck[] {
  const production = env.NODE_ENV === "production";
  const out: ConfigCheck[] = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url) out.push({ setting: "NEXT_PUBLIC_SUPABASE_URL", status: "error", message: "Missing. Add your Supabase Project URL (Supabase > Project Settings > Data API), then redeploy." });
  else if (url.trim() !== url || /^https?:\/\/[^\s/]+\/./.test(url.trim())) out.push({ setting: "NEXT_PUBLIC_SUPABASE_URL", status: "error", message: "Has a space or a path after it. Use just https://abcd1234.supabase.co." });
  else if (!looksLikeSupabaseUrl(url)) out.push({ setting: "NEXT_PUBLIC_SUPABASE_URL", status: "error", message: "Doesn't look like a web address. It should be like https://abcd1234.supabase.co with nothing after it." });
  else out.push({ setting: "NEXT_PUBLIC_SUPABASE_URL", status: "ok", message: "Set" });

  if (!key) out.push({ setting: "SUPABASE_SERVICE_ROLE_KEY", status: "error", message: "Missing. Add the service_role (secret) key from Supabase > Project Settings > API Keys, then redeploy." });
  else if (key.trim() !== key) out.push({ setting: "SUPABASE_SERVICE_ROLE_KEY", status: "error", message: "Has a space or line break at the start or end. Paste it again." });
  else if (/^sb_publishable_/.test(key)) out.push({ setting: "SUPABASE_SERVICE_ROLE_KEY", status: "error", message: "This is the publishable (public) key. Use the secret / service_role key instead." });
  else out.push({ setting: "SUPABASE_SERVICE_ROLE_KEY", status: "ok", message: "Set" });

  const secret = env.AUTH_SECRET ?? "";
  if (!secret) out.push({ setting: "AUTH_SECRET", status: production ? "error" : "warn", message: "Missing. Add a random value of at least 32 characters, then redeploy." });
  else if (secret.length < 32) out.push({ setting: "AUTH_SECRET", status: "error", message: `Too short (${secret.length} characters). Use at least 32.` });
  else out.push({ setting: "AUTH_SECRET", status: "ok", message: "Set" });

  const app = env.APP_URL ?? "";
  if (!app) out.push({ setting: "APP_URL", status: "warn", message: "Missing. Links in emails will point at localhost. Set it to the site's address, e.g. https://bcome-test-1.vercel.app." });
  else if (!/^https?:\/\/[^\s/]+\/?$/.test(app)) out.push({ setting: "APP_URL", status: "warn", message: "Should be just the site's address, like https://bcome-test-1.vercel.app." });
  else out.push({ setting: "APP_URL", status: "ok", message: "Set" });

  const email = env.EMAIL_PROVIDER ?? "";
  if (email === "ses") {
    const missing = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].filter((k) => !env[k]);
    out.push(
      missing.length
        ? { setting: "EMAIL_PROVIDER", status: "error", message: `Set to ses, but ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} missing. Add them, or set EMAIL_PROVIDER to console while testing.` }
        : { setting: "EMAIL_PROVIDER", status: "ok", message: `Amazon SES (${env.AWS_SES_REGION ?? "ap-southeast-2"}). If codes don't arrive, check the sending domain is verified in SES.` },
    );
  } else if (email === "resend") {
    out.push(env.RESEND_API_KEY ? { setting: "EMAIL_PROVIDER", status: "ok", message: "Resend" } : { setting: "EMAIL_PROVIDER", status: "error", message: "Set to resend, but RESEND_API_KEY is missing." });
  } else if (email === "console") {
    out.push({ setting: "EMAIL_PROVIDER", status: production ? "warn" : "ok", message: "console: sign-in codes are written to the Vercel logs (search 'bcome email'), not emailed. Fine for testing; set up SES before schools use it." });
  } else if (production) {
    out.push({ setting: "EMAIL_PROVIDER", status: "error", message: `${email ? `"${email}" isn't recognised` : "Missing"}. Sign-in can't work without it. Set it to console while testing (codes appear in the Vercel logs), or ses once Amazon SES is set up.` });
  } else {
    out.push({ setting: "EMAIL_PROVIDER", status: "ok", message: "Not set: in development, codes are printed in the terminal." });
  }
  return out;
}

/** Turns a database error into a plain-English cause, without echoing anything secret. */
export function describeDatabaseError(message: string): string {
  const m = message.toLowerCase();
  if (/invalid api key|jwt|unauthori[sz]ed|401/.test(m)) return "Supabase rejected the key. Check SUPABASE_SERVICE_ROLE_KEY is the secret / service_role key for this project, then redeploy.";
  if (/enotfound|getaddrinfo|fetch failed|failed to fetch|econnrefused|network/.test(m)) return "Couldn't reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL is this project's URL, then redeploy.";
  if (/does not exist|42p01|could not find the table|pgrst205/.test(m)) return "The database tables aren't there. Run the database setup in the Supabase SQL Editor.";
  if (/permission denied|42501/.test(m)) return "The key doesn't have permission to read the tables. Use the service_role key, not the publishable or anon key.";
  return "The database returned an error. Search the Vercel logs for 'bcome health' to see it.";
}

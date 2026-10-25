import assert from "node:assert/strict";
import { test } from "node:test";
import { configChecks, describeDatabaseError } from "../src/lib/admin/config-check.ts";

const good = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://qtjcnaejkftmrxrybhwr.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.secret.sig",
  AUTH_SECRET: "x".repeat(64),
  APP_URL: "https://bcome-test-1.vercel.app",
  EMAIL_PROVIDER: "console",
};
const by = (env: Record<string, string | undefined>, setting: string) => configChecks(env).find((c) => c.setting === setting)!;

test("a complete live set-up has no problems, and console email is flagged for later", () => {
  const checks = configChecks(good);
  assert.ok(!checks.some((c) => c.status === "error"), JSON.stringify(checks));
  assert.equal(by(good, "EMAIL_PROVIDER").status, "warn");
});

test("missing EMAIL_PROVIDER on the live site is a problem, with the fix", () => {
  const c = by({ ...good, EMAIL_PROVIDER: undefined }, "EMAIL_PROVIDER");
  assert.equal(c.status, "error");
  assert.match(c.message, /console/);
  assert.equal(by({ ...good, NODE_ENV: "development", EMAIL_PROVIDER: undefined }, "EMAIL_PROVIDER").status, "ok");
  assert.match(by({ ...good, EMAIL_PROVIDER: "ses" }, "EMAIL_PROVIDER").message, /AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are missing/);
});

test("common copy-and-paste mistakes are named", () => {
  assert.equal(by({ ...good, NEXT_PUBLIC_SUPABASE_URL: undefined }, "NEXT_PUBLIC_SUPABASE_URL").status, "error");
  assert.match(by({ ...good, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/rest/v1" }, "NEXT_PUBLIC_SUPABASE_URL").message, /path/);
  assert.match(by({ ...good, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_abc" }, "SUPABASE_SERVICE_ROLE_KEY").message, /publishable/);
  assert.match(by({ ...good, SUPABASE_SERVICE_ROLE_KEY: "key \n" }, "SUPABASE_SERVICE_ROLE_KEY").message, /space or line break/);
  assert.match(by({ ...good, AUTH_SECRET: "short" }, "AUTH_SECRET").message, /Too short \(5/);
});

test("no setting's value ever appears in the output", () => {
  const text = JSON.stringify(configChecks({ ...good, AUTH_SECRET: "tiny-secret-value" }));
  for (const v of [good.SUPABASE_SERVICE_ROLE_KEY, "tiny-secret-value", "qtjcnaejkftmrxrybhwr"]) assert.ok(!text.includes(v), v);
});

test("database errors are explained in plain words", () => {
  assert.match(describeDatabaseError("Invalid API key"), /rejected the key/);
  assert.match(describeDatabaseError("TypeError: fetch failed"), /Couldn't reach Supabase/);
  assert.match(describeDatabaseError("PGRST205 Could not find the table 'public.schools'"), /setup/);
  assert.match(describeDatabaseError("42501 permission denied for table schools"), /service_role/);
});

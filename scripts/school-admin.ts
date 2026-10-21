/**
 * Bcome operator tool for school registrations.
 *
 *   npm run school -- list            schools waiting for approval
 *   npm run school -- list all        every school
 *   npm run school -- approve <id>    activate a school and email its advisers the join code
 *   npm run school -- suspend <id>    stop sign-ins for a school
 *   npm run school -- activate <id>   undo a suspension
 *
 * Before approving, check the school is real and the adviser works there (for example, call the
 * school using the number on its website). Reads .env.local for the Supabase and email settings.
 */
import { existsSync } from "node:fs";
import { mailerFromEnv } from "../src/lib/auth/mailer.ts";
import { AuthService } from "../src/lib/auth/service.ts";
import { SupabaseStore } from "../src/lib/auth/supabase-store.ts";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
  process.exit(1);
}
const store = new SupabaseStore(url, key);
const service = new AuthService({
  store,
  mailer: mailerFromEnv(),
  secret: process.env.AUTH_SECRET ?? "unused-here",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  schoolApproval: "manual",
});

const [cmd, arg] = process.argv.slice(2);
if (cmd === "list") {
  const schools = await store.listSchools(arg === "all" ? undefined : "pending");
  if (!schools.length) console.log(arg === "all" ? "No schools yet." : "No schools waiting for approval.");
  for (const s of schools) {
    const advisers = await store.listUsers(s.id, "adviser");
    console.log(`\n${s.id}  ${s.name} (${s.state})  status: ${s.status}  registered ${s.createdAt.slice(0, 10)}`);
    console.log(`  student domains: ${s.studentDomains.join(", ")}`);
    for (const a of advisers) console.log(`  adviser: ${a.firstName} ${a.lastName} <${a.email}> ${a.emailVerifiedAt ? "(email confirmed)" : "(email not confirmed)"}`);
  }
} else if ((cmd === "approve" || cmd === "suspend" || cmd === "activate") && arg) {
  const r = cmd === "approve" ? await service.approveSchool(arg) : await service.setSchoolStatus(arg, cmd === "suspend" ? "suspended" : "active");
  console.log(r.ok ? `Done: ${cmd} ${arg}` : `Failed: ${r.error}`);
  if (!r.ok) process.exit(1);
} else {
  console.log("Usage: npm run school -- list [all] | approve <id> | suspend <id> | activate <id>");
}

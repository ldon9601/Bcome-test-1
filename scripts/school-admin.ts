/**
 * Bcome operator tool for school registrations.
 *
 *   npm run school -- list            schools waiting for approval
 *   npm run school -- list all        every school
 *   npm run school -- approve <id>    activate a school and email its advisers the join code
 *   npm run school -- suspend <id>    stop sign-ins for a school
 *   npm run school -- activate <id>   undo a suspension
 *
 *   npm run school -- create-test --email you@example.com [--state NSW] [--password "…"] [--prefix test]
 *       Makes an active test school with an adviser, a student you can sign in as, 27 made-up
 *       classmates with results, portfolios and missions, and sample calendar events. Sign-in codes
 *       go to your email (the student's to you+teststudent@…). Prints the usernames and password.
 *   npm run school -- delete-test <id>  removes a test school and everything in it
 *
 * Before approving, check the school is real and the adviser works there (for example, call the
 * school using the number on its website). Reads .env.local for the Supabase and email settings.
 */
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { mailerFromEnv } from "../src/lib/auth/mailer.ts";
import { AuthService } from "../src/lib/auth/service.ts";
import { DuplicateError } from "../src/lib/auth/store.ts";
import { SupabaseStore } from "../src/lib/auth/supabase-store.ts";
import { checkEmail, checkPassword, STATES, type AuState } from "../src/lib/auth/validation.ts";
import { seedDemoSchool } from "../src/lib/demo/seed.ts";

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
const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const WORDS = ["harbour", "wattle", "kookaburra", "outback", "lagoon", "banksia", "reef", "gumtree", "billabong", "summit", "canyon", "meadow", "comet", "orbit", "lantern", "compass"];
function generatePassword(): string {
  const w = () => WORDS[randomInt(WORDS.length)];
  const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
  return `${cap(w())}-${cap(w())}-${cap(w())}-${randomInt(10, 100)}!`;
}

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
} else if (cmd === "create-test") {
  const email = (flag("email") ?? "").trim().toLowerCase();
  const emailError = checkEmail(email);
  if (!email || emailError) {
    console.error("Give an email address you can read: sign-in codes are sent there.\n  npm run school -- create-test --email you@example.com");
    process.exit(1);
  }
  const state = (flag("state") ?? "NSW").toUpperCase() as AuState;
  if (!STATES.includes(state)) {
    console.error(`--state must be one of ${STATES.join(", ")}`);
    process.exit(1);
  }
  const prefix = (flag("prefix") ?? "test").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "test";
  const password = flag("password") ?? generatePassword();
  const pwError = checkPassword(password);
  if (pwError) {
    console.error(`That password won't work: ${pwError}`);
    process.exit(1);
  }
  const [local, domain] = email.split("@");
  const studentEmail = (flag("student-email") ?? `${local.split("+")[0]}+${prefix}student@${domain}`).toLowerCase();
  const joinCode = () => `TEST-${Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)]).join("")}`;
  console.log("Creating the test school (this takes a minute: it runs the Career Profile for each made-up student)…");
  let seeded;
  for (let attempt = 0; attempt < 3 && !seeded; attempt++) {
    try {
      seeded = await seedDemoSchool(service, {
        password,
        school: { name: `Bcome Test School (${state})`, state, joinCode: joinCode(), studentDomains: [domain] },
        adviser: { username: `${prefix}.adviser`, email, firstName: "Test", lastName: "Adviser" },
        student: { username: `${prefix}.student`, email: studentEmail, firstName: "Test", lastName: "Student" },
        classmateDomain: "students.bcome-test.invalid",
        classmatePrefix: prefix,
      });
    } catch (e) {
      if (e instanceof DuplicateError && e.field === "join_code") continue;
      if (e instanceof DuplicateError) {
        console.error(`A ${e.field} for this test school is already in use. Delete the old test school first (npm run school -- list all, then delete-test <id>), or use --prefix with a different word.`);
        process.exit(1);
      }
      throw e;
    }
  }
  if (!seeded) throw new Error("Couldn't make a unique join code. Try again.");
  const app = process.env.APP_URL ?? "http://localhost:3000";
  console.log(`
Test school ready: ${seeded.school.name}
  School id:   ${seeded.school.id}
  Join code:   ${seeded.school.joinCode} (new students sign up with an @${domain} email)

  Careers adviser (school administrator)
    Sign in:   ${app}/login/adviser
    Username:  ${seeded.adviserUsername}
    Password:  ${password}
    Codes to:  ${seeded.adviserEmail}

  Student
    Sign in:   ${app}/login/student
    Username:  ${seeded.studentUsername}
    Password:  ${password}
    Codes to:  ${seeded.studentEmail}

Keep the password private. When you're finished: npm run school -- delete-test ${seeded.school.id}
`);
} else if (cmd === "delete-test" && arg) {
  const school = await store.getSchool(arg);
  if (!school) {
    console.error("No school with that id.");
    process.exit(1);
  }
  if (!school.name.startsWith("Bcome Test School")) {
    console.error(`"${school.name}" isn't a test school, so it wasn't deleted.`);
    process.exit(1);
  }
  await store.deleteSchool(school.id);
  console.log(`Deleted ${school.name} and all its accounts and records.`);
} else {
  console.log("Usage: npm run school -- list [all] | approve <id> | suspend <id> | activate <id> | create-test --email you@example.com | delete-test <id>");
}

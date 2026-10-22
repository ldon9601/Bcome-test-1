/**
 * Bcome platform administrator accounts. These have full access to every school, account and log,
 * so they can only be created here, by someone holding the Supabase service role key.
 *
 *   npm run admin -- create --email you@example.com --username your.name [--first Luke --last Smith] [--password "…"]
 *       Creates an administrator and prints a generated password (unless you give one). Every
 *       sign-in also needs a 6-digit code sent to the email address, so use one only you can read.
 *   npm run admin -- list
 *   npm run admin -- reset-password --username your.name     prints a new password and signs out every device
 *   npm run admin -- remove --username your.name             keeps at least one administrator
 *
 * Reads .env.local for the Supabase, email and APP_URL settings. Store the password in a password
 * manager; don't email or message it.
 */
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { hashPassword } from "../src/lib/auth/crypto.ts";
import { mailerFromEnv } from "../src/lib/auth/mailer.ts";
import { AuthService } from "../src/lib/auth/service.ts";
import { SupabaseStore } from "../src/lib/auth/supabase-store.ts";
import { checkPassword, normaliseUsername } from "../src/lib/auth/validation.ts";

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
const app = process.env.APP_URL ?? "http://localhost:3000";

const cmd = process.argv[2];
const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const WORDS = ["harbour", "wattle", "kookaburra", "outback", "lagoon", "banksia", "reef", "gumtree", "billabong", "summit", "canyon", "meadow", "comet", "orbit", "lantern", "compass", "ember", "glacier", "quokka", "saltbush", "spinifex", "tidepool", "wombat", "zephyr"];
/** Four random words and a number: about 68 bits, easy to type, unique each time. */
export function generateAdminPassword(): string {
  const w = () => WORDS[randomInt(WORDS.length)];
  const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
  return `${cap(w())}-${cap(w())}-${cap(w())}-${cap(w())}-${randomInt(100, 1000)}`;
}

async function findAdmin(username: string) {
  const user = await store.findUserByUsername(normaliseUsername(username));
  if (!user || user.role !== "admin") {
    console.error(`No administrator with the username "${username}". See: npm run admin -- list`);
    process.exit(1);
  }
  return user;
}

if (cmd === "create") {
  const email = flag("email") ?? "";
  const username = flag("username") ?? "";
  if (!email || !username) {
    console.error("Usage: npm run admin -- create --email you@example.com --username your.name [--first Luke --last Smith]");
    process.exit(1);
  }
  const password = flag("password") ?? generateAdminPassword();
  const r = await service.createPlatformAdmin({ firstName: flag("first") ?? "Bcome", lastName: flag("last") ?? "Administrator", email, username, password, emailVerified: true });
  if (!r.ok) {
    console.error(`Couldn't create the administrator: ${r.error}`);
    process.exit(1);
  }
  console.log(`
Bcome administrator created
  Sign in:   ${app}/login/admin
  Username:  ${r.user.username}
  Password:  ${password}
  Codes to:  ${r.user.email} (a 6-digit code is needed every time you sign in)

Save the password in a password manager now; it isn't stored anywhere else and can't be shown again.
Sessions last 4 hours and end after 15 minutes without activity.
`);
} else if (cmd === "list") {
  const platform = (await store.listSchools()).find((s) => s.kind === "platform");
  const admins = platform ? await store.listUsers(platform.id, "admin") : [];
  if (!admins.length) console.log("No administrators yet. Create one with: npm run admin -- create --email … --username …");
  for (const a of admins) console.log(`${a.username.padEnd(24)} ${a.email.padEnd(32)} created ${a.createdAt.slice(0, 10)}  last sign-in ${a.lastLoginAt?.slice(0, 16).replace("T", " ") ?? "never"}`);
} else if (cmd === "reset-password") {
  const user = await findAdmin(flag("username") ?? "");
  const password = flag("password") ?? generateAdminPassword();
  const problem = checkPassword(password, [user.username, user.email, user.firstName, user.lastName]);
  if (problem) {
    console.error(`That password won't work: ${problem}`);
    process.exit(1);
  }
  await store.updateUser(user.id, { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null });
  await store.deleteUserSessions(user.id);
  await store.deleteUserDevices(user.id);
  await store.audit({ at: new Date().toISOString(), event: "password.reset", actorId: user.id, schoolId: user.schoolId, targetId: user.id, ip: null, detail: { via: "command line" } });
  console.log(`\nNew password for ${user.username}: ${password}\nEvery device has been signed out. Sign in at ${app}/login/admin\n`);
} else if (cmd === "remove") {
  const user = await findAdmin(flag("username") ?? "");
  const admins = await store.listUsers(user.schoolId, "admin");
  if (admins.length <= 1) {
    console.error("That's the only administrator. Create another one first.");
    process.exit(1);
  }
  await store.deleteUser(user.id);
  await store.audit({ at: new Date().toISOString(), event: "admin.user_deleted", actorId: null, schoolId: user.schoolId, targetId: user.id, ip: null, detail: { role: "admin", via: "command line" } });
  console.log(`Removed ${user.username}.`);
} else {
  console.log("Usage: npm run admin -- create --email you@example.com --username your.name | list | reset-password --username … | remove --username …");
}

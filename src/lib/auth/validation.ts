import { POLICY } from "./policy.ts";

/** Input checks shared by the server and the forms. Each returns an error message or null. */

export const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
export type AuState = (typeof STATES)[number];
export const YEAR_LEVELS = [10, 11, 12] as const;

/** Personal webmail is never accepted as a school address. */
export const WEBMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.com.au", "hotmail.com", "hotmail.com.au", "live.com", "live.com.au", "msn.com",
  "yahoo.com", "yahoo.com.au", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com", "proton.me", "pm.me",
  "gmx.com", "mail.com", "yandex.com", "zoho.com", "fastmail.com", "hey.com", "tutanota.com", "bigpond.com", "bigpond.net.au",
  "optusnet.com.au", "tpg.com.au", "iinet.net.au", "internode.on.net", "westnet.com.au", "dodo.com.au", "aussiebb.com.au",
]);

/**
 * School domains must end in one of these unless SCHOOL_DOMAIN_SUFFIXES overrides it
 * (comma-separated). Australian government and non-government schools use .edu.au or .gov.au.
 */
export function allowedSchoolSuffixes(env: string | undefined = process.env.SCHOOL_DOMAIN_SUFFIXES): string[] {
  const list = (env ?? ".edu.au,.gov.au").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.map((s) => (s.startsWith(".") ? s : `.${s}`));
}

export const normaliseEmail = (e: string) => e.trim().toLowerCase();
export const normaliseUsername = (u: string) => u.trim().toLowerCase();
export const normaliseDomain = (d: string) => d.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
export const emailDomain = (e: string) => normaliseEmail(e).split("@")[1] ?? "";

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function checkEmail(email: string): string | null {
  const e = normaliseEmail(email);
  if (!e) return "Enter your email address.";
  if (e.length > 254 || !EMAIL_RE.test(e)) return "Enter a valid email address.";
  return null;
}

/** For school domains and adviser emails. */
export function checkSchoolDomain(domain: string, suffixes = allowedSchoolSuffixes()): string | null {
  const d = normaliseDomain(domain);
  if (!DOMAIN_RE.test(d)) return `"${domain}" isn't a valid email domain.`;
  if (WEBMAIL_DOMAINS.has(d)) return `${d} is a personal email service, not a school domain.`;
  if (!suffixes.some((s) => d.endsWith(s))) return `${d} doesn't look like a school domain (expected one ending in ${suffixes.join(" or ")}).`;
  return null;
}

/** A student's address must be on one of the school's domains (or a subdomain of one). */
export function emailMatchesDomains(email: string, domains: string[]): boolean {
  const d = emailDomain(email);
  return domains.some((x) => d === x || d.endsWith(`.${x}`));
}

export function checkUsername(username: string): string | null {
  const u = normaliseUsername(username);
  if (u.length < 3 || u.length > 30) return "Usernames are 3 to 30 characters.";
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(u)) return "Use letters, numbers, dots, dashes or underscores, starting and ending with a letter or number.";
  if (u.includes("@")) return "A username can't be an email address.";
  return null;
}

export function checkName(name: string, label: string): string | null {
  const n = name.trim();
  if (!n) return `Enter your ${label}.`;
  if (n.length > 60) return `${label[0].toUpperCase()}${label.slice(1)} is too long.`;
  if (!/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u.test(n)) return `${label[0].toUpperCase()}${label.slice(1)} can only contain letters, spaces, hyphens and apostrophes.`;
  return null;
}

const COMMON = [
  "password", "passw0rd", "qwerty", "letmein", "welcome", "iloveyou", "monkey", "dragon", "football", "baseball", "abc123", "123456",
  "1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm", "admin", "school", "student", "bcome", "trustno1", "sunshine", "princess",
];

/** ST4S A2: at least 14 characters with letters, a number and a symbol. Spaces count as symbols, so short sentences work well. */
export function checkPassword(password: string, personal: string[] = []): string | null {
  const { minLength, maxLength } = POLICY.password;
  if (password.length < minLength) return `Use at least ${minLength} characters. A short sentence works well, like "I like 3 kinds of pizza!"`;
  if (password.length > maxLength) return `Use ${maxLength} characters or fewer.`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password) || !/[^\p{L}\d]/u.test(password)) return "Include letters, at least one number and at least one symbol (a space counts).";
  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(password) || new Set(lower).size < 5) return "That password is too repetitive.";
  const squashed = lower.replace(/[^a-z0-9]/g, "");
  if (COMMON.some((w) => squashed === w || squashed.replace(/\d+$/, "") === w || (w.length >= 6 && squashed.startsWith(w) && squashed.length - w.length < 6))) {
    return "That password is too common.";
  }
  for (const p of personal) {
    const v = p.toLowerCase().split("@")[0];
    if (v.length >= 4 && lower.includes(v)) return "Don't include your name, username or email in your password.";
  }
  return null;
}

/** Year and month of birth only. Students in Years 10 to 12 are typically 14 to 19. */
export function checkBirth(year: number, month: number, now = new Date()): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return "Choose your month and year of birth.";
  const months = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
  const age = Math.floor(months / 12);
  if (age < 12 || age > 21) return "Check your year of birth. Bcome is for students in Years 10 to 12.";
  return null;
}

export function checkYearLevel(y: number): string | null {
  return (YEAR_LEVELS as readonly number[]).includes(y) ? null : "Choose Year 10, 11 or 12.";
}

export function checkSchoolName(name: string): string | null {
  const n = name.trim();
  if (n.length < 3) return "Enter the school's full name.";
  if (n.length > 120) return "School name is too long.";
  return null;
}

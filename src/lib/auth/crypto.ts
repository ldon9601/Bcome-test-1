import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/**
 * Password hashing follows the OWASP Password Storage Cheat Sheet: scrypt with N = 2^17, r = 8,
 * p = 1, a 16-byte random salt per password and a 64-byte key. The parameters are stored with
 * each hash so they can be raised later without breaking existing passwords.
 */
export interface HashCost {
  logN: number;
  r: number;
  p: number;
}
export const OWASP_COST: HashCost = { logN: 17, r: 8, p: 1 };

function scrypt(password: string, salt: Buffer, cost: HashCost): Promise<Buffer> {
  const N = 2 ** cost.logN;
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, 64, { N, r: cost.r, p: cost.p, maxmem: 256 * N * cost.r + 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string, cost: HashCost = OWASP_COST): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, cost);
  return ["scrypt", cost.logN, cost.r, cost.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, logN, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), { logN: Number(logN), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True when a stored hash uses weaker settings than the current ones (re-hash on next sign-in). */
export function needsRehash(stored: string, cost: HashCost = OWASP_COST): boolean {
  const [, logN, r, p] = stored.split("$");
  return Number(logN) < cost.logN || Number(r) < cost.r || Number(p) < cost.p;
}

/** 256-bit random token for cookies and links. Only its SHA-256 hash is stored. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Six-digit one-time code. */
export function randomCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Codes are short, so they are keyed with a server secret and bound to their challenge. */
export function hashCode(secret: string, challengeId: string, code: string): string {
  return createHmac("sha256", secret).update(`${challengeId}:${code}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** School join code students enter at sign-up, e.g. "K7PM-3QXD". No easily confused characters. */
export function randomJoinCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += JOIN_ALPHABET[randomInt(0, JOIN_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normaliseJoinCode(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

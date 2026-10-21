/**
 * Security settings in one place, so they can be reviewed against Safer Technologies 4 Schools
 * (ST4S) criteria. See docs/security/st4s-controls.md for the mapping.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const POLICY = {
  password: {
    /** ST4S A2: at least 14 characters with complexity. */
    minLength: 14,
    maxLength: 128,
  },
  lockout: {
    /** Failed password attempts before the account is locked. */
    maxFailures: 5,
    lockMs: 15 * MIN,
  },
  code: {
    /** One-time email codes. */
    ttlMs: 10 * MIN,
    maxAttempts: 5,
    resendCooldownMs: 60 * 1000,
    maxPerHour: 6,
  },
  session: {
    student: {
      /** "Remember me" off: ends when the browser closes, or after 12 hours, or 60 minutes idle. */
      absoluteMs: 12 * HOUR,
      idleMs: 60 * MIN,
      /** "Remember me" on: stays signed in for 30 days. */
      rememberMs: 30 * DAY,
    },
    adviser: {
      /** Advisers can see a whole school's data: ST4S A10 inactivity lock of 15 minutes. */
      absoluteMs: 8 * HOUR,
      idleMs: 15 * MIN,
    },
    /** How often last-seen is written, to limit database writes. */
    touchEveryMs: MIN,
  },
  device: {
    /** A device a student has verified by email stays trusted this long. */
    trustMs: 90 * DAY,
    cookieMaxAgeMs: 400 * DAY,
  },
  invite: { ttlMs: 7 * DAY },
  rate: {
    /** Per username or email being signed in to. School networks share one IP, so we limit by account, not IP. */
    signInPerIdentifier: { limit: 10, windowMs: 15 * MIN },
    /** Per IP, deliberately generous because a whole school can sit behind one address. */
    registerPerIp: { limit: 300, windowMs: HOUR },
    resetPerIdentifier: { limit: 5, windowMs: HOUR },
  },
  /** Audit log retention (ST4S L1–L3). */
  auditRetentionDays: 400,
} as const;

export type Role = "student" | "adviser";

export function sessionLimits(role: Role, remember: boolean) {
  if (role === "adviser") return { absoluteMs: POLICY.session.adviser.absoluteMs, idleMs: POLICY.session.adviser.idleMs, persistent: false };
  if (remember) return { absoluteMs: POLICY.session.student.rememberMs, idleMs: POLICY.session.student.rememberMs, persistent: true };
  return { absoluteMs: POLICY.session.student.absoluteMs, idleMs: POLICY.session.student.idleMs, persistent: false };
}

/**
 * Light-touch motivation features (progress, XP, levels, streaks, badges). Everything is
 * derived from what the student has actually done: answers given and days they've visited.
 * Stored only in this browser (localStorage), with safe fallbacks when storage is blocked.
 */

export const XP_PER_QUESTION = 10;
export const COMPLETION_BONUS_XP = 100;

export const LEVELS = [
  { level: 1, name: "Starter", minXp: 0 },
  { level: 2, name: "Explorer", minXp: 100 },
  { level: 3, name: "Explorer", minXp: 250 },
  { level: 4, name: "Pathfinder", minXp: 450 },
  { level: 5, name: "Navigator", minXp: 700 },
] as const;

export function xpFor(answered: number, complete: boolean): number {
  return answered * XP_PER_QUESTION + (complete ? COMPLETION_BONUS_XP : 0);
}

export function levelFor(xp: number) {
  const current = [...LEVELS].reverse().find((l) => xp >= l.minXp) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.minXp > xp);
  return { ...current, toNext: next ? next.minXp - xp : 0, nextName: next?.name ?? null };
}

const ACTIVITY_KEY = "bcome:activity";
const SHORTLIST_KEY = "bcome:shortlist";

type Activity = Record<string, number>; // YYYY-MM-DD → questions answered that day

function today(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): features still work for this visit.
  }
}

/** Records answered questions for today and returns the updated activity log. */
export function recordAnswers(count: number, now = new Date()): Activity {
  const a = read<Activity>(ACTIVITY_KEY, {});
  a[today(now)] = (a[today(now)] ?? 0) + count;
  write(ACTIVITY_KEY, a);
  return a;
}

/** Marks today as visited without counting answers. */
export function recordVisit(now = new Date()): Activity {
  const a = read<Activity>(ACTIVITY_KEY, {});
  a[today(now)] = a[today(now)] ?? 0;
  write(ACTIVITY_KEY, a);
  return a;
}

export function readActivity(): Activity {
  return read<Activity>(ACTIVITY_KEY, {});
}

/** Consecutive days with activity, ending today (or yesterday, so a streak survives until midnight). */
export function streakFrom(activity: Activity, now = new Date()): number {
  const day = new Date(now);
  if (!(today(day) in activity)) day.setUTCDate(day.getUTCDate() - 1);
  let n = 0;
  while (today(day) in activity) {
    n++;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return n;
}

export function answeredToday(activity: Activity, now = new Date()): number {
  return activity[today(now)] ?? 0;
}

export function readShortlist(): string[] {
  return read<string[]>(SHORTLIST_KEY, []);
}

export function toggleShortlist(osca: string): string[] {
  const list = readShortlist();
  const next = list.includes(osca) ? list.filter((x) => x !== osca) : [...list, osca];
  write(SHORTLIST_KEY, next);
  return next;
}

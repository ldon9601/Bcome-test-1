import { CAREER_FAMILIES } from "../careers/types.ts";
import type { Checked } from "./evidence.ts";
import { EVENT_KINDS, type EventInput, type EventKind } from "./types.ts";

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const validDate = (d: string) => DATE.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

/** Validates an event a careers adviser adds to the school's opportunity calendar. */
export function checkEvent(input: Record<string, unknown>, today: string): Checked<EventInput> {
  const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string).trim() : "");
  const kind = s("kind") as EventKind;
  if (!EVENT_KINDS.includes(kind)) return { ok: false, error: "Choose what kind of event this is.", field: "kind" };
  const title = s("title");
  if (title.length < 3 || title.length > 120) return { ok: false, error: "Give the event a title (3 to 120 characters).", field: "title" };
  const startsOn = s("startsOn");
  if (!validDate(startsOn)) return { ok: false, error: "Choose the date.", field: "startsOn" };
  const twoYearsAgo = `${Number(today.slice(0, 4)) - 2}${today.slice(4)}`;
  const twoYearsAhead = `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`;
  if (startsOn < twoYearsAgo || startsOn > twoYearsAhead) return { ok: false, error: "Choose a date within two years of today.", field: "startsOn" };
  const endsOn = s("endsOn") || null;
  if (endsOn && (!validDate(endsOn) || endsOn < startsOn)) return { ok: false, error: "The end date must be on or after the start date.", field: "endsOn" };
  if (endsOn && endsOn > twoYearsAhead) return { ok: false, error: "Choose an end date within two years.", field: "endsOn" };
  const time = s("time") || null;
  if (time && time.length > 60) return { ok: false, error: "Keep the time short, e.g. 9am to 3pm.", field: "time" };
  const location = s("location") || null;
  if (location && location.length > 160) return { ok: false, error: "The location is too long.", field: "location" };
  const url = s("url") || null;
  if (url) {
    let ok = false;
    try {
      const u = new URL(url);
      ok = (u.protocol === "https:" || u.protocol === "http:") && url.length <= 500;
    } catch {
      ok = false;
    }
    if (!ok) return { ok: false, error: "Enter a full web address starting with https://", field: "url" };
  }
  const description = s("description");
  if (description.length > 1500) return { ok: false, error: "Keep the description under 1,500 characters.", field: "description" };
  const years = Array.isArray(input.yearLevels) ? input.yearLevels.map(Number) : [];
  if (years.some((y) => ![10, 11, 12].includes(y))) return { ok: false, error: "Year levels are 10, 11 and 12.", field: "yearLevels" };
  const families = Array.isArray(input.families) ? input.families.filter((f): f is string => typeof f === "string") : [];
  if (families.some((f) => !(CAREER_FAMILIES as readonly string[]).includes(f))) return { ok: false, error: "Unknown career area.", field: "families" };
  return {
    ok: true,
    value: { kind, title, startsOn, endsOn: endsOn === startsOn ? null : endsOn, time, location, url, description, yearLevels: [...new Set(years)].sort(), families: [...new Set(families)] },
  };
}

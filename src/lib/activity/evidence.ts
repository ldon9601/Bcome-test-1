import { EVIDENCE_CATEGORIES, type EvidenceCategory, type EvidenceInput, type EvidenceItem } from "./types.ts";

/** Skills Evidence Portfolio: validation, skill suggestions and grouping for the CV. */

export const CATEGORY_LABEL: Record<EvidenceCategory, string> = {
  school: "School",
  sport: "Sport",
  work: "Work",
  volunteering: "Volunteering",
  other: "Other activities",
};

/** CV section headings, in the order they appear. */
export const CV_SECTION: Record<EvidenceCategory, string> = {
  work: "Work experience",
  volunteering: "Volunteering",
  school: "School achievements and activities",
  sport: "Sport",
  other: "Other activities and interests",
};
export const CV_ORDER: EvidenceCategory[] = ["work", "volunteering", "school", "sport", "other"];

/**
 * Employability skills every student can tag, based on the Australian Core Skills for Work
 * framework areas, worded for students.
 */
export const EMPLOYABILITY_SKILLS = [
  "Communication",
  "Teamwork",
  "Leadership",
  "Problem solving",
  "Initiative",
  "Organisation and time management",
  "Reliability",
  "Customer service",
  "Working with technology",
  "Creativity",
  "Working with numbers",
  "Learning new things quickly",
  "Resilience",
  "Working safely",
] as const;

export const LIMITS = { title: 120, organisation: 120, description: 1200, skills: 8, skillLength: 60, items: 100 } as const;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; field: string };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Contact details and similar don't belong in a portfolio entry (ST4S: collect only what's needed). */
const PERSONAL = [
  { re: /(?:\+?61|0)[2-478](?:[ -]?\d){8}\b/, why: "a phone number" },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, why: "an email address" },
];

export function checkEvidence(input: Record<string, unknown>, now: Date): Checked<EvidenceInput> {
  const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string).trim() : "");
  const category = s("category") as EvidenceCategory;
  if (!EVIDENCE_CATEGORIES.includes(category)) return { ok: false, error: "Choose school, sport, work, volunteering or other.", field: "category" };
  const title = s("title");
  if (title.length < 2) return { ok: false, error: "Say what you did, e.g. \"Captain, under-16 netball\".", field: "title" };
  if (title.length > LIMITS.title) return { ok: false, error: `Keep the title under ${LIMITS.title} characters.`, field: "title" };
  const organisation = s("organisation") || null;
  if (organisation && organisation.length > LIMITS.organisation) return { ok: false, error: "That name is too long.", field: "organisation" };
  const startMonth = s("startMonth");
  const endMonth = s("endMonth") || null;
  const thisMonth = now.toISOString().slice(0, 7);
  if (!MONTH.test(startMonth)) return { ok: false, error: "Choose the month you started.", field: "startMonth" };
  if (startMonth > thisMonth) return { ok: false, error: "The start month can't be in the future.", field: "startMonth" };
  if (startMonth < `${now.getUTCFullYear() - 8}-01`) return { ok: false, error: "Add things from your high school years.", field: "startMonth" };
  if (endMonth && (!MONTH.test(endMonth) || endMonth < startMonth)) return { ok: false, error: "The end month must be after the start.", field: "endMonth" };
  if (endMonth && endMonth > thisMonth) return { ok: false, error: "Leave the end month blank if you're still doing this.", field: "endMonth" };
  const description = s("description");
  if (description.length < 10) return { ok: false, error: "Write a sentence or two about what you did and what came of it.", field: "description" };
  if (description.length > LIMITS.description) return { ok: false, error: `Keep it under ${LIMITS.description} characters.`, field: "description" };
  for (const p of PERSONAL) {
    if (p.re.test(description) || p.re.test(title) || (organisation && p.re.test(organisation))) {
      return { ok: false, error: `Please take out ${p.why}. Your portfolio doesn't need contact details (you can add them to your CV when you download it).`, field: "description" };
    }
  }
  const rawSkills = Array.isArray(input.skills) ? input.skills : [];
  const skills = [...new Set(rawSkills.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))];
  if (skills.length > LIMITS.skills) return { ok: false, error: `Pick up to ${LIMITS.skills} skills.`, field: "skills" };
  if (skills.some((x) => x.length > LIMITS.skillLength)) return { ok: false, error: "One of the skills is too long.", field: "skills" };
  return { ok: true, value: { category, title, organisation, startMonth, endMonth, description, skills } };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export function dateRange(e: Pick<EvidenceItem, "startMonth" | "endMonth">): string {
  if (!e.endMonth) return `${monthLabel(e.startMonth)} – present`;
  return e.endMonth === e.startMonth ? monthLabel(e.startMonth) : `${monthLabel(e.startMonth)} – ${monthLabel(e.endMonth)}`;
}

/** Skills ranked by how many entries show them, for the CV's key skills. */
export function topSkills(items: Pick<EvidenceItem, "skills">[], limit = 8): string[] {
  const n = new Map<string, number>();
  for (const i of items) for (const s of i.skills) n.set(s, (n.get(s) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([s]) => s);
}

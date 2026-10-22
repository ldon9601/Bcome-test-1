import { CV_ORDER, CV_SECTION, dateRange, topSkills } from "./evidence.ts";
import type { EvidenceItem } from "./types.ts";

/**
 * Turns a student's Skills Evidence Portfolio into a CV. Contact details are typed in on the CV
 * page and used only in the browser to build the download; Bcome never stores them.
 */

export interface CvContact {
  email: string;
  phone: string;
  location: string;
}

export interface CvModel {
  name: string;
  /** Editable on the CV page. */
  objective: string;
  education: { school: string; detail: string; subjects: string[] };
  skills: string[];
  sections: { heading: string; items: { title: string; organisation: string | null; dates: string; description: string; skills: string[] }[] }[];
  referees: string;
}

export function draftObjective(opts: { yearLevel: number; school: string; careers: string[]; skills: string[] }): string {
  const job = (t: string) => {
    const l = t.replace(/\s*\([^)]*\)/g, "").split(" ").map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
    return `${/^[aeiou]/i.test(l) ? "an" : "a"} ${l}`;
  };
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);
  const careers = opts.careers.slice(0, 2).map(job);
  const skills = opts.skills.slice(0, 3).map((s) => s.toLowerCase());
  const first = `Motivated Year ${opts.yearLevel} student at ${opts.school}${careers.length ? `, working towards a career as ${careers.join(" or ")}` : ""}.`;
  const second = skills.length ? ` I bring ${list(skills)}, and I'm keen to learn from people in the field` : " I'm keen to learn from people in the field";
  return `${first}${second} through work experience, part-time work or volunteering.`;
}

export function buildCv(opts: {
  firstName: string;
  lastName: string;
  yearLevel: number;
  school: string;
  subjects: string[];
  careers: string[];
  evidence: EvidenceItem[];
}): CvModel {
  const skills = topSkills(opts.evidence);
  const sections = CV_ORDER.map((cat) => ({
    heading: CV_SECTION[cat],
    items: opts.evidence
      .filter((e) => e.category === cat)
      .sort((a, b) => (b.endMonth ?? "9999").localeCompare(a.endMonth ?? "9999") || b.startMonth.localeCompare(a.startMonth))
      .map((e) => ({ title: e.title, organisation: e.organisation, dates: dateRange(e), description: e.description, skills: e.skills })),
  })).filter((s) => s.items.length);
  return {
    name: `${opts.firstName} ${opts.lastName}`,
    objective: draftObjective({ yearLevel: opts.yearLevel, school: opts.school, careers: opts.careers, skills }),
    education: { school: opts.school, detail: `Year ${opts.yearLevel}, currently studying`, subjects: opts.subjects },
    skills,
    sections,
    referees: "Available on request.",
  };
}

/** Plain text, for copying into an online application form. */
export function cvText(cv: CvModel, contact: CvContact): string {
  const lines: string[] = [cv.name.toUpperCase()];
  const c = [contact.email, contact.phone, contact.location].filter(Boolean).join(" | ");
  if (c) lines.push(c);
  lines.push("", "CAREER OBJECTIVE", cv.objective, "", "EDUCATION", `${cv.education.school}: ${cv.education.detail}`);
  if (cv.education.subjects.length) lines.push(`Subjects: ${cv.education.subjects.join(", ")}`);
  if (cv.skills.length) lines.push("", "KEY SKILLS", ...cv.skills.map((s) => `- ${s}`));
  for (const s of cv.sections) {
    lines.push("", s.heading.toUpperCase());
    for (const i of s.items) {
      lines.push(`${i.title}${i.organisation ? `, ${i.organisation}` : ""} (${i.dates})`, i.description);
    }
  }
  lines.push("", "REFEREES", cv.referees);
  return lines.join("\n");
}

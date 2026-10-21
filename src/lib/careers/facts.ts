import type { SkillsGraph } from "./skills.ts";
import type { EarningsData, Occupation, Route } from "./types.ts";

/**
 * Plain facts about a career a student can read: salary, time to qualify, pathways,
 * qualifications and skills. Everything comes from /data, never from the AI.
 */

export interface PathwayFact {
  route: Route;
  description: string;
  years: [number, number];
  qualification?: { id: string; title: string; aqfLevel: number; sector: "vet" | "higher-ed"; tgaCode?: string };
  /** Skills this qualification builds that the job uses. */
  skillsBuilt: string[];
}

export interface CareerFacts {
  osca: string;
  oscaTitle: string;
  salary: {
    entry: [number, number];
    experienced: [number, number];
    note?: string;
    /** JSA median full-time earnings, when imported. */
    medianAnnual?: number;
    basis: "indicative" | "indicative-with-jsa-median";
  };
  timeToQualify: {
    years: [number, number];
    milestone: string;
    /** Same range counted from now, including the rest of school. */
    fromNow: [number, number];
  };
  pathways: PathwayFact[];
  skills: string[];
  coreCompetencies: string[];
  relatedCareers: { osca: string; title: string; sharedSkills: string[] }[];
}

/** Whole years of school left after this one, for a student asked during the school year. */
export const SCHOOL_YEARS_LEFT: Record<10 | 11 | 12, number> = { 10: 2, 11: 1, 12: 0 };

export const ROUTE_LABEL: Record<Route, string> = {
  university: "University",
  vet: "TAFE or VET",
  apprenticeship: "Apprenticeship",
  traineeship: "Traineeship",
  cadetship: "Cadetship",
  other: "Other route",
};

export function careerFacts(occ: Occupation, graph: SkillsGraph, earnings: EarningsData, yearLevel: 10 | 11 | 12): CareerFacts {
  const median = earnings.byOsca[occ.osca] ?? earnings.byOsca[occ.oscaUnitGroup];
  const left = SCHOOL_YEARS_LEFT[yearLevel];
  return {
    osca: occ.osca,
    oscaTitle: occ.oscaTitle,
    salary: {
      entry: occ.salary.entry,
      experienced: occ.salary.experienced,
      ...(occ.salary.note ? { note: occ.salary.note } : {}),
      ...(median ? { medianAnnual: Math.round((median.medianWeekly * 52) / 1000) * 1000 } : {}),
      basis: median ? "indicative-with-jsa-median" : "indicative",
    },
    timeToQualify: {
      ...occ.timeToQualify,
      fromNow: [occ.timeToQualify.years[0] + left, occ.timeToQualify.years[1] + left],
    },
    pathways: occ.pathways.map((p) => {
      const q = p.qualification ? graph.qualifications.get(p.qualification) : undefined;
      return {
        route: p.route,
        description: p.description,
        years: p.years,
        ...(q
          ? { qualification: { id: q.id, title: q.title, aqfLevel: q.aqfLevel, sector: q.sector, ...(q.tgaCode ? { tgaCode: q.tgaCode } : {}) } }
          : {}),
        skillsBuilt: q ? graph.skillsFromQualification(q.id, occ).map((s) => graph.label(s)) : [],
      };
    }),
    skills: occ.skills.map((s) => graph.label(s)),
    coreCompetencies: occ.coreCompetencies.map((s) => graph.label(s)),
    relatedCareers: graph.related(occ).map((r) => ({
      osca: r.occupation.osca,
      title: r.occupation.title,
      sharedSkills: r.shared.map((s) => graph.label(s)),
    })),
  };
}

/** "$75k–$85k" */
export function formatRange([lo, hi]: [number, number]): string {
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  return lo === hi ? k(lo) : `${k(lo)}–${k(hi)}`;
}

/** "4 years", "3–4 years", "6 months", "6 months to 1 year" */
export function formatYears([lo, hi]: [number, number]): string {
  const one = (n: number) => (n < 1 ? `${Math.round(n * 12)} months` : `${n % 1 ? n.toFixed(1) : n} year${n === 1 ? "" : "s"}`);
  if (lo === hi) return one(lo);
  if (lo === 0) return `up to ${one(hi)}`;
  if (lo < 1 && hi >= 1) return `${one(lo)} to ${one(hi)}`;
  if (lo < 1) return `${Math.round(lo * 12)}–${Math.round(hi * 12)} months`;
  return `${lo % 1 ? lo.toFixed(1) : lo}–${hi % 1 ? hi.toFixed(1) : hi} years`;
}

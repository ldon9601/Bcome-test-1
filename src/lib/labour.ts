import industriesJson from "../../data/labour/industries.json" with { type: "json" };
import shortageJson from "../../data/labour/shortage.json" with { type: "json" };
import vacanciesJson from "../../data/labour/vacancies.json" with { type: "json" };
import genAiJson from "../../data/labour/genai.json" with { type: "json" };
import type { CareerGenAi, GenAiData } from "./careers/genai.ts";
import type { JsaOutlookData, Occupation } from "./careers/types.ts";

/**
 * Labour market figures for a career, from Jobs and Skills Australia data in /data/labour:
 * vacancies (Total New Vacancies by occupation group, Internet Vacancy Index by skill level and
 * state), employment by industry (ANZSIC) and the 2025 Occupation Shortage List findings.
 *
 * `labourSnapshot` freezes the figures as they stood when an assessment was completed, so a saved
 * result shows the market the student saw. `labourHistory` gives the series for the drill-down charts.
 */

export interface VacancyData {
  source: Record<"tnv" | "ivi", { title: string; url: string; note: string; retrieved: string }>;
  tnv: {
    quarters: string[];
    latest: string;
    occupations: Record<string, { level: string; title: string; values: (number | null)[] }>;
    regionQuarters: string[];
    regions: Record<string, (number | null)[]>;
  };
  ivi: { months: string[]; latest: string; series: Record<string, Record<string, (number | null)[]>> };
}

export interface IndustryRecord {
  level: 1 | 2 | 3;
  nfd: boolean;
  title: string;
  division: string;
  employedK: number | null;
  change1yPct: number | null;
  change5yPct: number | null;
  change10yPct: number | null;
  sharePct: number | null;
  femalePct: number | null;
  partTimePct: number | null;
  medianAge: number | null;
  series?: (number | null)[];
}

export interface IndustryData {
  source: { title: string; url: string; note: string; reference: string; retrieved: string };
  years: string[];
  industries: Record<string, IndustryRecord>;
}

export interface ShortageData {
  source: { title: string; url: string; note: string; retrieved: string };
  years: string[];
  byMajorGroup: Record<string, (number | null)[]>;
  bySkillLevel: Record<string, (number | null)[]>;
  applicantsPerVacancy: { years: string[] } & Record<string, (number | null)[] | string[]>;
}

export const vacancyData = vacanciesJson as unknown as VacancyData;
export const industryData = industriesJson as unknown as IndustryData;
export const shortageData = shortageJson as unknown as ShortageData;
const genAiSource = (genAiJson as unknown as GenAiData).source;

import { SKILL_LEVELS } from "./labour-terms.ts";
export { ANZSIC_NOTE, SKILL_LEVEL_NOTE, SKILL_LEVELS } from "./labour-terms.ts";

const STATE_CODES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;
const MAJOR_GROUPS: Record<string, string> = {
  "1": "Managers",
  "2": "Professionals",
  "3": "Technicians and Trades Workers",
  "4": "Community and Personal Service Workers",
  "5": "Clerical and Administrative Workers",
  "6": "Sales Workers",
  "7": "Machinery Operators and Drivers",
  "8": "Labourers",
};

const round = (n: number, step = 1) => Math.round(n / step) * step;
const pctChange = (now: number | null | undefined, then: number | null | undefined) => (now != null && then ? Math.round(((now - then) / then) * 1000) / 10 : null);

/** Index of the latest period ("YYYY-MM") on or before `at`. */
function periodAt(periods: string[], at: Date): number {
  const ym = at.toISOString().slice(0, 7);
  let i = periods.length - 1;
  while (i > 0 && periods[i] > ym) i--;
  return i;
}

export interface LabourSnapshot {
  /** When the figures were taken (the assessment's completion time). */
  asAt: string;
  skillLevel: { primary: number; levels: number[]; label: string };
  anzsco: { unitGroup: string; title: string };
  anzsic: { code: string; title: string; divisionTitle: string; employedK: number | null; change1yPct: number | null; change5yPct: number | null; reference: string } | null;
  vacancies: {
    /** Total New Vacancies for the ANZSCO sub-major group, and Bcome's estimate for this job. */
    tnv: { quarter: string; groupCode: string; groupTitle: string; group: number | null; groupChange1yPct: number | null; estimate: number | null; sharePct: number | null } | null;
    /** Online job ads for this skill level in the student's state. */
    ivi: { month: string; state: string; skillLevel: number; ads: number | null; change1yPct: number | null; national: number | null } | null;
  };
  projection: { employed2025k: number | null; employed2035k: number | null; growth5Pct: number | null; growth10Pct: number | null } | null;
  shortage: { year: string; majorGroup: string; majorGroupPct: number | null; skillLevelPct: number | null } | null;
  /** JSA Gen AI exposure for the career's unit group. Missing on results saved before October 2026. */
  genAi?: CareerGenAi | null;
}

export function labourSnapshot(occ: Occupation, state: string, at: Date, jsa: JsaOutlookData, vac: VacancyData = vacancyData, ind: IndustryData = industryData, osl: ShortageData = shortageData): LabourSnapshot {
  const unit = jsa.occupations[occ.anzsco];
  const sub = occ.anzsco.slice(0, 2);
  const subGroup = jsa.occupationGroups?.[sub];

  let tnv: LabourSnapshot["vacancies"]["tnv"] = null;
  const series = vac.tnv.occupations[sub];
  if (series) {
    const i = periodAt(vac.tnv.quarters, at);
    const group = series.values[i] ?? null;
    const share = unit?.employed2025k && subGroup?.employed2025k ? unit.employed2025k / subGroup.employed2025k : null;
    tnv = {
      quarter: vac.tnv.quarters[i],
      groupCode: sub,
      groupTitle: series.title,
      group,
      groupChange1yPct: i >= 4 ? pctChange(group, series.values[i - 4]) : null,
      estimate: group != null && share != null ? Math.max(10, round(group * share, group * share >= 1000 ? 100 : 10)) : null,
      sharePct: share != null ? Math.round(share * 1000) / 10 : null,
    };
  }

  let ivi: LabourSnapshot["vacancies"]["ivi"] = null;
  const st = (STATE_CODES as readonly string[]).includes(state) ? state : "AUST";
  const levelSeries = vac.ivi.series[st]?.[String(occ.skillLevel)];
  if (levelSeries) {
    const i = periodAt(vac.ivi.months, at);
    ivi = {
      month: vac.ivi.months[i],
      state: st,
      skillLevel: occ.skillLevel,
      ads: levelSeries[i] ?? null,
      change1yPct: i >= 12 ? pctChange(levelSeries[i], levelSeries[i - 12]) : null,
      national: vac.ivi.series.AUST?.[String(occ.skillLevel)]?.[i] ?? null,
    };
  }

  const industry = occ.anzsic ? ind.industries[occ.anzsic.code] : undefined;
  const year = osl.years.at(-1) ?? "";
  const major = MAJOR_GROUPS[occ.anzsco[0]];
  return {
    asAt: at.toISOString(),
    skillLevel: { primary: occ.skillLevel, levels: occ.skillLevels ?? [occ.skillLevel], label: SKILL_LEVELS[occ.skillLevel]?.short ?? "" },
    anzsco: { unitGroup: occ.anzsco, title: occ.anzscoTitle },
    anzsic: occ.anzsic
      ? {
          code: occ.anzsic.code,
          title: occ.anzsic.title,
          divisionTitle: occ.anzsic.divisionTitle,
          employedK: industry?.employedK ?? null,
          change1yPct: industry?.change1yPct ?? null,
          change5yPct: industry?.change5yPct ?? null,
          reference: ind.source.reference,
        }
      : null,
    vacancies: { tnv, ivi },
    projection: unit ? { employed2025k: unit.employed2025k ?? null, employed2035k: unit.employed2035k ?? null, growth5Pct: unit.growth5Pct ?? null, growth10Pct: unit.growth10Pct ?? null } : null,
    shortage: major
      ? { year, majorGroup: major, majorGroupPct: osl.byMajorGroup[major]?.at(-1) ?? null, skillLevelPct: osl.bySkillLevel[`Skill Level ${occ.skillLevel}`]?.at(-1) ?? null }
      : null,
    genAi: occ.genAi ?? null,
  };
}

export interface LabourHistory {
  tnv: { title: string; periods: string[]; values: (number | null)[] } | null;
  ivi: { state: string; skillLevel: number; periods: string[]; values: (number | null)[] } | null;
  industry: { code: string; title: string; years: string[]; values: (number | null)[]; femalePct: number | null; partTimePct: number | null; medianAge: number | null } | null;
  projection: { points: { year: string; employedK: number | null }[] } | null;
  shortage: { years: string[]; majorGroup: string; majorGroupPct: (number | null)[]; skillLevel: number; skillLevelPct: (number | null)[] } | null;
  sources: { title: string; url: string }[];
}

/** Series for the career drill-down charts (the latest data, not frozen). */
export function labourHistory(occ: Occupation, state: string, jsa: JsaOutlookData, vac: VacancyData = vacancyData, ind: IndustryData = industryData, osl: ShortageData = shortageData): LabourHistory {
  const sub = occ.anzsco.slice(0, 2);
  const t = vac.tnv.occupations[sub];
  const st = (STATE_CODES as readonly string[]).includes(state) ? state : "AUST";
  // Monthly online ads since January 2016, to line up with the vacancy series.
  const from = vac.ivi.months.indexOf("2016-01");
  const ivi = vac.ivi.series[st]?.[String(occ.skillLevel)];
  const industry = occ.anzsic ? ind.industries[occ.anzsic.code] : undefined;
  const unit = jsa.occupations[occ.anzsco];
  const major = MAJOR_GROUPS[occ.anzsco[0]];
  return {
    tnv: t ? { title: t.title, periods: vac.tnv.quarters, values: t.values } : null,
    ivi: ivi ? { state: st, skillLevel: occ.skillLevel, periods: vac.ivi.months.slice(from), values: ivi.slice(from) } : null,
    industry: industry?.series
      ? { code: occ.anzsic.code, title: industry.title, years: ind.years, values: industry.series, femalePct: industry.femalePct, partTimePct: industry.partTimePct, medianAge: industry.medianAge }
      : null,
    projection: unit
      ? { points: [{ year: "2025", employedK: unit.employed2025k ?? null }, { year: "2030", employedK: unit.employed2030k ?? null }, { year: "2035", employedK: unit.employed2035k ?? null }] }
      : null,
    shortage: major ? { years: osl.years, majorGroup: major, majorGroupPct: osl.byMajorGroup[major] ?? [], skillLevel: occ.skillLevel, skillLevelPct: osl.bySkillLevel[`Skill Level ${occ.skillLevel}`] ?? [] } : null,
    sources: [vac.source.tnv, vac.source.ivi, ind.source, { title: jsa.source.title, url: jsa.source.url }, osl.source, genAiSource].map((s) => ({ title: s.title, url: s.url })),
  };
}

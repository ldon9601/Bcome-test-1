import type { Driver, JsaOutlookData, Occupation, Outlook, OutlookBand } from "./types.ts";

/**
 * Future-of-work outlook for an occupation over 5, 10 and 15 years.
 *
 * 5 and 10 years come from Jobs and Skills Australia's employment projections:
 *   1. the occupation's own JSA figure when the import has loaded it, otherwise
 *   2. its ANZSCO major-group figure, nudged by its industry's growth relative to all jobs.
 *      This is an estimate and is labelled as one.
 * 15 years has no official projection. It is an indicative scenario: the 10-year band,
 * moved up for long-run demand drivers and down for high exposure to AI and automation.
 */

const BAND_ORDER: OutlookBand[] = ["declining", "limited", "moderate", "good", "strong"];

const BAND_SCORE: Record<OutlookBand, number> = {
  strong: 1,
  good: 0.8,
  moderate: 0.6,
  limited: 0.35,
  declining: 0.15,
  unknown: 0.5,
};

const DRIVER_TEXT: Record<Driver, string> = {
  "ageing-population": "an ageing population",
  "care-economy": "growing demand for care services",
  "net-zero": "the shift to renewable energy and net zero",
  digital: "continued growth of the digital economy",
  infrastructure: "major infrastructure investment",
  housing: "the need for more housing",
  "population-growth": "population growth",
  defence: "increased defence investment",
};

/** Share of the industry's difference from the all-jobs average applied to a major-group estimate. */
const INDUSTRY_WEIGHT = 0.5;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function bandFor(growth10Pct: number, averagePct: number): OutlookBand {
  if (growth10Pct >= 20) return "strong";
  if (growth10Pct >= averagePct) return "good";
  if (growth10Pct >= averagePct / 2) return "moderate";
  if (growth10Pct >= 0) return "limited";
  return "declining";
}

function shiftBand(band: OutlookBand, steps: number): OutlookBand {
  if (band === "unknown" || steps === 0) return band;
  const i = BAND_ORDER.indexOf(band);
  return BAND_ORDER[Math.max(0, Math.min(BAND_ORDER.length - 1, i + steps))];
}

function listText(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function computeOutlook(occ: Occupation, jsa: JsaOutlookData): Outlook {
  const avg = jsa.total.growth10Pct;
  const own = jsa.occupations[occ.anzsco];
  const group = jsa.majorGroups[String(occ.majorGroup)];

  let growth5Pct: number | null = null;
  let growth10Pct: number | null = null;
  let basis: Outlook["basis"] = "none";
  let band10: OutlookBand = "unknown";

  if (own?.growth10Pct != null) {
    basis = "jsa-occupation";
    growth10Pct = own.growth10Pct;
    growth5Pct = own.growth5Pct ?? null;
  } else if (group?.growth10Pct != null) {
    basis = "jsa-major-group-adjusted";
    const industry = jsa.industries[occ.industry];
    const adj = industry != null ? INDUSTRY_WEIGHT * (industry - avg) : 0;
    growth10Pct = round1(group.growth10Pct + adj);
    growth5Pct = group.growth5Pct != null ? round1(group.growth5Pct + adj / 2) : null;
  } else if (group?.qualitative) {
    basis = "jsa-major-group-qualitative";
    band10 = "limited";
  }
  if (growth10Pct != null) band10 = bandFor(growth10Pct, avg);
  // A major-group estimate can't distinguish the fastest-growing jobs inside the group,
  // so it never claims "strong" on its own. The occupation-level import lifts this cap.
  if (basis === "jsa-major-group-adjusted" && band10 === "strong") band10 = "good";

  // Indicative 15-year scenario.
  const rationale15: string[] = [];
  let steps = 0;
  if (basis === "jsa-occupation") rationale15.push("Starts from JSA's projection for this occupation to 2035.");
  if (basis === "jsa-major-group-adjusted") rationale15.push("Starts from JSA's 2035 projection for similar jobs, adjusted for industry growth.");
  if (basis === "jsa-major-group-qualitative") rationale15.push(`JSA expects ${group?.qualitative} growth for many jobs in this group.`);
  if (occ.drivers.length) {
    steps += 1;
    rationale15.push(`Long-run demand is supported by ${listText(occ.drivers.map((d) => DRIVER_TEXT[d]))}.`);
  }
  if (occ.aiExposure === "high") {
    steps -= 1;
    rationale15.push("AI and automation are likely to change much of the routine work, so the role will reward people who build specialist and people skills.");
  } else if (occ.aiExposure === "medium") {
    rationale15.push("AI will change some tasks; using AI tools well will become part of the job.");
  } else {
    rationale15.push("Most of the work is hands-on or person-to-person, which AI is unlikely to replace.");
  }
  const band15 = band10 === "unknown" ? "unknown" : shiftBand(band10, steps);

  const score = round1((0.6 * BAND_SCORE[band10] + 0.4 * BAND_SCORE[band15]) * 100) / 100;

  let summary: string;
  if (basis === "jsa-occupation") {
    summary = `Jobs and Skills Australia projects employment to grow ${growth10Pct}% by ${jsa.source.horizon10}, compared with ${avg}% for all jobs.`;
  } else if (basis === "jsa-major-group-adjusted") {
    summary = `Estimated growth of about ${Math.round(growth10Pct!)}% by ${jsa.source.horizon10}, based on JSA projections for similar jobs (all jobs: ${avg}%).`;
  } else if (basis === "jsa-major-group-qualitative") {
    summary = `JSA expects weak or negative growth for many jobs in this group to ${jsa.source.horizon10}.`;
  } else {
    summary = "No reliable projection is loaded for this occupation yet.";
  }

  return { growth5Pct, growth10Pct, basis, band10, band15, rationale15, score, summary };
}

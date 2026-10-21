/**
 * Imports median weekly earnings (full-time, before tax) by OSCA code, so plans can show JSA
 * figures alongside Bcome's indicative salary ranges.
 *
 * 1. Copy the median weekly earnings for each occupation from the JSA occupation profiles
 *    (https://www.jobsandskills.gov.au/data/occupation-and-industry-profiles, OSCA edition)
 *    into a CSV with the columns:  osca,medianWeekly,name
 *    osca can be a 6-digit occupation or a 4-digit unit group code. name is optional.
 * 2. Run:  npm run data:import-earnings -- data/raw/earnings.csv  (add --dry-run to preview)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../data/outlook/earnings.json");
const OCCUPATIONS = resolve(import.meta.dirname, "../data/occupations/occupations.json");

export interface EarningsRow {
  osca: string;
  medianWeekly: number;
  name?: string;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** Parses the CSV. Exported for tests. Returns rows plus any problems found. */
export function parseEarningsCsv(text: string): { rows: EarningsRow[]; problems: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines.shift() ?? "").map((h) => h.toLowerCase());
  const col = (name: string) => header.findIndex((h) => h === name.toLowerCase());
  const [ci, wi, ni] = [col("osca"), col("medianWeekly"), col("name")];
  if (ci === -1 || wi === -1) return { rows: [], problems: ["Header must include osca and medianWeekly"] };

  const rows: EarningsRow[] = [];
  const problems: string[] = [];
  lines.forEach((line, i) => {
    const cells = splitCsvLine(line);
    const osca = cells[ci];
    const raw = cells[wi] ?? "";
    const weekly = raw.trim() === "" ? NaN : Number(raw.replace(/[$,]/g, ""));
    if (!/^\d{4}(\d{2})?$/.test(osca)) return void problems.push(`Line ${i + 2}: "${osca}" is not a 4- or 6-digit OSCA code`);
    if (!Number.isFinite(weekly) || weekly < 200 || weekly > 20000) return void problems.push(`Line ${i + 2}: weekly earnings "${raw}" look wrong`);
    rows.push({ osca, medianWeekly: weekly, ...(ni > -1 && cells[ni] ? { name: cells[ni] } : {}) });
  });
  return { rows, problems };
}

function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: npm run data:import-earnings -- <earnings.csv> [--dry-run]");
    process.exit(1);
  }
  const { rows, problems } = parseEarningsCsv(readFileSync(file, "utf8"));
  if (problems.length) console.warn(problems.map((p) => `! ${p}`).join("\n"));
  if (!rows.length) process.exit(1);

  const occupations: { osca: string; oscaUnitGroup: string; title: string }[] = JSON.parse(readFileSync(OCCUPATIONS, "utf8")).occupations;
  const covered = occupations.filter((o) => rows.some((r) => r.osca === o.osca || r.osca === o.oscaUnitGroup));
  const unknown = rows.filter((r) => !occupations.some((o) => o.osca === r.osca || o.oscaUnitGroup === r.osca));
  console.log(`Parsed ${rows.length} rows. Covers ${covered.length} of ${occupations.length} careers.`);
  if (unknown.length) console.log(`Skipping codes not in our list: ${unknown.map((r) => r.osca).join(", ")}`);

  if (process.argv.includes("--dry-run")) return console.log("Dry run: nothing written.");
  const data = JSON.parse(readFileSync(OUT, "utf8"));
  for (const r of rows.filter((x) => !unknown.includes(x))) data.byOsca[r.osca] = { medianWeekly: r.medianWeekly, ...(r.name ? { name: r.name } : {}) };
  data.source.retrieved = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${OUT}. Run npm run db:seed-sql to update the database seed.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

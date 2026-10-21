/**
 * Imports occupation-level employment projections from Jobs and Skills Australia.
 *
 * 1. Download "Employment Projections - May 2025 to May 2035.xlsx" from
 *    https://www.jobsandskills.gov.au/data/employment-projections (save it under data/raw/).
 * 2. Run:  npm run data:import-jsa -- data/raw/<file>.xlsx
 *
 * The script looks for the occupation sheet, finds the code and growth columns by their
 * headers, and merges 5- and 10-year % growth for every 4-digit occupation into
 * data/outlook/jsa-2025.json. JSA changes its layout from year to year, so you can point
 * it at the right columns explicitly:
 *
 *   --sheet "Occupation Projections" --code-col 1 --name-col 2 --g5-col 7 --g10-col 10 --level-col 3
 *
 * (column numbers start at 1). A CSV with headers code,name,growth5Pct,growth10Pct also works.
 * Use --dry-run to see what would change without writing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Row = (string | number | null | undefined)[];

export interface ParsedProjection {
  code: string;
  name: string;
  growth5Pct: number | null;
  growth10Pct: number | null;
  employed2025k?: number;
}

interface Columns {
  code: number;
  name: number;
  g5: number | null;
  g10: number | null;
  level: number | null;
}

const OUT = resolve(import.meta.dirname, "../data/outlook/jsa-2025.json");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[%,\s]/g, ""));
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  }
  return null;
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Finds the header row and the columns we need. Exported for tests. */
export function detectColumns(rows: Row[]): { headerRow: number; cols: Columns } | null {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const h = rows[r].map(norm);
    const code = h.findIndex((c) => /(anzsco|osca|occupation code|^code$)/.test(c));
    if (code === -1) continue;
    const name = h.findIndex((c, i) => i !== code && /(occupation|title|name)/.test(c) && !/code/.test(c));
    const isPct = (c: string) => c.includes("%") || c.includes("per cent") || c.includes("percent");
    const g5 = h.findIndex((c) => isPct(c) && (c.includes("2030") || /5[- ]?year/.test(c)));
    const g10 = h.findIndex((c) => isPct(c) && (c.includes("2035") || /10[- ]?year/.test(c)));
    const level = h.findIndex((c) => c.includes("2025") && !isPct(c) && !/change/.test(c));
    if (g10 === -1 && g5 === -1) continue;
    return {
      headerRow: r,
      cols: { code, name: name === -1 ? code + 1 : name, g5: g5 === -1 ? null : g5, g10: g10 === -1 ? null : g10, level: level === -1 ? null : level },
    };
  }
  return null;
}

/** Turns sheet rows into projections for 4-digit occupations. Exported for tests. */
export function parseRows(rows: Row[], cols: Columns, startRow: number): ParsedProjection[] {
  const out: ParsedProjection[] = [];
  for (const row of rows.slice(startRow)) {
    const code = String(row[cols.code] ?? "").trim().replace(/\.0$/, "");
    if (!/^\d{4}$/.test(code)) continue;
    out.push({
      code,
      name: String(row[cols.name] ?? "").trim(),
      growth5Pct: cols.g5 == null ? null : num(row[cols.g5]),
      growth10Pct: cols.g10 == null ? null : num(row[cols.g10]),
      ...(cols.level != null && num(row[cols.level]) != null ? { employed2025k: num(row[cols.level])! } : {}),
    });
  }
  // Some files store percentages as fractions (0.336 rather than 33.6).
  const all = out.flatMap((p) => [p.growth5Pct, p.growth10Pct]).filter((n): n is number => n != null);
  if (all.length && all.every((n) => Math.abs(n) <= 1.5)) {
    for (const p of out) {
      if (p.growth5Pct != null) p.growth5Pct = Math.round(p.growth5Pct * 1000) / 10;
      if (p.growth10Pct != null) p.growth10Pct = Math.round(p.growth10Pct * 1000) / 10;
    }
  }
  return out;
}

function parseCsv(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const cells: string[] = [];
      let cur = "";
      let quoted = false;
      for (const ch of line) {
        if (ch === '"') quoted = !quoted;
        else if (ch === "," && !quoted) {
          cells.push(cur);
          cur = "";
        } else cur += ch;
      }
      cells.push(cur);
      return cells;
    });
}

async function readRows(file: string): Promise<Row[]> {
  if (file.endsWith(".csv")) return parseCsv(readFileSync(file, "utf8"));
  const XLSX = await import("xlsx");
  const wb = XLSX.read(readFileSync(file));
  const wanted = arg("sheet");
  const sheetName =
    wanted ??
    wb.SheetNames.find((n: string) => /occupation/i.test(n) && !/major|industry|skill|region/i.test(n)) ??
    wb.SheetNames[0];
  console.log(`Reading sheet "${sheetName}" (available: ${wb.SheetNames.join(", ")})`);
  return XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], { header: 1, raw: true });
}

async function main() {
  const args = process.argv.slice(2);
  let file: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") continue;
    if (args[i].startsWith("--")) i++; // skip the option's value
    else file ??= args[i];
  }
  if (!file) {
    console.error("Usage: npm run data:import-jsa -- <projections.xlsx|.csv> [--dry-run] [--sheet name] [--code-col n --g5-col n --g10-col n]");
    process.exit(1);
  }
  const rows = await readRows(file);

  let detected = detectColumns(rows);
  const override = ["code-col", "g5-col", "g10-col"].some((k) => arg(k));
  if (override) {
    const col = (k: string) => (arg(k) ? Number(arg(k)) - 1 : null);
    detected = {
      headerRow: Number(arg("header-row") ?? 1) - 1,
      cols: { code: col("code-col") ?? 0, name: col("name-col") ?? 1, g5: col("g5-col"), g10: col("g10-col"), level: col("level-col") },
    };
  }
  if (!detected) {
    console.error("Couldn't find the code and growth % columns. Pass --code-col, --g5-col and --g10-col.");
    process.exit(1);
  }
  const projections = parseRows(rows, detected.cols, detected.headerRow + 1);
  if (!projections.length) {
    console.error("No 4-digit occupation rows found. Check the sheet and column options.");
    process.exit(1);
  }

  const jsa = JSON.parse(readFileSync(OUT, "utf8"));
  const occupations = JSON.parse(readFileSync(resolve(import.meta.dirname, "../data/occupations/occupations.json"), "utf8"));
  for (const p of projections) {
    jsa.occupations[p.code] = {
      name: p.name,
      growth5Pct: p.growth5Pct,
      growth10Pct: p.growth10Pct,
      ...(p.employed2025k != null ? { employed2025k: p.employed2025k } : {}),
    };
  }
  jsa.source.coverage = `Occupation-level projections imported from ${file.split("/").at(-1)} on ${new Date().toISOString().slice(0, 10)}.`;

  const ours: { anzsco: string; title: string }[] = occupations.occupations;
  const missing = ours.filter((o) => !projections.some((p) => p.code === o.anzsco));
  console.log(`Parsed ${projections.length} occupations. Matched ${ours.length - missing.length} of ${ours.length} in our list.`);
  if (missing.length) console.log(`No projection for: ${missing.map((o) => `${o.title} (${o.anzsco})`).join("; ")}`);

  if (process.argv.includes("--dry-run")) {
    console.log("Dry run: nothing written.");
    return;
  }
  writeFileSync(OUT, JSON.stringify(jsa, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

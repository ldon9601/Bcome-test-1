import assert from "node:assert/strict";
import { test } from "node:test";
import { detectColumns, parseRows } from "../scripts/import-jsa.ts";

// Layout modelled on JSA's projections workbook. The numbers are made up for the test.
const sheet = [
  ["Employment Projections by Occupation"],
  [],
  ["ANZSCO Code", "Occupation", "Employment level - May 2025 ('000)", "Projected employment level - May 2030 ('000)", "Projected employment growth - five years to May 2030 (%)", "Projected employment level - May 2035 ('000)", "Projected employment growth - ten years to May 2035 (%)"],
  ["1", "Managers", 1900, 2000, 7.7, 2100, 14.9],
  ["3411", "Electricians", 180.5, 200, 10.8, 215, 19.1],
  ["2544", "Registered Nurses", 330, 360, 9.1, 390, 18.2],
  ["Total", "", 14701, 15662, 6.5, 16655, 13.3],
];

test("finds the header row and columns", () => {
  const d = detectColumns(sheet)!;
  assert.equal(d.headerRow, 2);
  assert.equal(d.cols.code, 0);
  assert.equal(d.cols.name, 1);
  assert.equal(d.cols.g5, 4);
  assert.equal(d.cols.g10, 6);
  assert.equal(d.cols.level, 2);
});

test("keeps only 4-digit occupations", () => {
  const d = detectColumns(sheet)!;
  const rows = parseRows(sheet, d.cols, d.headerRow + 1);
  assert.deepEqual(rows.map((r) => r.code), ["3411", "2544"]);
  assert.deepEqual(rows[0], { code: "3411", name: "Electricians", growth5Pct: 10.8, growth10Pct: 19.1, employed2025k: 180.5 });
});

test("converts fractions to percentages", () => {
  const fractions = sheet.map((r, i) => (i >= 3 ? r.map((c, j) => (j === 4 || j === 6 ? (c as number) / 100 : c)) : r));
  const d = detectColumns(fractions)!;
  const rows = parseRows(fractions, d.cols, d.headerRow + 1);
  assert.equal(rows[0].growth10Pct, 19.1);
});

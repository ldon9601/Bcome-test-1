import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEarningsCsv } from "../scripts/import-earnings.ts";

test("parses OSCA codes and weekly earnings, flagging bad rows", () => {
  const { rows, problems } = parseEarningsCsv(
    'osca,medianWeekly,name\n381231,"1,900",Electricians\n2654,2100,Registered Nurses\n2544,abc,Wrong\n12,1500,Too short\n',
  );
  assert.deepEqual(rows, [
    { osca: "381231", medianWeekly: 1900, name: "Electricians" },
    { osca: "2654", medianWeekly: 2100, name: "Registered Nurses" },
  ]);
  assert.equal(problems.length, 2);
});

test("needs the osca and medianWeekly columns", () => {
  assert.deepEqual(parseEarningsCsv("code,pay\n2654,2000").rows, []);
});

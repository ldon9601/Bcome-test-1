// Reads `npm audit --json` on stdin and reports each vulnerable package as a GitHub annotation and
// in the job summary. Exits 1 when anything is high or critical (moderate and low are reported
// but don't fail the check), so the Security audit check fails only for serious problems.
import { appendFileSync } from "node:fs";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const audit = JSON.parse(raw || "{}");
const vulns = Object.values(audit.vulnerabilities ?? {});
const rank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const rows = [];
for (const v of vulns) {
  const advisories = v.via.filter((x) => typeof x === "object");
  const through = v.via.filter((x) => typeof x === "string");
  const fix = v.fixAvailable === false ? "no fix yet" : v.fixAvailable === true ? "npm audit fix" : `${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? " (major)" : ""}`;
  const what = advisories.length ? advisories.map((a) => `${a.title} (${a.url}, affects ${a.range})`).join("; ") : `via ${through.join(", ")}`;
  const line = `${v.severity.toUpperCase()} ${v.name} ${v.range} — ${what} — fix: ${fix}${v.isDirect ? " — direct dependency" : ""}`;
  rows.push({ severity: v.severity, line });
  const level = rank[v.severity] >= rank.high ? "error" : "warning";
  console.log(`::${level} title=npm audit: ${v.name}::${line}`);
}
rows.sort((a, b) => rank[b.severity] - rank[a.severity]);
const m = audit.metadata?.vulnerabilities ?? {};
const summary = [`### npm audit: ${m.critical ?? 0} critical, ${m.high ?? 0} high, ${m.moderate ?? 0} moderate, ${m.low ?? 0} low`, "", ...rows.map((r) => `- ${r.line}`)].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
process.exit((m.critical ?? 0) + (m.high ?? 0) > 0 ? 1 : 0);

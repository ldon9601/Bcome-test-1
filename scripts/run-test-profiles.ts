/**
 * Runs the imaginary test students through the full pipeline and writes their plans
 * to test-output/ for a careers adviser to review.
 *
 *   npm run test:profiles             # offline template plans
 *   ANTHROPIC_API_KEY=... npm run test:profiles   # AI-written plans
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { advise } from "../src/lib/advise.ts";
import { questionBank } from "../src/lib/data.ts";
import type { CareerPlan } from "../src/lib/plan/types.ts";
import { PERSONAS, simulate } from "../tests/fixtures/personas.ts";

const outDir = resolve(import.meta.dirname, "../test-output");
mkdirSync(outDir, { recursive: true });

function toMarkdown(title: string, asked: number, result: Awaited<ReturnType<typeof advise>>): string {
  const { profile, matches, plan } = result;
  const p: CareerPlan = plan;
  const lines = [
    `# ${title}`,
    "",
    `Holland code **${profile.riasec.code}** · ${asked} questions asked · plan by ${p.meta.generatedBy}${p.meta.model ? ` (${p.meta.model})` : ""}` +
      (p.meta.fallbackReason ? ` · fell back to template: ${p.meta.fallbackReason}` : ""),
    "",
    `Interest scores: ${Object.entries(profile.riasec.scores).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
    "",
    "## Top matches",
    "",
    "| # | Career | Fit | 10-yr growth | 10-yr | 15-yr (indicative) |",
    "| --- | --- | --- | --- | --- | --- |",
    ...matches.map(
      (m, i) =>
        `| ${i + 1} | ${m.occupation.title} | ${m.score} | ${m.outlook.growth10Pct ?? "–"}%${m.outlook.basis === "jsa-occupation" ? "" : " (est.)"} | ${m.outlook.band10} | ${m.outlook.band15} |`,
    ),
    "",
    "## Plan",
    "",
    p.summary,
    "",
    ...p.topCareers.flatMap((c) => [`### ${c.title}`, "", c.whyItFits, "", `**Outlook:** ${c.outlook}`, "", `**How to get there:** ${c.howToGetThere}`, ""]),
    ...p.stages.flatMap((s) => [`### ${s.title} (${s.timeframe})`, "", ...s.actions.map((a) => `- ${a}`), ""]),
    "### Future of work",
    "",
    ...p.futureOfWork.map((f) => `- ${f}`),
    "",
    "### Also worth a look",
    "",
    ...p.alternatives.map((a) => `- **${a.title}**: ${a.why}`),
    "",
    "### This term",
    "",
    ...p.nextSteps.map((n) => `1. ${n}`),
    "",
    "### Keep in mind",
    "",
    ...p.caveats.map((c) => `- ${c}`),
    "",
    `_Data: ${p.meta.dataSource}_`,
    "",
  ];
  return lines.join("\n");
}

const summary: string[] = [];
for (const persona of PERSONAS) {
  const { answers, asked } = simulate(questionBank, persona);
  const result = await advise(answers, { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL });
  writeFileSync(resolve(outDir, `${persona.key}.md`), toMarkdown(persona.name, asked, result));
  const top5 = result.matches.slice(0, 5).map((m) => m.occupation.id);
  const ok = !persona.expectAnyOf.length || persona.expectAnyOf.some((id) => top5.includes(id));
  summary.push(
    `${ok ? "✓" : "✗"} ${persona.key.padEnd(16)} ${result.profile.riasec.code}  ${String(asked).padStart(2)} qs  ` +
      result.matches.slice(0, 3).map((m) => `${m.occupation.title} (${m.score})`).join(", "),
  );
}
console.log(summary.join("\n"));
console.log(`\nPlans written to ${outDir}`);

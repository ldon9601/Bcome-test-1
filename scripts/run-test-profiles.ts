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
import { formatRange, formatYears, ROUTE_LABEL } from "../src/lib/careers/facts.ts";
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
    "| # | Career | OSCA | Overall | Personal fit | Future opportunity | Pathway feasibility | 10-yr growth | Starting pay | Years after school |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...matches.map(
      (m, i) =>
        `| ${i + 1} | ${m.occupation.title} | ${m.occupation.osca} | ${m.score} | ${m.scores.personalFit.score} | ${m.scores.futureOpportunity.score} | ${m.scores.pathwayFeasibility.score} | ` +
        `${m.outlook.growth10Pct ?? "–"}%${m.outlook.basis === "jsa-occupation" ? "" : " (est.)"} | ${formatRange(m.occupation.salary.entry)} | ${formatYears(m.occupation.timeToQualify.years)} |`,
    ),
    "",
    "## Plan",
    "",
    p.summary,
    "",
    ...p.topCareers.flatMap((c) => {
      const f = c.facts!;
      const sc = c.scores!;
      return [
        `### ${c.title} (OSCA ${f.osca})`,
        "",
        `Personal fit ${sc.personalFit} · Future opportunity ${sc.futureOpportunity} · Pathway feasibility ${sc.pathwayFeasibility}`,
        "",
        c.whyItFits,
        "",
        `**Outlook:** ${c.outlook}`,
        "",
        `**How to get there:** ${c.howToGetThere}`,
        "",
        `**Time to qualify:** ${formatYears(f.timeToQualify.years)} after Year 12 (about ${formatYears(f.timeToQualify.fromNow)} from now) to reach: ${f.timeToQualify.milestone}`,
        "",
        `**Pay (indicative):** ${formatRange(f.salary.entry)} starting, ${formatRange(f.salary.experienced)} experienced${f.salary.note ? `. ${f.salary.note}` : ""}`,
        "",
        `**Skills:** ${f.skills.join(", ")}. Core: ${f.coreCompetencies.join(", ")}`,
        "",
        ...f.pathways.map((pw) => `- ${ROUTE_LABEL[pw.route]}: ${pw.qualification ? `${pw.qualification.title} (AQF ${pw.qualification.aqfLevel})` : pw.description}${pw.skillsBuilt.length ? `, builds ${pw.skillsBuilt.join(", ")}` : ""}`),
        "",
        f.relatedCareers.length ? `**Skills also lead to:** ${f.relatedCareers.map((r) => `${r.title} (${r.sharedSkills.join(", ")})`).join("; ")}` : "",
        "",
      ];
    }),
    ...p.stages.flatMap((s) => [`### ${s.title} (${s.timeframe})`, "", ...s.actions.map((a) => `- ${a}`), ""]),
    "### Future of work",
    "",
    ...p.futureOfWork.map((f) => `- ${f}`),
    "",
    "### Also worth a look",
    "",
    ...p.alternatives.map((a) => `- **${a.title}**: ${a.why}`),
    "",
    ...(p.skillsBridge?.length ? ["### Skills worth building whichever you choose", "", ...p.skillsBridge.map((sk) => `- ${sk}`), ""] : []),
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
  const top5 = result.matches.slice(0, 5).map((m) => m.occupation.osca);
  const ok = !persona.expectAnyOf.length || persona.expectAnyOf.some((id) => top5.includes(id));
  summary.push(
    `${ok ? "✓" : "✗"} ${persona.key.padEnd(16)} ${result.profile.riasec.code}  ${String(asked).padStart(2)} qs  ` +
      result.matches.slice(0, 3).map((m) => `${m.occupation.title} (${m.score}: ${m.scores.personalFit.score}/${m.scores.futureOpportunity.score}/${m.scores.pathwayFeasibility.score})`).join(", "),
  );
}
console.log(summary.join("\n"));
console.log(`\nPlans written to ${outDir}`);

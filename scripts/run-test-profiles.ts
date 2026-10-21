/**
 * Runs the imaginary test students through the full pipeline and writes their results
 * to test-output/ for a careers adviser to review.
 *
 *   npm run test:profiles                          # offline template plans
 *   ANTHROPIC_API_KEY=... npm run test:profiles    # AI-written plans
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { advise } from "../src/lib/advise.ts";
import { formatRange, formatYears, ROUTE_LABEL } from "../src/lib/careers/facts.ts";
import { questionBank } from "../src/lib/data.ts";
import { careerDnaView } from "../src/lib/plan/context.ts";
import { PERSONAS, simulate } from "../tests/fixtures/personas.ts";

const outDir = resolve(import.meta.dirname, "../test-output");
mkdirSync(outDir, { recursive: true });

const bar = (n: number) => "█".repeat(Math.round(n / 10)).padEnd(10, "░");
const GROUP_TITLE = { best: "Best matches", explore: "Worth exploring", wildcard: "Wildcard", other: "Other" } as const;

function toMarkdown(title: string, asked: number, result: Awaited<ReturnType<typeof advise>>): string {
  const { profile, plan } = result;
  const dna = careerDnaView(profile);
  const lines: string[] = [
    `# ${title}`,
    "",
    `${asked} questions · Holland code **${profile.riasec.code}** · plan by ${plan.meta.generatedBy}${plan.meta.model ? ` (${plan.meta.model})` : ""} · instrument v${plan.meta.instrumentVersion}` +
      (plan.meta.fallbackReason ? ` · fell back to template: ${plan.meta.fallbackReason}` : ""),
    "",
    "## Your Career DNA",
    "",
    "```",
    ...dna.dimensions.map((d) => `${d.label.padEnd(32)} ${bar(d.score)} ${d.score}`),
    "",
    "CORE INTERESTS",
    ...dna.interests.map((d) => `${d.label.padEnd(32)} ${bar(d.score)} ${d.score}`),
    "",
    "YOUR STRONGEST SIGNALS",
    ...dna.strongestSignals.map((d) => `${d.label.padEnd(32)} ${d.score}`),
    "",
    "WHAT YOU VALUE (relative to your other values)",
    ...dna.values.map((d) => `${d.label.padEnd(32)} ${d.score}`),
    "```",
    "",
    `**What this suggests:** ${plan.dnaSummary}`,
    "",
    "## Careers that fit you",
    "",
    plan.summary,
    "",
    "| Group | Career | OSCA | Personal fit | Opportunity | Pathway | Match | Confidence |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...plan.careers.map(
      (c) =>
        `| ${GROUP_TITLE[c.group!]} | ${c.title} | ${c.occupationId} | **${c.scores!.personalFit}** | ${c.scores!.futureOpportunity} | ${c.scores!.pathwayFeasibility}` +
        `${c.improvement ? ` (→${c.improvement.to})` : ""} | ${c.matchScore}% | ${c.confidence!.level} |`,
    ),
    "",
  ];
  for (const c of plan.careers) {
    const f = c.facts!;
    lines.push(
      `### ${GROUP_TITLE[c.group!]}: ${c.title}`,
      "",
      `Personal fit **${c.scores!.personalFit}** · Future opportunity ${c.scores!.futureOpportunity} · Pathway feasibility ${c.scores!.pathwayFeasibility} · Match ${c.matchScore}% · Confidence ${c.confidence!.level}${c.confidence!.note ? ` (${c.confidence!.note})` : ""}`,
      "",
      c.whyItFits,
      "",
      "**Why this matches you**",
      "",
      ...c.strengths!.map((s) => `- ${s.label.padEnd(28)} ${"+".repeat(s.strength)}`),
      "",
      ...(c.challenges!.length ? ["**Potential challenges**", "", ...c.challenges!.map((x) => `- ${x}`), ""] : []),
      "**Future outlook**",
      "",
      `Employment outlook ${c.future!.employment} · Shortage ${c.future!.shortage ? "yes" : "no"} · AI augmentation ${c.future!.aiAugmentation} · AI automation ${c.future!.aiAutomation} · Income ${c.future!.income} · Education ${c.future!.education}`,
      "",
      `**How to get there:** ${c.howToGetThere}`,
      "",
      `**Time to qualify:** ${formatYears(f.timeToQualify.years)} after Year 12 (about ${formatYears(f.timeToQualify.fromNow)} from now) · **Pay (indicative):** ${formatRange(f.salary.entry)} starting, ${formatRange(f.salary.experienced)} experienced`,
      "",
      ...f.pathways.map((pw) => `- ${ROUTE_LABEL[pw.route]}: ${pw.qualification ? `${pw.qualification.title} (AQF ${pw.qualification.aqfLevel})` : pw.description}`),
      "",
    );
  }
  lines.push(`## Your journey towards ${plan.journey.title}`, "", "| Period | Focus | Actions |", "| --- | --- | --- |");
  for (const p of plan.journey.periods) lines.push(`| ${p.period} | ${p.focus} | ${p.actions.map((a) => `**${a.type}:** ${a.text}`).join("<br>")} |`);
  lines.push(
    "",
    "## How work is changing",
    "",
    ...plan.futureOfWork.map((f) => `- ${f}`),
    "",
    ...(plan.skillsBridge?.length ? ["## Skills worth building whichever you choose", "", ...plan.skillsBridge.map((sk) => `- ${sk}`), ""] : []),
    "## This term",
    "",
    ...plan.nextSteps.map((n) => `1. ${n}`),
    "",
    "## Keep in mind",
    "",
    ...plan.caveats.map((c) => `- ${c}`),
    "",
    `_Data: ${plan.meta.dataSource}_`,
    "",
  );
  return lines.join("\n");
}

const summary: string[] = [];
for (const persona of PERSONAS) {
  const { answers, asked } = simulate(questionBank, persona);
  const result = await advise(answers, { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL });
  writeFileSync(resolve(outDir, `${persona.key}.md`), toMarkdown(persona.name, asked, result));
  const recommended = result.plan.careers.map((c) => c.occupationId);
  const ok = !persona.expectAnyOf.length || persona.expectAnyOf.some((id) => recommended.includes(id));
  summary.push(
    `${ok ? "✓" : "✗"} ${persona.key.padEnd(16)} ${result.profile.riasec.code}  ` +
      result.plan.careers.slice(0, 3).map((c) => `${c.title} (fit ${c.scores!.personalFit}, match ${c.matchScore})`).join(", "),
  );
}
console.log(summary.join("\n"));
console.log(`\nPlans written to ${outDir}`);

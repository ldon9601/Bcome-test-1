import { formatRange, formatYears } from "../careers/facts.ts";
import type { ContextCareer, PlanContext } from "./context.ts";
import { buildJourney, chooseRoute } from "./journey.ts";
import type { CareerPlan, PlanCareer } from "./types.ts";

/**
 * Deterministic plan writer. Used when no AI key is configured, in tests, and as the
 * fallback when an AI response fails validation. Everything comes from the plan context.
 */

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/** "ICT Manager" -> "ICT manager", "Electrician" -> "electrician": lower-case words but keep acronyms. */
export function inSentence(title: string): string {
  return title.replace(/\b([A-Za-z])([a-z]*)\b/g, (_w, a: string, b: string) => a.toLowerCase() + b);
}

function howToGetThere(c: ContextCareer, ctx: PlanContext): string {
  const route = chooseRoute(c, ctx.student.educationPaths);
  const paths = [...c.facts.pathways].sort((a, b) => Number(b.route === route) - Number(a.route === route));
  const first = `${paths[0].description} (${formatYears(paths[0].years)})`;
  return paths.length > 1 ? `${first}. Another route: ${paths[1].description}.` : `${first}.`;
}

/** "your realistic interests", "your confidence in practical skills", "the importance you place on job security". */
export function strengthPhrase(s: { label: string; kind: string }): string {
  const l = inSentence(s.label);
  switch (s.kind) {
    case "interest":
      return `your ${l}`;
    case "skill":
      return `your confidence in ${l}`;
    case "value":
      return `the importance you place on ${l}`;
    case "environment":
      return `your preference for ${l}`;
    default:
      return `your enjoyment of ${s.label.replace(/^Enjoying /, "")}`;
  }
}

/** Why it matches, personal fit first, then the trade-offs with opportunity and pathway. */
export function whyItFits(c: ContextCareer): string {
  const top = c.strengths.slice(0, 3).map(strengthPhrase);
  const list = top.length > 1 ? `${top.slice(0, -1).join(", ")} and ${top.at(-1)}` : top[0];
  const fit = top.length ? `It lines up with ${list}.` : "It fits the overall pattern of your answers.";
  const band = (n: number) => (n >= 80 ? 2 : n >= 60 ? 1 : 0);
  const opp = ["The job outlook is weaker, so keep a second option in mind.", "It has a steady job outlook.", "It also has a strong job outlook."][band(c.scores.futureOpportunity)];
  const path = c.improvement
    ? ` Your pathway score could rise from ${c.scores.pathwayFeasibility} to about ${c.improvement.to} ${c.improvement.action}.`
    : band(c.scores.pathwayFeasibility) === 0
      ? " Getting in will take extra planning."
      : "";
  return `${fit} ${opp}${path}`;
}

/** Skills shared by the best matches: worth building whichever one the student picks. */
function skillsBridge(ctx: PlanContext): string[] {
  const best = ctx.careers.filter((c) => c.group === "best");
  const counts = new Map<string, number>();
  for (const c of best) for (const sk of new Set([...c.facts.skills, ...c.facts.coreCompetencies])) counts.set(sk, (counts.get(sk) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([sk]) => sk).slice(0, 5);
}

/** Attaches the data-only fields (scores, facts, evidence) to a written career entry. */
export function attachFacts(written: Pick<PlanCareer, "occupationId" | "title" | "whyItFits" | "outlook" | "howToGetThere">, c: ContextCareer): PlanCareer {
  return {
    ...written,
    group: c.group,
    matchScore: c.matchScore,
    scores: c.scores,
    strengths: c.strengths,
    challenges: c.challenges,
    future: c.future,
    improvement: c.improvement,
    confidence: c.confidence,
    facts: c.facts,
  };
}

/** One career's plan entry written from Bcome's templates (no AI), e.g. for a career the student already had in mind. */
export function templateCareer(c: ContextCareer, ctx: PlanContext): PlanCareer {
  return attachFacts({ occupationId: c.occupationId, title: c.title, whyItFits: whyItFits(c), outlook: c.outlook.summary, howToGetThere: howToGetThere(c, ctx) }, c);
}

export function templatePlan(ctx: PlanContext, generatedAt = new Date().toISOString()): CareerPlan {
  const s = ctx.student;
  const [first, second] = ctx.careers;
  const opening = s.profileIsFlat
    ? "Your interests are spread fairly evenly, so these careers are a starting point to explore rather than a final answer."
    : `Your strongest interests are ${s.hollandCodeMeaning}.`;
  const tradeRoute = s.educationPaths.some((p) => p === "apprenticeship" || p === "work_learn");
  return {
    summary:
      `${opening} ${first.title}${second ? ` and ${inSentence(second.title)}` : ""} ${second ? "are" : "is"} your strongest personal fit` +
      `${second ? "s" : ""}. Each career below shows how well it fits you, its future opportunities and how realistic the pathway is from where you are now.`,
    hollandCode: s.hollandCode,
    dnaSummary: ctx.careerDna.summary,
    careers: ctx.careers.map((c) =>
      attachFacts({ occupationId: c.occupationId, title: c.title, whyItFits: whyItFits(c), outlook: c.outlook.summary, howToGetThere: howToGetThere(c, ctx) }, c),
    ),
    journey: buildJourney(ctx),
    futureOfWork: unique([
      ...ctx.labourMarket.headlines.slice(0, 1),
      "JSA's 2035 projections don't include the effects of generative AI, so AI's likely impact is scored separately for each career.",
      ...ctx.careers.filter((c) => c.group === "best").flatMap((c) => c.outlook.fifteenYearReasons.slice(-1)),
    ]).slice(0, 4),
    skillsBridge: skillsBridge(ctx),
    nextSteps: [
      `Talk to your careers adviser about ${inSentence(first.title)} and bring this plan.`,
      tradeRoute
        ? `Find two employers or training providers for ${inSentence(first.title)} near you.`
        : `Look up two courses for ${inSentence(first.title)} and note their entry requirements.`,
      "Talk to someone who works in one of these jobs about what a normal day is like.",
      "Come back for a check-in in six months so we can update your plan.",
    ],
    caveats: [
      ...unique(ctx.careers.slice(0, 3).flatMap((c) => c.cautions)).slice(0, 3),
      `Pay is a rough guide (for example ${formatRange(first.facts.salary.entry)} starting as ${/^[aeiou]/i.test(first.title) ? "an" : "a"} ${inSentence(first.title)}). Job projections are estimates, and entry requirements differ between institutions, so always check the course page.`,
    ],
    meta: { generatedBy: "template", generatedAt, dataSource: ctx.labourMarket.source, instrumentVersion: ctx.instrumentVersion },
  };
}

import type { PlanContext } from "./context.ts";
import { formatRange, formatYears } from "../careers/facts.ts";
import type { CareerPlan, PlanStage } from "./types.ts";

/**
 * Deterministic plan writer. Used when no AI key is configured, in tests, and as the
 * fallback when an AI response fails validation. Everything comes from the plan context.
 */

type Career = PlanContext["topCareers"][number];

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/** "ICT Manager" -> "ICT manager", "Electrician" -> "electrician": lower-case words but keep acronyms. */
export function inSentence(title: string): string {
  return title.replace(/\b([A-Za-z])([a-z]*)\b/g, (_w, a: string, b: string) => a.toLowerCase() + b);
}

const aOrAn = (w: string) => `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;

const isTradeRoute = (pref: string) => pref === "apprenticeship" || pref === "work";

const ROUTE_ORDER: Record<string, string[]> = {
  apprenticeship: ["apprenticeship", "traineeship", "cadetship", "vet", "other", "university"],
  work: ["apprenticeship", "traineeship", "cadetship", "other", "vet", "university"],
  vet: ["vet", "traineeship", "apprenticeship", "cadetship", "other", "university"],
  university: ["university", "cadetship", "vet", "other", "apprenticeship", "traineeship"],
  unsure: ["university", "vet", "apprenticeship", "traineeship", "cadetship", "other"],
};

function howToGetThere(c: Career, pref: string): string {
  const order = ROUTE_ORDER[pref] ?? ROUTE_ORDER.unsure;
  const paths = [...c.facts.pathways].sort((a, b) => order.indexOf(a.route) - order.indexOf(b.route));
  const first = `${paths[0].description} (${formatYears(paths[0].years)})`;
  return paths.length > 1 ? `${first}. Another route: ${paths[1].description}.` : `${first}.`;
}

function schoolActions(ctx: PlanContext): string[] {
  const s = ctx.student;
  const careers = ctx.topCareers;
  const required = unique(careers.flatMap((c) => c.subjectsOftenRequired));
  const helpful = unique(careers.flatMap((c) => c.subjectsHelpful)).filter((x) => !required.includes(x)).slice(0, 4);
  const first = careers[0];
  const actions: string[] = [];

  if (s.yearLevel === 10) {
    if (required.length) actions.push(`Choose ${required.join(" and ")} for Years 11 and 12. Courses for your top careers often require it.`);
    if (helpful.length) actions.push(`Subjects that build useful skills: ${helpful.join(", ")}.`);
    actions.push(`Ask your careers adviser about work experience related to ${inSentence(first.title)}.`);
    if (s.studyPreference === "apprenticeship" || s.studyPreference === "vet") {
      actions.push("Ask whether your school offers VET subjects or a school-based apprenticeship from Year 11.");
    }
  } else if (s.yearLevel === 11) {
    if (required.length) actions.push(`Check you are on track with ${required.join(" and ")}, which courses often require.`);
    actions.push(
      isTradeRoute(s.studyPreference)
        ? "Go to a trades expo or TAFE open day and talk to apprentices about their first year."
        : "Go to at least two university or TAFE open days and talk to current students.",
    );
    actions.push(`Get some real-world experience: a part-time job, volunteering or a short course linked to ${inSentence(first.title)}.`);
    if (s.studyPreference === "apprenticeship") actions.push("Ask your school about a school-based apprenticeship or traineeship.");
  } else {
    if (s.studyPreference === "university" || s.studyPreference === "unsure") {
      actions.push(`Apply through ${s.admissionsCentre}. Check its key dates now so you don't miss early rounds.`);
      actions.push("Look up early-offer and alternative-entry schemes; many use Year 11 results or a recommendation.");
    }
    if (s.studyPreference === "apprenticeship" || s.studyPreference === "work") {
      actions.push("Start contacting employers and group training organisations about apprenticeships starting next year.");
    }
    if (s.studyPreference === "vet") actions.push("Check TAFE enrolment dates and any fee-free TAFE places in your state.");
    actions.push("Pick a backup pathway (a diploma, a related course or a bridging course) in case your first choice doesn't come through.");
  }
  return actions;
}

function postSchoolActions(ctx: PlanContext): string[] {
  const actions = ctx.topCareers.map((c) => `${c.title}: ${howToGetThere(c, ctx.student.studyPreference)}`);
  if (isTradeRoute(ctx.student.studyPreference)) {
    actions.push("Look for employers or group training organisations that support apprentices through to their licence.");
    if (ctx.student.willingToRelocate === "local") actions.push("Ask which local employers take on apprentices; your school and TAFE often know.");
  } else {
    actions.push("Choose courses with work placements or industry projects; they lead to first jobs.");
    if (ctx.student.willingToRelocate === "local") actions.push("Check which of these courses are offered near you, including online and regional campuses.");
  }
  return actions;
}

function postSchoolTimeframe(ctx: PlanContext): string {
  const lo = Math.min(...ctx.topCareers.map((c) => c.facts.timeToQualify.years[0]));
  const hi = Math.max(...ctx.topCareers.map((c) => c.facts.timeToQualify.years[1]));
  return `About ${formatYears([lo, hi])} after school, depending on the career`;
}

function earlyCareerActions(ctx: PlanContext): string[] {
  const skills = unique(ctx.topCareers.flatMap((c) => c.facts.skills)).slice(0, 4).map(inSentence);
  return [
    "Complete any registration, licence or accreditation your job needs.",
    `Keep building the skills employers want most: ${skills.join(", ")}.`,
    "Learn to use the AI tools in your field well; they will be part of most jobs.",
    "Find a mentor at work and review this plan every year.",
    `Starting pay is roughly ${ctx.topCareers.map((c) => `${formatRange(c.facts.salary.entry)} as ${aOrAn(inSentence(c.title))}`).join(", ")}, rising with experience.`,
  ];
}

/** One sentence on how the three scores balance out, e.g. a strong fit with a harder pathway. */
export function tradeOff(c: Career): string {
  const band = (n: number) => (n >= 80 ? 2 : n >= 60 ? 1 : 0);
  const fit = ["It's a looser fit with your interests", "It suits some of your interests", "It suits your interests and values well"][band(c.scores.personalFit)];
  const future = ["has a weaker job outlook", "has a steady job outlook", "has a strong job outlook"][band(c.scores.futureOpportunity)];
  const pathway = [
    "but getting in will take extra planning",
    "and the way in is realistic with some planning",
    "and the way in fits your plans",
  ][band(c.scores.pathwayFeasibility)];
  const joiner = band(c.scores.pathwayFeasibility) === 0 ? " " : ", ";
  return `${fit}, ${future}${joiner}${pathway}.`.replace(", and", " and");
}

/** Skills shared by the top careers: worth building whichever one the student picks. */
function skillsBridge(ctx: PlanContext): string[] {
  const counts = new Map<string, number>();
  for (const c of ctx.topCareers) for (const sk of new Set([...c.facts.skills, ...c.facts.coreCompetencies])) counts.set(sk, (counts.get(sk) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([sk]) => sk).slice(0, 5);
}

export function templatePlan(ctx: PlanContext, generatedAt = new Date().toISOString()): CareerPlan {
  const s = ctx.student;
  const [first, second] = ctx.topCareers;
  const yearsLeft = { 10: "Years 10 to 12", 11: "Years 11 and 12", 12: "Year 12" }[s.yearLevel];

  const stages: PlanStage[] = [
    { id: "school", title: "Finish school strong", timeframe: yearsLeft, actions: schoolActions(ctx) },
    { id: "post-school", title: "Study and training after school", timeframe: postSchoolTimeframe(ctx), actions: postSchoolActions(ctx) },
    { id: "early-career", title: "Your first years at work", timeframe: "First 3 years of work", actions: earlyCareerActions(ctx) },
  ];

  const flat = s.profileIsFlat ? " It's worth trying out a few of these before you decide." : "";
  const opening = s.profileIsFlat
    ? "Your interests are spread fairly evenly, with no single area standing out yet. That's common, and it keeps lots of doors open. "
    : `Your strongest interests are ${s.hollandCodeMeaning}. `;
  return {
    summary:
      opening +
      `Careers like ${inSentence(first.title)}${second ? ` and ${inSentence(second.title)}` : ""} fit ${s.profileIsFlat ? "your answers" : "those interests"}` +
      (["strong", "good"].includes(first.outlook.tenYearBand) ? " and have a positive job outlook." : ".") +
      flat,
    hollandCode: s.hollandCode,
    topCareers: ctx.topCareers.map((c) => ({
      occupationId: c.occupationId,
      title: c.title,
      whyItFits: tradeOff(c),
      outlook: c.outlook.summary,
      howToGetThere: howToGetThere(c, s.studyPreference),
      scores: c.scores,
      facts: c.facts,
    })),
    stages,
    futureOfWork: unique([
      ...ctx.labourMarket.headlines.slice(0, 1),
      ...ctx.topCareers.flatMap((c) => c.outlook.fifteenYearReasons.slice(-1)),
    ]).slice(0, 4),
    alternatives: ctx.alternativeCareers.map((c) => ({ title: c.title, why: c.reasonsItFits[0] ?? "A good fit with your profile." })),
    skillsBridge: skillsBridge(ctx),
    nextSteps: [
      `Talk to your careers adviser about ${inSentence(first.title)} and bring this plan.`,
      isTradeRoute(s.studyPreference)
        ? `Find two employers or training providers for ${inSentence(first.title)} apprenticeships near you.`
        : `Look up two courses for ${inSentence(first.title)} and note their entry requirements.`,
      "Talk to someone who works in one of these jobs about what a normal day is like.",
    ],
    caveats: [
      ...unique(ctx.topCareers.flatMap((c) => c.cautions)).slice(0, 3),
      "Job projections are estimates and can change. Entry requirements differ between institutions, so always check the course page.",
    ],
    meta: { generatedBy: "template", generatedAt, dataSource: ctx.labourMarket.source },
  };
}

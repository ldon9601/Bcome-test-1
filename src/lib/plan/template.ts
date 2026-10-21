import type { PlanContext } from "./context.ts";
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

const isTradeRoute = (pref: string) => pref === "apprenticeship" || pref === "work";

function howToGetThere(c: Career, pref: string): string {
  const p = c.pathways;
  const order =
    pref === "apprenticeship" || pref === "work"
      ? (["apprenticeship", "vet", "university"] as const)
      : pref === "vet"
        ? (["vet", "apprenticeship", "university"] as const)
        : (["university", "vet", "apprenticeship"] as const);
  const routes = order.filter((k) => p[k]).map((k) => p[k]!);
  return routes.length > 1 ? `${routes[0]}. Another route: ${routes[1]}.` : `${routes[0]}.`;
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

function earlyCareerActions(ctx: PlanContext): string[] {
  const skills = unique(ctx.topCareers.flatMap((c) => c.keySkills)).slice(0, 4);
  return [
    "Complete any registration, licence or accreditation your job needs.",
    `Keep building the skills employers want most: ${skills.join(", ")}.`,
    "Learn to use the AI tools in your field well; they will be part of most jobs.",
    "Find a mentor at work and review this plan every year.",
  ];
}

export function templatePlan(ctx: PlanContext, generatedAt = new Date().toISOString()): CareerPlan {
  const s = ctx.student;
  const [first, second] = ctx.topCareers;
  const yearsLeft = { 10: "Years 10 to 12", 11: "Years 11 and 12", 12: "Year 12" }[s.yearLevel];

  const stages: PlanStage[] = [
    { id: "school", title: "Finish school strong", timeframe: yearsLeft, actions: schoolActions(ctx) },
    { id: "post-school", title: "Study and training after school", timeframe: "1 to 4 years after school", actions: postSchoolActions(ctx) },
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
      whyItFits: c.reasonsItFits.filter((r) => r !== c.outlook.summary).slice(0, 3).join(" "),
      outlook: c.outlook.summary,
      howToGetThere: howToGetThere(c, s.studyPreference),
    })),
    stages,
    futureOfWork: unique([
      ...ctx.labourMarket.headlines.slice(0, 1),
      ...ctx.topCareers.flatMap((c) => c.outlook.fifteenYearReasons.slice(-1)),
    ]).slice(0, 4),
    alternatives: ctx.alternativeCareers.map((c) => ({ title: c.title, why: c.reasonsItFits[0] ?? "A good fit with your profile." })),
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

import { formatYears } from "../careers/facts.ts";
import type { Route } from "../careers/types.ts";
import { SKILL_DIMS, SKILL_NAMES, type EducationPath, type SkillDim } from "../questionnaire/types.ts";
import type { ContextCareer, PlanContext } from "./context.ts";
import type { JourneyPeriod } from "./types.ts";

/**
 * The Career Journey rules engine (requirements doc, sections 22–23). It builds the factual
 * skeleton, period by period, for the student's top match: school years left, the summer after
 * school, study or training, and the first years of work. The AI may reword it but not change it.
 */

const lower = (t: string) => t.replace(/\b([A-Z])([a-z]+)\b/g, (_w, a: string, b: string) => a.toLowerCase() + b);

const ACTIVITY: Record<SkillDim, string> = {
  quantitative: "Take on a maths challenge, competition or online maths course.",
  communication: "Join debating, write for a school publication or present to a group.",
  scientific: "Enter a science competition or run a small experiment and write it up.",
  digital: "Build a small coding or web project, such as a Python script that uses real data.",
  spatial: "Try CAD, 3D modelling or design software on a small project of your own.",
  practical: "Do something hands-on, such as a first aid course, practical volunteering or a build or repair project.",
  interpersonal: "Volunteer, coach a junior team or tutor younger students.",
  leadership: "Lead a club, team or school event from start to finish.",
};

/** Preferred route for the top career, given the paths the student said they'd consider. */
export function chooseRoute(career: ContextCareer, paths: EducationPath[]): Route {
  const available = career.facts.pathways.map((p) => p.route);
  const wanted: Route[] = paths.flatMap((p) =>
    ({
      university: ["university"],
      vet: ["vet"],
      apprenticeship: ["apprenticeship", "traineeship"],
      work_learn: ["apprenticeship", "traineeship", "cadetship"],
      gap_year: ["university", "vet"],
      defence_public: ["other"],
      business: [],
      unsure: [],
    })[p] as Route[],
  );
  return wanted.find((r) => available.includes(r)) ?? available[0];
}

/** The skill this career leans on where the student has most room to grow (or its most important skill). */
function growthSkill(ctx: PlanContext, career: ContextCareer): SkillDim {
  const need = career.skillProfile;
  const have = ctx.student.skills;
  const important = SKILL_DIMS.filter((d) => need[d] >= 60);
  const gaps = important.filter((d) => need[d] - have[d] > 0).sort((a, b) => need[b] - have[b] - (need[a] - have[a]));
  return gaps[0] ?? [...SKILL_DIMS].sort((a, b) => need[b] - need[a])[0];
}

/** "Registered nurse" → "Become a registered nurse"; "Working as a planner" → "Get established as a planner". */
export function milestoneFocus(milestone: string): string {
  const m = lower(milestone);
  if (m.startsWith("working as ")) return `Get established ${m.replace("working ", "")}`;
  if (/^(managing|leading)\b/.test(m)) return `Work towards ${m}`;
  return `Become ${/^[aeiou]/i.test(m) ? "an" : "a"} ${m}`;
}

const toFive = (n: number) => Math.round(n / 25) + 1;

export function buildJourney(ctx: PlanContext): { occupationId: string; title: string; periods: JourneyPeriod[] } {
  const career = ctx.careers[0];
  const s = ctx.student;
  const route = chooseRoute(career, s.educationPaths);
  const path = career.facts.pathways.find((p) => p.route === route) ?? career.facts.pathways[0];
  const other = career.facts.pathways.find((p) => p !== path);
  const title = lower(career.title);
  const isUni = route === "university";
  const isTrade = route === "apprenticeship" || route === "traineeship" || route === "cadetship";
  const skill = growthSkill(ctx, career);
  const subjects = career.missingPrerequisites;
  const keepOpen = [...new Set([...career.subjectsOftenRequired, ...career.subjectsHelpful])].slice(0, 3);
  const periods: JourneyPeriod[] = [];

  if (s.yearLevel === 10) {
    periods.push({
      id: "year-10",
      period: "Now → end of Year 10",
      focus: `Keep the path to ${title} open`,
      actions: [
        {
          type: "academic",
          text: subjects.length
            ? `Choose ${subjects.join(" and ")} for Years 11 and 12; courses for this career often require it.`
            : `Keep ${keepOpen.join(", ")} in your Year 11 and 12 subjects.`,
        },
        toFive(s.skills[skill]) < 5
          ? { type: "skills" as const, text: `Move your ${SKILL_NAMES[skill].toLowerCase()} confidence from ${toFive(s.skills[skill])}/5 towards ${toFive(s.skills[skill]) + 1}/5. ${ACTIVITY[skill]}` }
          : { type: "skills" as const, text: `Keep building on your ${SKILL_NAMES[skill].toLowerCase()}, a real strength for this career. ${ACTIVITY[skill]}` },
        { type: "exploration", text: "Ask your careers adviser about work experience or a taster day in this field." },
      ],
    });
  }
  if (s.yearLevel <= 11) {
    periods.push({
      id: "year-11",
      period: "Year 11",
      focus: isTrade ? "Get a head start on your trade" : "Build the foundations",
      actions: [
        { type: "academic", text: `Stay on track in ${keepOpen.join(", ")}.` },
        isTrade
          ? { type: "exploration", text: "Ask your school about VET subjects or a school-based apprenticeship." }
          : { type: "exploration", text: `Interview or shadow someone who works as ${/^[aeiou]/i.test(title) ? "an" : "a"} ${title}.` },
        { type: "portfolio", text: "Complete one small project you can show people, and keep a record of it." },
      ],
    });
  }
  periods.push({
    id: "year-12",
    period: "Year 12",
    focus: isUni ? "Choose and apply for the right course" : isTrade ? "Line up your apprenticeship or traineeship" : "Line up your training",
    actions: [
      isUni
        ? { type: "applications", text: `Shortlist ${path.qualification?.title ?? "relevant"} courses and compare prerequisites and selection ranks through ${s.admissionsCentre}.` }
        : isTrade
          ? { type: "applications", text: "Contact employers and group training organisations about places starting after school." }
          : { type: "applications", text: `Check enrolment dates for ${path.qualification?.title ?? "your course"}, including any fee-free TAFE places.` },
      {
        type: "alternative",
        text: other ? `Keep a backup route ready: ${other.description}.` : "Identify at least one bridging or alternative-entry option.",
      },
      ...(subjects.length && s.yearLevel === 12 ? [{ type: "academic" as const, text: `Look into a bridging course for ${subjects.join(" and ")}.` }] : []),
    ],
  });
  periods.push({
    id: "summer",
    period: "Summer after school",
    focus: "Get a head start",
    actions: [
      { type: "portfolio", text: ACTIVITY[skill] },
      { type: "work", text: "Find casual work or volunteering where you can practise working with people and taking responsibility." },
    ],
  });
  const studyLabel = isUni ? "University" : isTrade ? (route === "apprenticeship" ? "Apprenticeship" : route === "cadetship" ? "Cadetship" : "Traineeship") : "Training";
  const [lo, hi] = path.years;
  periods.push({
    id: "training-start",
    period: `${studyLabel} Year 1`,
    focus: `Start ${path.qualification?.title ?? path.description}`,
    actions: [
      { type: "study", text: `Build the core skills: ${path.skillsBuilt.slice(0, 3).map(lower).join(", ") || career.facts.skills.slice(0, 3).map(lower).join(", ")}.` },
      isUni
        ? { type: "exploration", text: "Join a student society linked to the field and start a project portfolio." }
        : { type: "exploration", text: "Ask your supervisor which tasks to master first and keep a skills log." },
    ],
  });
  if (hi > 1) {
    periods.push({
      id: "training-later",
      period: hi > 2 ? `${studyLabel} Years 2–${Math.ceil(hi)}` : `${studyLabel} Year 2`,
      focus: isUni ? "Get real-world experience" : "Build your skills to a qualified standard",
      actions: [
        isUni
          ? { type: "work", text: "Target an internship, placement or research project." }
          : { type: "study", text: `Complete your ${path.qualification?.title ?? "qualification"} (${formatYears([lo, hi])} in total).` },
        { type: "skills", text: "Add AI and digital tools used in your field to what you can do." },
      ],
    });
  }
  // Related careers that use the same skills and don't need longer training than this one.
  const related = career.facts.relatedCareers.filter((r) => r.sharedSkills.length >= 3 && r.maxYears <= career.facts.timeToQualify.years[1]).map((r) => r.title);
  periods.push({
    id: "early-career",
    period: "First two years of work",
    focus: milestoneFocus(career.facts.timeToQualify.milestone),
    actions: [
      {
        type: "work",
        text: related.length
          ? `Aim for roles as ${/^[aeiou]/i.test(title) ? "an" : "a"} ${title}. Related options that use the same skills: ${related.slice(0, 3).join(", ")}.`
          : `Aim for roles as ${/^[aeiou]/i.test(title) ? "an" : "a"} ${title}.`,
      },
      { type: "skills", text: "Build a specialist strength, and complete any registration or licence the job needs." },
    ],
  });
  return { occupationId: career.occupationId, title: career.title, periods };
}

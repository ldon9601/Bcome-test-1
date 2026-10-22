import type { StudentContext } from "./student.ts";
import type { CardState, CardStatus, EventKind, SchoolEvent } from "./types.ts";

/**
 * Real-World Action Cards: a handful of prompts each month to talk to people, go to events or
 * investigate pathways, built from the student's top careers and their school's calendar.
 */

export type CardKind = "talk" | "attend" | "investigate";

export interface ActionCard {
  key: string;
  kind: CardKind;
  title: string;
  body: string;
  /** Set for event cards. */
  date: string | null;
  eventId: string | null;
  eventKind: EventKind | null;
  link: { label: string; url: string; external: boolean } | null;
  career: string | null;
  status: CardStatus | null;
}

export const EVENT_LABEL: Record<EventKind, string> = {
  open_day: "Open day",
  work_experience: "Work experience",
  competition: "Competition",
  expo: "Careers expo",
  talk: "Careers talk",
  workshop: "Workshop",
  deadline: "Key date",
  other: "Event",
};

/** Is this event meant for this student (their year level, and a career family they matched)? */
export function eventFor(e: SchoolEvent, s: Pick<StudentContext, "yearLevel" | "careers">): { forYear: boolean; matchesCareer: boolean } {
  const forYear = !e.yearLevels.length || e.yearLevels.includes(s.yearLevel);
  const families = new Set(s.careers.slice(0, 5).map((c) => c.family));
  return { forYear, matchesCareer: e.families.length > 0 && e.families.some((f) => families.has(f)) };
}

export function actionCards(s: StudentContext, month: string, events: SchoolEvent[], states: CardState[], today: string): ActionCard[] {
  const status = new Map(states.map((x) => [x.cardKey, x.status]));
  const cards: ActionCard[] = [];
  const add = (c: Omit<ActionCard, "status">) => cards.push({ ...c, status: status.get(c.key) ?? null });
  const [first, second, third] = s.careers;

  // Events this month: open days, work experience, competitions and more, for their year level.
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  const relevant = events
    .filter((e) => e.startsOn <= monthEnd && (e.endsOn ?? e.startsOn) >= monthStart && (e.endsOn ?? e.startsOn) >= today)
    .map((e) => ({ e, f: eventFor(e, s) }))
    .filter(({ f, e }) => f.forYear && (f.matchesCareer || !e.families.length))
    .sort((a, b) => Number(b.f.matchesCareer) - Number(a.f.matchesCareer) || a.e.startsOn.localeCompare(b.e.startsOn))
    .slice(0, 4);
  for (const { e, f } of relevant) {
    const matched = f.matchesCareer ? s.careers.find((c) => e.families.includes(c.family)) : undefined;
    add({
      key: `${month}:attend:${e.id}`,
      kind: "attend",
      title: `${EVENT_LABEL[e.kind]}: ${e.title}`,
      body: matched ? `This suits your interest in ${matched.title}. ${e.description}`.trim() : e.description || "Your careers adviser added this to the school calendar.",
      date: e.startsOn,
      eventId: e.id,
      eventKind: e.kind,
      link: e.url ? { label: "Event details", url: e.url, external: true } : null,
      career: matched?.title ?? null,
    });
  }

  if (first) {
    add({
      key: `${month}:talk:${first.osca}`,
      kind: "talk",
      title: `Talk to someone who works as a ${first.title.replace(/\s*\([^)]*\)/g, "")}`,
      body: "Ask a parent, carer, teacher or your careers adviser to help you find someone. Ask what a normal day is like and how they got started.",
      date: null,
      eventId: null,
      eventKind: null,
      link: null,
      career: first.title,
    });
    const course = first.lead === "tafe" ? first.tafe : first.course;
    if (course) {
      add({
        key: `${month}:investigate:${course.qualificationId || first.osca}`,
        kind: "investigate",
        title: `Investigate ${course.course} at ${course.provider}`,
        body:
          first.lead === "tafe" || !first.course
            ? `Check the entry requirements${first.tafe?.apprenticeship ? " and how the apprenticeship works" : ""}, and whether you could start part of it at school.`
            : `Check the prerequisites, the ATAR (${first.course.atar ?? "see the course page"}) and what the course involves, such as placements.`,
        date: null,
        eventId: null,
        eventKind: null,
        link: { label: "See on Explore Uni & TAFE", url: `/explore#${course.qualificationId}`, external: false },
        career: first.title,
      });
    }
  }
  if (second) {
    add({
      key: `${month}:investigate:${second.osca}`,
      kind: "investigate",
      title: `Find out how people become a ${second.title.replace(/\s*\([^)]*\)/g, "")}`,
      body: "Read the ways in, how long it takes and what the job is like, then note one thing that surprised you.",
      date: null,
      eventId: null,
      eventKind: null,
      link: { label: "Career details", url: `/careers?career=${second.osca}`, external: false },
      career: second.title,
    });
  }
  if (third && !relevant.length) {
    add({
      key: `${month}:attend:open-day-${third.osca}`,
      kind: "attend",
      title: "Find an open day, careers expo or workplace tour",
      body: `Ask your careers adviser what's coming up, or search for events about ${third.title.toLowerCase()} near you. Many universities and TAFEs also run virtual tours all year.`,
      date: null,
      eventId: null,
      eventKind: null,
      link: null,
      career: third.title,
    });
  }
  return cards;
}


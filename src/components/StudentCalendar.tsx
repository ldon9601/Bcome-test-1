"use client";

import { activity } from "@/lib/activity/client.ts";
import { OpportunityCalendar, type CalendarEvent } from "./OpportunityCalendar.tsx";

/** The opportunity calendar for a student, with "I'm interested" saved to their account. */
export function StudentCalendar({ events, today, interested }: { events: CalendarEvent[]; today: string; interested: string[] }) {
  return (
    <OpportunityCalendar
      events={events}
      today={today}
      interested={interested}
      intro="Open days, work experience, competitions and more from your careers adviser. Starred events suit your career matches."
      onInterest={async (eventId, on) => (await activity("interest", { eventId, interested: on })).ok}
    />
  );
}

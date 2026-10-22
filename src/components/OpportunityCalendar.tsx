"use client";

import { useMemo, useState } from "react";
import type { EventKind, SchoolEvent } from "@/lib/activity/types.ts";
import { Icon, type IconName } from "./Icon.tsx";

export const KIND_STYLE: Record<EventKind, { label: string; tone: string; icon: IconName }> = {
  open_day: { label: "Open day", tone: "blue", icon: "grad" },
  work_experience: { label: "Work experience", tone: "teal", icon: "briefcase" },
  competition: { label: "Competition", tone: "amber", icon: "trophy" },
  expo: { label: "Careers expo", tone: "purple", icon: "users" },
  talk: { label: "Careers talk", tone: "pink", icon: "bulb" },
  workshop: { label: "Workshop", tone: "green", icon: "tools" },
  deadline: { label: "Key date", tone: "red", icon: "flag" },
  other: { label: "Event", tone: "slate", icon: "star" },
};

export type CalendarEvent = SchoolEvent & { matchesCareer?: boolean; interested?: number };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const addMonths = (ym: string, n: number) => {
  const d = new Date(`${ym}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const eventDates = (e: Pick<SchoolEvent, "startsOn" | "endsOn">) => (e.endsOn ? `${fmtDay(e.startsOn)} to ${fmtDay(e.endsOn)}` : fmtDay(e.startsOn));

function monthGrid(ym: string): string[] {
  const first = new Date(`${ym}-01T00:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(first.getTime() - lead * 864e5);
  const days: string[] = [];
  for (let i = 0; i < 42; i++) days.push(new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10));
  // Drop a trailing week that's all next month.
  return days.slice(35).every((d) => d.slice(0, 7) !== ym) ? days.slice(0, 35) : days;
}

const covers = (e: SchoolEvent, d: string) => e.startsOn <= d && (e.endsOn ?? e.startsOn) >= d;

/**
 * Month view of the school's opportunity calendar. Students can mark events they're interested in;
 * advisers see how many students are interested and can edit.
 */
export function OpportunityCalendar({
  events,
  today,
  interested = [],
  onInterest,
  onEdit,
  title = "Opportunity calendar",
  intro,
}: {
  events: CalendarEvent[];
  today: string;
  interested?: string[];
  onInterest?: (id: string, on: boolean) => Promise<boolean>;
  onEdit?: (e: CalendarEvent) => void;
  title?: string;
  intro?: string;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState<string | null>(null);
  const [mine, setMine] = useState(new Set(interested));
  const [busy, setBusy] = useState<string | null>(null);
  const grid = useMemo(() => monthGrid(month), [month]);
  const inMonth = events.filter((e) => e.startsOn <= `${month}-31` && (e.endsOn ?? e.startsOn) >= `${month}-01`);
  const listed = day ? events.filter((e) => covers(e, day)) : inMonth;
  const [y, m] = month.split("-").map(Number);

  const toggle = async (id: string) => {
    if (!onInterest) return;
    const on = !mine.has(id);
    setBusy(id);
    if (await onInterest(id, on)) {
      const next = new Set(mine);
      if (on) next.add(id);
      else next.delete(id);
      setMine(next);
    }
    setBusy(null);
  };

  return (
    <section className="card calendar-card" aria-labelledby="cal-title">
      <div className="group-head" style={{ marginTop: 0 }}>
        <h2 id="cal-title">
          <Icon name="clock" size={22} /> {title}
        </h2>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => (setMonth(addMonths(month, -1)), setDay(null))} aria-label="Previous month">
            <Icon name="arrowLeft" size={18} />
          </button>
          <strong aria-live="polite">
            {MONTHS[m - 1]} {y}
          </strong>
          <button className="icon-btn" onClick={() => (setMonth(addMonths(month, 1)), setDay(null))} aria-label="Next month">
            <Icon name="arrowRight" size={18} />
          </button>
          {month !== today.slice(0, 7) && (
            <button className="linkish" onClick={() => (setMonth(today.slice(0, 7)), setDay(null))}>
              Today
            </button>
          )}
        </div>
      </div>
      {intro && <p className="muted">{intro}</p>}
      <div className="cal-grid" role="grid" aria-label={`${MONTHS[m - 1]} ${y}`}>
        {DAYS.map((d) => (
          <div key={d} className="cal-dow" role="columnheader">
            {d}
          </div>
        ))}
        {grid.map((d) => {
          const evs = events.filter((e) => covers(e, d));
          const out = d.slice(0, 7) !== month;
          return (
            <button
              key={d}
              role="gridcell"
              className={`cal-day${out ? " out" : ""}${d === today ? " today" : ""}${d === day ? " selected" : ""}${evs.length ? " has" : ""}`}
              onClick={() => setDay(d === day ? null : d)}
              aria-label={`${fmtDay(d)}${evs.length ? `: ${evs.map((e) => e.title).join(", ")}` : ""}`}
              aria-pressed={d === day}
            >
              <span className="cal-num">{Number(d.slice(8))}</span>
              <span className="cal-chips">
                {evs.slice(0, 2).map((e) => (
                  <span key={e.id} className={`cal-chip ${KIND_STYLE[e.kind].tone}${e.matchesCareer ? " match" : ""}`}>
                    {e.title}
                  </span>
                ))}
                {evs.length > 2 && <span className="cal-more">+{evs.length - 2}</span>}
              </span>
              <span className="cal-dots" aria-hidden="true">
                {evs.slice(0, 3).map((e) => (
                  <span key={e.id} className={`cal-dot ${KIND_STYLE[e.kind].tone}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cal-list">
        <h3>
          {day ? fmtDay(day) : `${MONTHS[m - 1]} at a glance`}
          {day && (
            <button className="linkish" style={{ marginLeft: 10, fontSize: "0.85rem" }} onClick={() => setDay(null)}>
              Show the whole month
            </button>
          )}
        </h3>
        {listed.length === 0 ? (
          <p className="muted">{day ? "Nothing on this day." : "Nothing in the calendar this month yet."}</p>
        ) : (
          <ul className="event-list">
            {listed.map((e) => {
              const k = KIND_STYLE[e.kind];
              const past = (e.endsOn ?? e.startsOn) < today;
              return (
                <li key={e.id} className={`event-item${past ? " past" : ""}`}>
                  <span className={`event-icon ${k.tone}`} aria-hidden="true">
                    <Icon name={k.icon} size={20} />
                  </span>
                  <div className="event-main">
                    <div className="event-tags">
                      <span className={`tag ${k.tone}`}>{k.label}</span>
                      {e.matchesCareer && (
                        <span className="tag violet">
                          <Icon name="star" size={12} /> Suits your matches
                        </span>
                      )}
                      {past && <span className="tag slate">Finished</span>}
                    </div>
                    <strong>{e.title}</strong>
                    <span className="small">
                      {eventDates(e)}
                      {e.time ? ` · ${e.time}` : ""}
                      {e.location ? ` · ${e.location}` : ""}
                    </span>
                    {e.description && <p className="event-desc">{e.description}</p>}
                    {(e.yearLevels.length > 0 || typeof e.interested === "number") && (
                      <span className="small">
                        {e.yearLevels.length ? `For Year ${e.yearLevels.join(", ")}` : "All year levels"}
                        {typeof e.interested === "number" ? ` · ${e.interested} student${e.interested === 1 ? "" : "s"} interested` : ""}
                      </span>
                    )}
                  </div>
                  <div className="event-actions">
                    {e.url && (
                      <a className="button secondary small-btn" href={e.url} target="_blank" rel="noopener noreferrer">
                        Details
                      </a>
                    )}
                    {onInterest && !past && (
                      <button className={`button small-btn ${mine.has(e.id) ? "primary" : "secondary"}`} aria-pressed={mine.has(e.id)} disabled={busy === e.id} onClick={() => toggle(e.id)}>
                        {mine.has(e.id) ? (
                          <>
                            <Icon name="check" size={16} /> Interested
                          </>
                        ) : (
                          "I'm interested"
                        )}
                      </button>
                    )}
                    {onEdit && (
                      <button className="button secondary small-btn" onClick={() => onEdit(e)}>
                        Edit
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

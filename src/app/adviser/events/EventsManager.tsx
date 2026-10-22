"use client";

import { useState } from "react";
import { Field, FormError } from "@/components/forms.tsx";
import { Icon } from "@/components/Icon.tsx";
import { Modal } from "@/components/Modal.tsx";
import { eventDates, KIND_STYLE, OpportunityCalendar, type CalendarEvent } from "@/components/OpportunityCalendar.tsx";
import { FAMILY_LABELS } from "@/lib/adviser/analytics.ts";
import { activity } from "@/lib/activity/client.ts";
import { EVENT_KINDS, type EventKind, type SchoolEvent } from "@/lib/activity/types.ts";

type Draft = { id?: string; kind: EventKind; title: string; startsOn: string; endsOn: string; time: string; location: string; url: string; description: string; yearLevels: number[]; families: string[] };
const blank = (today: string): Draft => ({ kind: "open_day", title: "", startsOn: today, endsOn: "", time: "", location: "", url: "", description: "", yearLevels: [], families: [] });

function EventForm({ initial, onSaved, onDeleted, onCancel }: { initial: Draft; onSaved: (e: SchoolEvent) => void; onDeleted: (id: string) => void; onCancel: () => void }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const err = (f: string) => (error?.field === f ? error.message : null);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form
      className="evidence-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await activity<{ event: SchoolEvent }>(d.id ? "event-update" : "event-add", { ...d });
        setBusy(false);
        if (!r.ok) return setError({ message: r.error, field: r.field });
        onSaved(r.event);
      }}
    >
      <h2>{d.id ? "Edit event" : "Add an event"}</h2>
      <Field id="ev-kind" label="Type" error={err("kind")}>
        <select id="ev-kind" value={d.kind} onChange={(e) => set("kind", e.target.value as EventKind)}>
          {EVENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_STYLE[k].label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="ev-title" label="Title" hint='e.g. "UNSW Open Day" or "Year 10 work experience week"' error={err("title")}>
        <input id="ev-title" value={d.title} maxLength={120} onChange={(e) => set("title", e.target.value)} required />
      </Field>
      <div className="pair">
        <Field id="ev-start" label="Date" error={err("startsOn")}>
          <input id="ev-start" type="date" value={d.startsOn} onChange={(e) => set("startsOn", e.target.value)} required />
        </Field>
        <Field id="ev-end" label="Ends (if more than one day)" error={err("endsOn")}>
          <input id="ev-end" type="date" value={d.endsOn} min={d.startsOn} onChange={(e) => set("endsOn", e.target.value)} />
        </Field>
      </div>
      <div className="pair">
        <Field id="ev-time" label="Time (optional)" error={err("time")}>
          <input id="ev-time" value={d.time} maxLength={60} placeholder="9am to 3pm" onChange={(e) => set("time", e.target.value)} />
        </Field>
        <Field id="ev-loc" label="Location (optional)" error={err("location")}>
          <input id="ev-loc" value={d.location} maxLength={160} onChange={(e) => set("location", e.target.value)} />
        </Field>
      </div>
      <Field id="ev-url" label="Link for details or registration (optional)" error={err("url")}>
        <input id="ev-url" type="url" value={d.url} placeholder="https://" onChange={(e) => set("url", e.target.value)} />
      </Field>
      <Field id="ev-desc" label="Description" hint="What students will do, who it suits and anything they need to bring or sign up for." error={err("description")}>
        <textarea id="ev-desc" rows={4} value={d.description} maxLength={1500} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <fieldset className="field">
        <legend className="label-like">Year levels</legend>
        <div className="chips-select">
          {[10, 11, 12].map((y) => (
            <button type="button" key={y} aria-pressed={d.yearLevels.includes(y)} onClick={() => set("yearLevels", toggle(d.yearLevels, y))}>
              Year {y}
            </button>
          ))}
        </div>
        <p className="field-hint">Leave all unselected for every year level.</p>
      </fieldset>
      <fieldset className="field">
        <legend className="label-like">Career areas it suits (optional)</legend>
        <div className="chips-select small-chips">
          {Object.entries(FAMILY_LABELS).map(([k, label]) => (
            <button type="button" key={k} aria-pressed={d.families.includes(k)} onClick={() => set("families", toggle(d.families, k))}>
              {label}
            </button>
          ))}
        </div>
        <p className="field-hint">Students whose career matches are in these areas get it as an action card, starred as suiting their matches.</p>
      </fieldset>
      <FormError error={error} fields={["kind", "title", "startsOn", "endsOn", "time", "location", "url", "description"]} />
      <div className="button-row">
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : d.id ? "Save changes" : "Add to calendar"}
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        {d.id && (
          <>
            <span style={{ flex: 1 }} />
            {confirming ? (
              <button
                type="button"
                className="button danger"
                onClick={async () => {
                  const r = await activity("event-delete", { id: d.id });
                  if (!r.ok) return setError({ message: r.error });
                  onDeleted(d.id!);
                }}
              >
                Yes, delete it
              </button>
            ) : (
              <button type="button" className="button ghost danger" onClick={() => setConfirming(true)}>
                <Icon name="trash" size={16} /> Delete
              </button>
            )}
          </>
        )}
      </div>
    </form>
  );
}

export default function EventsManager({ initial, today }: { initial: CalendarEvent[]; today: string }) {
  const [events, setEvents] = useState(initial);
  const [editing, setEditing] = useState<Draft | null>(null);
  const upcoming = events.filter((e) => (e.endsOn ?? e.startsOn) >= today).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const edit = (e: CalendarEvent) =>
    setEditing({ id: e.id, kind: e.kind, title: e.title, startsOn: e.startsOn, endsOn: e.endsOn ?? "", time: e.time ?? "", location: e.location ?? "", url: e.url ?? "", description: e.description, yearLevels: e.yearLevels, families: e.families });

  return (
    <>
      <div className="button-row" style={{ marginTop: 0 }}>
        <button className="button primary" onClick={() => setEditing(blank(today))}>
          <Icon name="spark" size={18} /> Add an event
        </button>
        <span className="small">
          {upcoming.length} upcoming · {upcoming.reduce((t, e) => t + (e.interested ?? 0), 0)} student interest{upcoming.length === 1 ? "" : "s"} so far
        </span>
      </div>
      <OpportunityCalendar events={events} today={today} onEdit={edit} title="School calendar" />
      <section className="card side-card" aria-labelledby="upcoming">
        <h2 id="upcoming">Upcoming events</h2>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing coming up. Add open days, work experience dates, competitions and deadlines so students can plan ahead.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>When</th>
                  <th>For</th>
                  <th>Interested</th>
                  <th>
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className={`tag ${KIND_STYLE[e.kind].tone}`}>{KIND_STYLE[e.kind].label}</span> <strong>{e.title}</strong>
                    </td>
                    <td>{eventDates(e)}</td>
                    <td>{e.yearLevels.length ? `Year ${e.yearLevels.join(", ")}` : "All years"}</td>
                    <td>{e.interested ?? 0}</td>
                    <td>
                      <button className="linkish" onClick={() => edit(e)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Modal open={!!editing} onClose={() => setEditing(null)} label="Calendar event">
        {editing && (
          <div className="detail-body">
            <EventForm
              key={editing.id ?? "new"}
              initial={editing}
              onCancel={() => setEditing(null)}
              onSaved={(ev) => {
                setEvents((xs) => [...xs.filter((x) => x.id !== ev.id), { ...ev, interested: xs.find((x) => x.id === ev.id)?.interested ?? 0 }]);
                setEditing(null);
              }}
              onDeleted={(id) => {
                setEvents((xs) => xs.filter((x) => x.id !== id));
                setEditing(null);
              }}
            />
          </div>
        )}
      </Modal>
    </>
  );
}

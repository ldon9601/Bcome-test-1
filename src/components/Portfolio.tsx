"use client";

import Link from "next/link";
import { useState } from "react";
import { activity } from "@/lib/activity/client.ts";
import { CATEGORY_LABEL, CV_ORDER, dateRange, LIMITS } from "@/lib/activity/evidence.ts";
import { EVIDENCE_CATEGORIES, type EvidenceCategory, type EvidenceItem } from "@/lib/activity/types.ts";
import { Field, FormError } from "./forms.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { Modal } from "./Modal.tsx";

export const CATEGORY_STYLE: Record<EvidenceCategory, { icon: IconName; tone: string; hint: string }> = {
  school: { icon: "school", tone: "blue", hint: "Leadership roles, clubs, awards, projects, competitions" },
  sport: { icon: "trophy", tone: "amber", hint: "Teams, coaching, umpiring, captaincy, events" },
  work: { icon: "briefcase", tone: "teal", hint: "Part-time jobs, work experience, babysitting, family business" },
  volunteering: { icon: "heart", tone: "pink", hint: "Community groups, charities, events, helping at school" },
  other: { icon: "star", tone: "purple", hint: "Hobbies, courses, things you've made, career missions" },
};

type Draft = { id?: string; category: EvidenceCategory; title: string; organisation: string; startMonth: string; endMonth: string; ongoing: boolean; description: string; skills: string[] };

const blank = (thisMonth: string): Draft => ({ category: "school", title: "", organisation: "", startMonth: thisMonth, endMonth: "", ongoing: true, description: "", skills: [] });

function EvidenceForm({ initial, skillOptions, thisMonth, onSaved, onCancel }: { initial: Draft; skillOptions: { employability: string[]; career: string[] }; thisMonth: string; onSaved: (e: EvidenceItem) => void; onCancel: () => void }) {
  const [d, setD] = useState(initial);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggleSkill = (s: string) => set("skills", d.skills.includes(s) ? d.skills.filter((x) => x !== s) : d.skills.length >= LIMITS.skills ? d.skills : [...d.skills, s]);
  const err = (f: string) => (error?.field === f ? error.message : null);
  const extra = d.skills.filter((s) => !skillOptions.employability.includes(s) && !skillOptions.career.includes(s));

  return (
    <form
      className="evidence-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const body = { id: d.id, category: d.category, title: d.title, organisation: d.organisation, startMonth: d.startMonth, endMonth: d.ongoing ? "" : d.endMonth, description: d.description, skills: d.skills };
        const r = await activity<{ item: EvidenceItem }>(d.id ? "evidence-update" : "evidence-add", body);
        setBusy(false);
        if (!r.ok) return setError({ message: r.error, field: r.field });
        onSaved(r.item);
      }}
    >
      <h2>{d.id ? "Edit evidence" : "Add evidence"}</h2>
      <fieldset className="field">
        <legend className="label-like">Where was this?</legend>
        <div className="chips-select">
          {EVIDENCE_CATEGORIES.map((c) => (
            <button type="button" key={c} aria-pressed={d.category === c} onClick={() => set("category", c)}>
              <Icon name={CATEGORY_STYLE[c].icon} size={16} /> {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <p className="field-hint">{CATEGORY_STYLE[d.category].hint}</p>
      </fieldset>
      <Field id="ev-title" label="What did you do?" hint='For example "Captain, under-16 netball team" or "Casual café attendant".' error={err("title")}>
        <input id="ev-title" value={d.title} maxLength={LIMITS.title} onChange={(e) => set("title", e.target.value)} required />
      </Field>
      <Field id="ev-org" label="Where or with whom (optional)" error={err("organisation")}>
        <input id="ev-org" value={d.organisation} maxLength={LIMITS.organisation} onChange={(e) => set("organisation", e.target.value)} placeholder="e.g. Northside Netball Club" />
      </Field>
      <div className="pair">
        <Field id="ev-start" label="Started" error={err("startMonth")}>
          <input id="ev-start" type="month" value={d.startMonth} max={thisMonth} onChange={(e) => set("startMonth", e.target.value)} required />
        </Field>
        <Field id="ev-end" label="Finished" error={err("endMonth")}>
          <input id="ev-end" type="month" value={d.ongoing ? "" : d.endMonth} min={d.startMonth} max={thisMonth} disabled={d.ongoing} onChange={(e) => set("endMonth", e.target.value)} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={d.ongoing} onChange={(e) => set("ongoing", e.target.checked)} /> I&apos;m still doing this
      </label>
      <Field id="ev-desc" label="What you did and what came of it" hint={`${d.description.length} / ${LIMITS.description}. Use numbers where you can ("trained 2 new staff"). Leave out phone numbers, addresses and health details.`} error={err("description")}>
        <textarea id="ev-desc" rows={4} value={d.description} maxLength={LIMITS.description} onChange={(e) => set("description", e.target.value)} required />
      </Field>
      <fieldset className="field">
        <legend className="label-like">Skills this shows (up to {LIMITS.skills})</legend>
        <div className="chips-select small-chips">
          {skillOptions.employability.map((s) => (
            <button type="button" key={s} aria-pressed={d.skills.includes(s)} onClick={() => toggleSkill(s)}>
              {s}
            </button>
          ))}
        </div>
        {skillOptions.career.length > 0 && (
          <>
            <p className="field-hint" style={{ marginTop: 6 }}>
              Skills from your career matches
            </p>
            <div className="chips-select small-chips">
              {skillOptions.career.map((s) => (
                <button type="button" key={s} aria-pressed={d.skills.includes(s)} onClick={() => toggleSkill(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {extra.length > 0 && (
          <div className="chips-select small-chips" style={{ marginTop: 6 }}>
            {extra.map((s) => (
              <button type="button" key={s} aria-pressed onClick={() => toggleSkill(s)}>
                {s} <Icon name="close" size={12} />
              </button>
            ))}
          </div>
        )}
        <div className="inline-add">
          <input aria-label="Add your own skill" placeholder="Add your own skill" value={custom} maxLength={LIMITS.skillLength} onChange={(e) => setCustom(e.target.value)} />
          <button
            type="button"
            className="button secondary small-btn"
            disabled={!custom.trim() || d.skills.length >= LIMITS.skills}
            onClick={() => {
              toggleSkill(custom.trim());
              setCustom("");
            }}
          >
            Add
          </button>
        </div>
        {err("skills") && <p className="field-error">{err("skills")}</p>}
      </fieldset>
      <FormError error={error} fields={["title", "organisation", "startMonth", "endMonth", "description", "skills"]} />
      <div className="button-row">
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : d.id ? "Save changes" : "Add to portfolio"}
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function EvidenceList({ items, onEdit, onDelete }: { items: EvidenceItem[]; onEdit?: (e: EvidenceItem) => void; onDelete?: (e: EvidenceItem) => void }) {
  return (
    <div className="evidence-groups">
      {CV_ORDER.filter((c) => items.some((i) => i.category === c)).map((c) => (
        <div key={c}>
          <h3 className="evidence-head">
            <span className={`event-icon ${CATEGORY_STYLE[c].tone}`} aria-hidden="true">
              <Icon name={CATEGORY_STYLE[c].icon} size={16} />
            </span>
            {CATEGORY_LABEL[c]}
          </h3>
          <ul className="evidence-list">
            {items
              .filter((i) => i.category === c)
              .map((i) => (
                <li key={i.id} className="evidence-item">
                  <div>
                    <strong>{i.title}</strong>
                    <span className="small">
                      {i.organisation ? `${i.organisation} · ` : ""}
                      {dateRange(i)}
                    </span>
                    <p>{i.description}</p>
                    {i.skills.length > 0 && (
                      <div className="tags">
                        {i.skills.map((s) => (
                          <span key={s} className="tag slate">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {(onEdit || onDelete) && (
                    <div className="evidence-actions">
                      {onEdit && (
                        <button className="linkish" aria-label={`Edit ${i.title}`} onClick={() => onEdit(i)}>
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button className="linkish danger" aria-label={`Delete ${i.title}`} onClick={() => onDelete(i)}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The Skills Evidence Portfolio: add, edit and remove evidence, and turn it into a CV. */
export function Portfolio({ initial, skillOptions, thisMonth }: { initial: EvidenceItem[]; skillOptions: { employability: string[]; career: string[] }; thisMonth: string }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<EvidenceItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counts = CV_ORDER.map((c) => ({ c, n: items.filter((i) => i.category === c).length }));

  return (
    <section className="card portfolio-card" aria-labelledby="portfolio" id="portfolio-section">
      <div className="group-head" style={{ marginTop: 0 }}>
        <h2 id="portfolio">
          <Icon name="clipboard" size={22} /> Skills Evidence Portfolio
        </h2>
        <div className="button-row" style={{ marginTop: 0 }}>
          <button className="button primary small-btn" onClick={() => setEditing(blank(thisMonth))}>
            <Icon name="spark" size={16} /> Add evidence
          </button>
          <Link className={`button secondary small-btn${items.length ? "" : " disabled"}`} href="/account/cv" aria-disabled={!items.length}>
            <Icon name="download" size={16} /> Make my CV
          </Link>
        </div>
      </div>
      <p className="muted">Keep a record of what you do at school, in sport, at work and volunteering, and the skills it shows. When you need a CV, Bcome turns it into one.</p>
      <div className="evidence-counts">
        {counts.map(({ c, n }) => (
          <span key={c} className={`count-chip ${CATEGORY_STYLE[c].tone}${n ? "" : " empty"}`}>
            <Icon name={CATEGORY_STYLE[c].icon} size={15} /> {CATEGORY_LABEL[c]} <strong>{n}</strong>
          </span>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      {items.length === 0 ? (
        <div className="empty-state">
          <Icon name="clipboard" size={34} />
          <p>
            <strong>Nothing here yet.</strong> Start with one thing you&apos;re proud of from this year: a role at school, a sport, a job or something you volunteer for.
          </p>
        </div>
      ) : (
        <EvidenceList
          items={items}
          onEdit={(i) => setEditing({ id: i.id, category: i.category, title: i.title, organisation: i.organisation ?? "", startMonth: i.startMonth, endMonth: i.endMonth ?? "", ongoing: !i.endMonth, description: i.description, skills: i.skills })}
          onDelete={setConfirm}
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} label="Portfolio evidence">
        {editing && (
          <div className="detail-body">
            <EvidenceForm
              key={editing.id ?? "new"}
              initial={editing}
              skillOptions={skillOptions}
              thisMonth={thisMonth}
              onCancel={() => setEditing(null)}
              onSaved={(item) => {
                setItems((xs) => [item, ...xs.filter((x) => x.id !== item.id)]);
                setEditing(null);
              }}
            />
          </div>
        )}
      </Modal>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} label="Delete evidence">
        {confirm && (
          <div className="detail-body">
            <h2>Delete &ldquo;{confirm.title}&rdquo;?</h2>
            <p className="muted">This removes it from your portfolio and CV. You can&apos;t undo this.</p>
            <div className="button-row">
              <button
                className="button danger"
                onClick={async () => {
                  const r = await activity("evidence-delete", { id: confirm.id });
                  if (!r.ok) setError(r.error);
                  else setItems((xs) => xs.filter((x) => x.id !== confirm.id));
                  setConfirm(null);
                }}
              >
                Delete
              </button>
              <button className="button secondary" onClick={() => setConfirm(null)}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/forms.tsx";
import { Icon } from "@/components/Icon.tsx";
import { cvText, type CvContact, type CvModel } from "@/lib/activity/cv.ts";
import { cvDocx } from "@/lib/activity/docx.ts";

/**
 * CV preview and download. Contact details and edits stay in this browser tab: they're used to
 * build the file here and are never sent to Bcome.
 */
export default function CvEditor({ cv: initial, fileName }: { cv: CvModel; fileName: string }) {
  const [contact, setContact] = useState<CvContact>({ email: "", phone: "", location: "" });
  const [objective, setObjective] = useState(initial.objective);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const cv = useMemo<CvModel>(
    () => ({ ...initial, objective, sections: initial.sections.filter((s) => !hidden.has(s.heading)) }),
    [initial, objective, hidden],
  );
  const set = (k: keyof CvContact, v: string) => setContact((c) => ({ ...c, [k]: v }));

  const download = () => {
    const bytes = cvDocx(cv, contact);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/[^\w -]/g, "")}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="cv-layout">
      <section className="card cv-controls" aria-labelledby="cv-details">
        <h2 id="cv-details">Your details</h2>
        <p className="small">
          <Icon name="lock" size={13} /> These stay on this device and go only into your download. Bcome doesn&apos;t save them.
        </p>
        <Field id="cv-email" label="Email for employers">
          <input id="cv-email" type="email" autoComplete="email" value={contact.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field id="cv-phone" label="Mobile">
          <input id="cv-phone" type="tel" autoComplete="tel" value={contact.phone} onChange={(e) => set("phone", e.target.value)} placeholder="04xx xxx xxx" />
        </Field>
        <Field id="cv-loc" label="Suburb and state" hint="Just the suburb, not your street address.">
          <input id="cv-loc" value={contact.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Parramatta NSW" />
        </Field>
        <Field id="cv-obj" label="Career objective" hint="A first draft from your results. Make it sound like you.">
          <textarea id="cv-obj" rows={5} value={objective} maxLength={600} onChange={(e) => setObjective(e.target.value)} />
        </Field>
        <fieldset className="field">
          <legend className="label-like">Sections to include</legend>
          {initial.sections.map((s) => (
            <label key={s.heading} className="check">
              <input
                type="checkbox"
                checked={!hidden.has(s.heading)}
                onChange={(e) => {
                  const next = new Set(hidden);
                  if (e.target.checked) next.delete(s.heading);
                  else next.add(s.heading);
                  setHidden(next);
                }}
              />
              {s.heading} ({s.items.length})
            </label>
          ))}
        </fieldset>
        <div className="button-row">
          <button className="button primary" onClick={download}>
            <Icon name="download" size={18} /> Download Word (.docx)
          </button>
          <button className="button secondary" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(cvText(cv, contact));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Icon name="copy" size={16} /> {copied ? "Copied" : "Copy as text"}
          </button>
        </div>
        <p className="small">Before you send it, ask a teacher, your careers adviser or a parent to read it through.</p>
      </section>

      <article className="cv-paper" aria-label="CV preview">
        <h1 className="cv-name">{cv.name}</h1>
        {(contact.email || contact.phone || contact.location) && <p className="cv-contact">{[contact.email, contact.phone, contact.location].filter(Boolean).join("  |  ")}</p>}
        <h2>Career objective</h2>
        <p>{cv.objective}</p>
        <h2>Education</h2>
        <p>
          <strong>{cv.education.school}</strong> · {cv.education.detail}
          {cv.education.subjects.length > 0 && (
            <>
              <br />
              <strong>Subjects:</strong> {cv.education.subjects.join(", ")}
            </>
          )}
        </p>
        {cv.skills.length > 0 && (
          <>
            <h2>Key skills</h2>
            <ul className="cv-skills">
              {cv.skills.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </>
        )}
        {cv.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.items.map((i, n) => (
              <div key={n} className="cv-item">
                <div className="cv-item-head">
                  <strong>
                    {i.title}
                    {i.organisation ? <span>, {i.organisation}</span> : null}
                  </strong>
                  <em>{i.dates}</em>
                </div>
                <p>{i.description}</p>
              </div>
            ))}
          </section>
        ))}
        <h2>Referees</h2>
        <p>{cv.referees}</p>
      </article>
    </div>
  );
}

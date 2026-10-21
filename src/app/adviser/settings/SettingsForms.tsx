"use client";

import { useState } from "react";
import { Field, FormError, Notice, useAction } from "@/components/forms.tsx";
import { Icon } from "@/components/Icon.tsx";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Never");

export function JoinCodeForm({ joinCode }: { joinCode: string }) {
  const [code, setCode] = useState(joinCode);
  const [sure, setSure] = useState(false);
  const { submit, busy, error } = useAction("/api/adviser/join-code");
  return (
    <div className="setting-row">
      <div>
        <h3>School code</h3>
        <p className="join-code inline">{code}</p>
        <p className="small">Changing it stops the old code working. Students who already have accounts aren&apos;t affected.</p>
      </div>
      {!sure ? (
        <button type="button" className="button secondary small-btn" onClick={() => setSure(true)}>
          <Icon name="refresh" size={16} /> New code
        </button>
      ) : (
        <button
          type="button"
          className="button primary small-btn"
          disabled={busy}
          onClick={() =>
            submit({}, (d) => {
              setCode(String(d.joinCode));
              setSure(false);
            })
          }
        >
          Yes, replace it
        </button>
      )}
      <FormError error={error} />
    </div>
  );
}

export function DomainsForm({ domains }: { domains: string[] }) {
  const [value, setValue] = useState(domains.join(", "));
  const [saved, setSaved] = useState(false);
  const { submit, busy, error } = useAction("/api/adviser/update-school");
  return (
    <form
      className="setting-row"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        submit({ studentDomains: value }, () => setSaved(true));
      }}
    >
      <Field id="domains" label="Student email domains" hint="Students must sign up with an address on one of these. Separate with commas." error={error?.message}>
        <input id="domains" value={value} onChange={(e) => setValue(e.target.value)} autoCapitalize="none" spellCheck={false} />
      </Field>
      <button className="button secondary small-btn" disabled={busy}>
        Save
      </button>
      {saved && <span className="small">Saved</span>}
    </form>
  );
}

export function AiToggle({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const { submit, busy, error } = useAction("/api/adviser/update-school");
  return (
    <>
      <label className="switch">
        <input type="checkbox" role="switch" checked={value} disabled={busy} onChange={(e) => submit({ allowAiPlans: e.target.checked }, () => setValue(!value))} />
        <span className="switch-track" aria-hidden="true" />
        <span>{value ? "AI-written plans are on" : "AI-written plans are off"}</span>
      </label>
      <FormError error={error} />
    </>
  );
}

export function AdviserList({
  me,
  advisers,
  invites,
}: {
  me: string;
  advisers: { id: string; name: string; email: string; lastLoginAt: string | null }[];
  invites: { id: string; email: string; expiresAt: string }[];
}) {
  const [list, setList] = useState(advisers);
  const [pending, setPending] = useState(invites);
  const remove = useAction("/api/adviser/remove-adviser");
  const revoke = useAction("/api/adviser/revoke-invite");
  return (
    <>
      <ul className="people-list">
        {list.map((a) => (
          <li key={a.id}>
            <Icon name="user" size={18} />
            <span>
              <strong>{a.name}</strong>
              {a.id === me && " (you)"}
              <span className="small block">
                {a.email} · last sign-in {fmt(a.lastLoginAt)}
              </span>
            </span>
            {a.id !== me && (
              <button type="button" className="linkish" onClick={() => remove.submit({ adviserId: a.id }, () => setList(list.filter((x) => x.id !== a.id)))}>
                Remove
              </button>
            )}
          </li>
        ))}
        {pending.map((i) => (
          <li key={i.id}>
            <Icon name="mail" size={18} />
            <span>
              <strong>{i.email}</strong>
              <span className="small block">Invited · expires {fmt(i.expiresAt)}</span>
            </span>
            <button type="button" className="linkish" onClick={() => revoke.submit({ inviteId: i.id }, () => setPending(pending.filter((x) => x.id !== i.id)))}>
              Cancel invite
            </button>
          </li>
        ))}
      </ul>
      <FormError error={remove.error ?? revoke.error} />
    </>
  );
}

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const { submit, busy, error } = useAction("/api/adviser/invite");
  return (
    <form
      className="setting-row"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(null);
        submit({ email }, () => {
          setSent(email);
          setEmail("");
        });
      }}
    >
      <Field id="invite" label="Invite another adviser" hint="They'll get a link to set up their account. It works once and lasts 7 days." error={error?.message}>
        <input id="invite" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.edu.au" required autoCapitalize="none" />
      </Field>
      <button className="button secondary small-btn" disabled={busy}>
        <Icon name="mail" size={16} /> Send invite
      </button>
      {sent && <Notice tone="success">Invitation sent to {sent}. Refresh to see it in the list.</Notice>}
    </form>
  );
}

export function SignOutButton() {
  const { submit, busy } = useAction("/api/auth/sign-out");
  return (
    <button type="button" className="button secondary" disabled={busy} onClick={() => submit({})}>
      <Icon name="logout" size={18} /> Sign out
    </button>
  );
}

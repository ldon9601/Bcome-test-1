"use client";

import { useState } from "react";
import { Field, FormError, Notice, PasswordInput, useAction } from "@/components/forms.tsx";
import { Icon } from "@/components/Icon.tsx";
import { PASSWORD_HINT } from "@/components/PasswordHint.tsx";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

export function YearLevelForm({ current }: { current: number }) {
  const [year, setYear] = useState(String(current));
  const [saved, setSaved] = useState(false);
  const { submit, busy, error } = useAction("/api/account/year-level");
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        submit({ yearLevel: Number(year) }, () => setSaved(true));
      }}
    >
      <label htmlFor="yearLevel">School year</label>
      <select id="yearLevel" value={year} onChange={(e) => setYear(e.target.value)}>
        {[10, 11, 12].map((y) => (
          <option key={y} value={y}>
            Year {y}
          </option>
        ))}
      </select>
      <button className="button secondary" disabled={busy || year === String(current)}>
        Update
      </button>
      {saved && <span className="small">Saved</span>}
      <FormError error={error} />
    </form>
  );
}

export function AccountSecurity({ devices }: { devices: { id: string; label: string; lastUsedAt: string }[] }) {
  const [list, setList] = useState(devices);
  const [pw, setPw] = useState({ current: "", password: "", confirm: "" });
  const [changed, setChanged] = useState(false);
  const change = useAction("/api/account/password");
  const forget = useAction("/api/account/forget-device");
  const everywhere = useAction("/api/account/sign-out-everywhere");
  const signOut = useAction("/api/auth/sign-out");
  const err = (k: string) => (change.error?.field === k ? change.error.message : null);
  return (
    <section className="side-card" aria-labelledby="security">
      <h2 id="security">
        <Icon name="shield" size={22} /> Sign-in and security
      </h2>
      <div className="security-grid">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setChanged(false);
            if (pw.password !== pw.confirm) return change.setError({ message: "The new passwords don't match.", field: "confirm" });
            change.submit({ current: pw.current, password: pw.password }, () => {
              setChanged(true);
              setPw({ current: "", password: "", confirm: "" });
            });
          }}
        >
          <h3>Change password</h3>
          <Field id="current" label="Current password" error={err("current")}>
            <PasswordInput id="current" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} autoComplete="current-password" />
          </Field>
          <Field id="new-password" label="New password" hint={PASSWORD_HINT} error={err("password")}>
            <PasswordInput id="new-password" value={pw.password} onChange={(v) => setPw({ ...pw, password: v })} autoComplete="new-password" />
          </Field>
          <Field id="confirm" label="Type it again" error={err("confirm")}>
            <PasswordInput id="confirm" value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} autoComplete="new-password" />
          </Field>
          <FormError error={change.error} fields={["current", "password", "confirm"]} />
          {changed && <Notice tone="success">Password changed. You&apos;ve been signed out on your other devices.</Notice>}
          <button className="button secondary" disabled={change.busy}>
            Change password
          </button>
        </form>
        <div>
          <h3>Trusted devices</h3>
          <p className="small">These devices don&apos;t need an email code when you sign in. Remove any you don&apos;t recognise.</p>
          {list.length === 0 ? (
            <p className="muted">No trusted devices.</p>
          ) : (
            <ul className="device-list">
              {list.map((d) => (
                <li key={d.id}>
                  <Icon name="device" size={20} />
                  <span>
                    <strong>{d.label}</strong>
                    <span className="small"> Last used {fmt(d.lastUsedAt)}</span>
                  </span>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => forget.submit({ deviceId: d.id }, () => setList(list.filter((x) => x.id !== d.id)))}
                    aria-label={`Remove ${d.label}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="button-row">
            <button type="button" className="button secondary" disabled={signOut.busy} onClick={() => signOut.submit({})}>
              <Icon name="logout" size={18} /> Sign out
            </button>
            <button type="button" className="button ghost" disabled={everywhere.busy} onClick={() => everywhere.submit({})}>
              Sign out everywhere
            </button>
          </div>
          <FormError error={forget.error ?? everywhere.error ?? signOut.error} />
        </div>
      </div>
    </section>
  );
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const del = useAction("/api/account/delete");
  return (
    <section className="side-card danger" aria-labelledby="delete">
      <h2 id="delete">Delete my account</h2>
      <p className="muted">This permanently deletes your account and all your saved assessments. Your careers adviser will no longer see them.</p>
      {!open ? (
        <button type="button" className="button ghost danger" onClick={() => setOpen(true)}>
          <Icon name="trash" size={18} /> Delete my account…
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            del.submit({ password });
          }}
        >
          <Field id="delete-password" label="Enter your password to confirm" error={del.error?.message}>
            <PasswordInput id="delete-password" value={password} onChange={setPassword} autoComplete="current-password" />
          </Field>
          <div className="button-row">
            <button className="button danger" disabled={del.busy}>
              Permanently delete
            </button>
            <button type="button" className="button ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

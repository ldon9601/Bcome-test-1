"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./Icon.tsx";

export function clearLocalData() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      for (const k of Object.keys(store)) if (k.startsWith("bcome:")) store.removeItem(k);
    } catch {
      /* storage blocked */
    }
  }
}

/** Posts JSON to one of the API routes and follows `next` on success. */
export function useAction(path: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const submit = async (body: Record<string, unknown>, onOk?: (data: Record<string, unknown>) => void) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || !data.ok) {
        setError({ message: String(data.error ?? "Something went wrong. Try again."), field: data.field as string | undefined });
        if (res.status === 401 && /sign in|signed out/i.test(String(data.error))) setTimeout(() => (window.location.href = "/login"), 1500);
        return null;
      }
      // Shared school computers: don't leave one student's answers or results in the browser.
      if (/sign-out|\/delete$/.test(path)) clearLocalData();
      if (onOk) onOk(data);
      else if (typeof data.next === "string") window.location.href = data.next;
      return data;
    } catch {
      setError({ message: "Couldn't reach Bcome. Check your connection and try again." });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { submit, busy, error, setError };
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ error, fields }: { error: { message: string; field?: string } | null; fields?: string[] }) {
  if (!error || (error.field && fields?.includes(error.field))) return null;
  return (
    <p className="form-error" role="alert">
      <Icon name="close" size={16} /> {error.message}
    </p>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warn"; children: ReactNode }) {
  return <p className={`notice ${tone}`}>{children}</p>;
}

/** Shows the password with a toggle, so students can check what they typed. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="password-input">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        maxLength={128}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-hint ${id}-error`}
      />
      <button type="button" className="reveal" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
        {show ? "Hide" : "Show"}
      </button>
    </span>
  );
}

export function AuthShell({ title, intro, icon, tone, children, wide }: { title: ReactNode; intro?: ReactNode; icon: string; tone: "teal" | "violet"; children: ReactNode; wide?: boolean }) {
  return (
    <main className={`auth-page${wide ? " wide" : ""}`}>
      <section className="auth-card">
        <div className={`auth-badge ${tone}`} aria-hidden="true">
          <Icon name={icon} size={26} />
        </div>
        <h1>{title}</h1>
        {intro && <p className="auth-intro">{intro}</p>}
        {children}
      </section>
    </main>
  );
}

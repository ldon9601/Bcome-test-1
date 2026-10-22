"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, FormError, Notice, PasswordInput, useAction } from "@/components/forms.tsx";
import { Icon } from "@/components/Icon.tsx";

export default function SignInForm({ role, next, notice }: { role: "student" | "adviser" | "admin"; next?: string; notice?: string | null }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const { submit, busy, error } = useAction("/api/auth/sign-in");
  const student = role === "student";
  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ identifier, password, role, remember, next });
      }}
    >
      {notice && <Notice tone="success">{notice}</Notice>}
      <Field id="identifier" label={student ? "Username or school email" : role === "admin" ? "Administrator username or email" : "Username or work email"}>
        <input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required autoCapitalize="none" spellCheck={false} maxLength={254} />
      </Field>
      <Field id="password" label="Password">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      {student ? (
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>
            <strong>Remember me</strong>
            <span className="small"> Stay signed in on this device for 30 days. Leave this off on shared school computers.</span>
          </span>
        </label>
      ) : (
        <p className="small">
          <Icon name="shield" size={14} /> For security, we email you a code every time you sign in, and sign you out after 15 minutes without activity.
        </p>
      )}
      <FormError error={error} />
      <button className="button primary block" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="auth-links">
        <Link href="/forgot-password">Forgot your password?</Link>
        {student ? <Link href="/signup">Create a student account</Link> : role === "adviser" ? <Link href="/register-school">Register your school</Link> : null}
      </p>
    </form>
  );
}

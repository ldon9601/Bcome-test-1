"use client";

import { useState } from "react";
import { Field, FormError, PasswordInput, useAction } from "@/components/forms.tsx";
import { PASSWORD_HINT } from "@/components/PasswordHint.tsx";

export default function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [f, setF] = useState({ firstName: "", lastName: "", username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, ""), password: "", confirm: "" });
  const { submit, busy, error, setError } = useAction("/api/auth/accept-invite");
  const err = (k: string) => (error?.field === k ? error.message : null);
  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.password !== f.confirm) return setError({ message: "The passwords don't match.", field: "confirm" });
        submit({ token, firstName: f.firstName, lastName: f.lastName, username: f.username, password: f.password });
      }}
    >
      <div className="pair">
        <Field id="firstName" label="First name" error={err("firstName")}>
          <input id="firstName" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} autoComplete="given-name" required />
        </Field>
        <Field id="lastName" label="Last name" error={err("lastName")}>
          <input id="lastName" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} autoComplete="family-name" required />
        </Field>
      </div>
      <Field id="username" label="Username" error={err("username")}>
        <input id="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" required autoCapitalize="none" />
      </Field>
      <Field id="password" label="Password" hint={PASSWORD_HINT} error={err("password")}>
        <PasswordInput id="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" invalid={!!err("password")} />
      </Field>
      <Field id="confirm" label="Type it again" error={err("confirm")}>
        <PasswordInput id="confirm" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" />
      </Field>
      <FormError error={error} fields={["firstName", "lastName", "username", "password", "confirm"]} />
      <button className="button primary violet block" disabled={busy}>
        {busy ? "Setting up…" : "Create adviser account"}
      </button>
    </form>
  );
}

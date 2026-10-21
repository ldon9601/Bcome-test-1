"use client";

import { useState } from "react";
import { Field, FormError, Notice, PasswordInput, useAction } from "@/components/forms.tsx";
import { PASSWORD_HINT } from "@/components/PasswordHint.tsx";

export default function ResetForm({ emailHint }: { emailHint: string }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { submit, busy, error, setError } = useAction("/api/auth/reset");
  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (password !== confirm) return setError({ message: "The passwords don't match.", field: "confirm" });
        submit({ code, password });
      }}
    >
      <Notice>If an account matches, a code was sent to {emailHint}.</Notice>
      <Field id="code" label="6-digit code" error={error?.field === "code" ? error.message : null}>
        <input id="code" className="code-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />
      </Field>
      <Field id="password" label="New password" hint={PASSWORD_HINT} error={error?.field === "password" ? error.message : null}>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={error?.field === "password"} />
      </Field>
      <Field id="confirm" label="Type it again" error={error?.field === "confirm" ? error.message : null}>
        <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>
      <FormError error={error} fields={["code", "password", "confirm"]} />
      <button className="button primary block" disabled={busy}>
        {busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}

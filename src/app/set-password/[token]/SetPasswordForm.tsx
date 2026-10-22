"use client";

import { useState } from "react";
import { Field, FormError, PasswordInput, useAction } from "@/components/forms.tsx";
import { PASSWORD_HINT } from "@/components/PasswordHint.tsx";

export default function SetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { submit, busy, error, setError } = useAction("/api/auth/set-password");
  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (password !== confirm) return setError({ message: "The passwords don't match.", field: "confirm" });
        submit({ token, password });
      }}
    >
      <Field id="password" label="New password" hint={PASSWORD_HINT} error={error?.field === "password" ? error.message : null}>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field id="confirm" label="Type it again" error={error?.field === "confirm" ? error.message : null}>
        <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>
      <FormError error={error} fields={["password", "confirm"]} />
      <button className="button primary block" disabled={busy}>
        {busy ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, Field, FormError, useAction } from "@/components/forms.tsx";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const { submit, busy, error } = useAction("/api/auth/forgot");
  return (
    <AuthShell title="Reset your password" intro="Enter your username or email. If it matches an account, we'll email you a code." icon="lock" tone="teal">
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit({ identifier });
        }}
      >
        <Field id="identifier" label="Username or email">
          <input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required autoCapitalize="none" spellCheck={false} />
        </Field>
        <FormError error={error} />
        <button className="button primary block" disabled={busy}>
          {busy ? "Sending…" : "Email me a code"}
        </button>
        <p className="auth-links">
          <Link href="/login">Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

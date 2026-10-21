"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, FormError, Notice, useAction } from "@/components/forms.tsx";

export default function VerifyForm({ purpose, role, emailHint, next }: { purpose: string; role: string; emailHint: string; next?: string }) {
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(true);
  const [sent, setSent] = useState<string | null>(null);
  const verify = useAction("/api/auth/verify");
  const resend = useAction("/api/auth/resend");
  const student = role === "student";
  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        verify.submit({ code, trustDevice: student && trust, next });
      }}
    >
      <Notice>
        Code sent to <strong>{emailHint}</strong>. It expires in 10 minutes. Check your junk folder if it hasn&apos;t arrived.
      </Notice>
      <Field id="code" label="6-digit code" error={verify.error?.field === "code" ? verify.error.message : null}>
        <input
          id="code"
          className="code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
          autoFocus
          aria-describedby="code-error"
        />
      </Field>
      {student && (
        <label className="check">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
          <span>
            <strong>Trust this device</strong>
            <span className="small"> Don&apos;t ask for a code here for 90 days. Untick on shared or school computers.</span>
          </span>
        </label>
      )}
      <FormError error={verify.error} fields={["code"]} />
      {sent && <Notice tone="success">New code sent to {sent}.</Notice>}
      <FormError error={resend.error} />
      <button className="button primary block" disabled={verify.busy || code.length !== 6}>
        {verify.busy ? "Checking…" : purpose === "verify_email" ? "Confirm email" : "Continue"}
      </button>
      <p className="auth-links">
        <button type="button" className="linkish" disabled={resend.busy} onClick={() => resend.submit({}, (d) => setSent(String(d.emailHint)))}>
          Send a new code
        </button>
        <Link href={role === "adviser" ? "/login/adviser" : "/login/student"}>Start again</Link>
      </p>
    </form>
  );
}

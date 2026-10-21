"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, FormError, PasswordInput, useAction } from "@/components/forms.tsx";
import { PASSWORD_HINT } from "@/components/PasswordHint.tsx";
import { checkPassword, emailDomain, STATES } from "@/lib/auth/validation.ts";

export default function RegisterSchoolForm() {
  const [f, setF] = useState({ schoolName: "", state: "", studentDomains: "", firstName: "", lastName: "", email: "", username: "", password: "", confirm: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const { submit, busy, error, setError } = useAction("/api/auth/register-school");
  const err = (k: string) => (error?.field === k ? error.message : null);
  return (
    <form
      className="auth-form two-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const p = checkPassword(f.password, [f.username, f.email, f.firstName, f.lastName]);
        if (p) return setError({ message: p, field: "password" });
        if (f.password !== f.confirm) return setError({ message: "The passwords don't match.", field: "confirm" });
        const { confirm: _c, ...body } = f;
        submit(body);
      }}
    >
      <fieldset>
        <legend>School</legend>
        <Field id="schoolName" label="School name" error={err("schoolName")}>
          <input id="schoolName" value={f.schoolName} onChange={set("schoolName")} required maxLength={120} autoComplete="organization" />
        </Field>
        <Field id="state" label="State or territory" error={err("state")}>
          <select id="state" value={f.state} onChange={set("state")} required>
            <option value="">Choose…</option>
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field
          id="studentDomains"
          label="Student email domain"
          hint="The part after @ in your students' school emails, e.g. education.nsw.gov.au. Separate several with commas."
          error={err("studentDomains")}
        >
          <input
            id="studentDomains"
            value={f.studentDomains}
            onChange={set("studentDomains")}
            onFocus={() => !f.studentDomains && f.email.includes("@") && setF({ ...f, studentDomains: emailDomain(f.email) })}
            required
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
      </fieldset>
      <fieldset>
        <legend>You</legend>
        <div className="pair">
          <Field id="firstName" label="First name" error={err("firstName")}>
            <input id="firstName" value={f.firstName} onChange={set("firstName")} autoComplete="given-name" required />
          </Field>
          <Field id="lastName" label="Last name" error={err("lastName")}>
            <input id="lastName" value={f.lastName} onChange={set("lastName")} autoComplete="family-name" required />
          </Field>
        </div>
        <Field id="email" label="Your school email" hint="We'll send a code here to confirm it." error={err("email")}>
          <input id="email" type="email" value={f.email} onChange={set("email")} autoComplete="email" required autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field id="username" label="Username" error={err("username")}>
          <input id="username" value={f.username} onChange={set("username")} autoComplete="username" required autoCapitalize="none" spellCheck={false} maxLength={30} />
        </Field>
      </fieldset>
      <fieldset className="span">
        <legend>Password</legend>
        <div className="pair">
          <Field id="password" label="Password" hint={PASSWORD_HINT} error={err("password")}>
            <PasswordInput id="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" invalid={!!err("password")} />
          </Field>
          <Field id="confirm" label="Type it again" error={err("confirm")}>
            <PasswordInput id="confirm" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" />
          </Field>
        </div>
      </fieldset>
      <div className="span">
        <p className="small">
          Bcome checks each new school before students can join, usually within two business days. You can invite other staff once your school is
          active. See our <Link href="/privacy">privacy notice</Link>.
        </p>
        <FormError error={error} fields={["schoolName", "state", "studentDomains", "firstName", "lastName", "email", "username", "password", "confirm"]} />
        <button className="button primary violet block" disabled={busy}>
          {busy ? "Registering…" : "Register school"}
        </button>
      </div>
    </form>
  );
}

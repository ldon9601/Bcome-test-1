"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, FormError, PasswordInput, useAction } from "@/components/forms.tsx";
import { PASSWORD_HINT } from "@/components/PasswordHint.tsx";
import { checkPassword, checkUsername } from "@/lib/auth/validation.ts";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SignupForm({ initialCode }: { initialCode: string }) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => thisYear - 13 - i);
  const [f, setF] = useState({
    joinCode: initialCode,
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    confirm: "",
    yearLevel: "",
    birthMonth: "",
    birthYear: "",
    acceptedNotice: false,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const { submit, busy, error, setError } = useAction("/api/auth/register-student");
  const err = (k: string) => (error?.field === k ? error.message : null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = checkUsername(f.username);
    if (u) return setError({ message: u, field: "username" });
    const p = checkPassword(f.password, [f.username, f.email, f.firstName, f.lastName]);
    if (p) return setError({ message: p, field: "password" });
    if (f.password !== f.confirm) return setError({ message: "The passwords don't match.", field: "confirm" });
    const { confirm: _c, ...body } = f;
    submit({ ...body, yearLevel: Number(f.yearLevel), birthMonth: Number(f.birthMonth), birthYear: Number(f.birthYear) });
  };

  return (
    <form className="auth-form two-col" onSubmit={onSubmit} noValidate>
      <fieldset>
        <legend>Your school</legend>
        <Field id="joinCode" label="School code" hint="8 letters and numbers, from your careers adviser." error={err("joinCode")}>
          <input id="joinCode" className="code-input wide" value={f.joinCode} onChange={set("joinCode")} placeholder="ABCD-1234" required autoCapitalize="characters" spellCheck={false} maxLength={12} />
        </Field>
        <Field id="email" label="School email address" hint="Your school-issued address. Personal email can't be used." error={err("email")}>
          <input id="email" type="email" value={f.email} onChange={set("email")} autoComplete="email" required autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field id="yearLevel" label="School year" error={err("yearLevel")}>
          <select id="yearLevel" value={f.yearLevel} onChange={set("yearLevel")} required>
            <option value="">Choose…</option>
            {[10, 11, 12].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>
      <fieldset>
        <legend>About you</legend>
        <div className="pair">
          <Field id="firstName" label="First name" error={err("firstName")}>
            <input id="firstName" value={f.firstName} onChange={set("firstName")} autoComplete="given-name" required maxLength={60} />
          </Field>
          <Field id="lastName" label="Last name" error={err("lastName")}>
            <input id="lastName" value={f.lastName} onChange={set("lastName")} autoComplete="family-name" required maxLength={60} />
          </Field>
        </div>
        <div className="pair">
          <Field id="birthMonth" label="Month of birth" error={err("birth")}>
            <select id="birthMonth" value={f.birthMonth} onChange={set("birthMonth")} required>
              <option value="">Month…</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field id="birthYear" label="Year of birth">
            <select id="birthYear" value={f.birthYear} onChange={set("birthYear")} required>
              <option value="">Year…</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="small">We only ask for the month and year, not your full date of birth.</p>
      </fieldset>
      <fieldset className="span">
        <legend>Sign-in details</legend>
        <div className="pair">
          <Field id="username" label="Username" hint="3–30 letters or numbers. You can also sign in with your email." error={err("username")}>
            <input id="username" value={f.username} onChange={set("username")} autoComplete="username" required autoCapitalize="none" spellCheck={false} maxLength={30} />
          </Field>
          <div />
        </div>
        <div className="pair">
          <Field id="password" label="Password" hint={PASSWORD_HINT} error={err("password")}>
            <PasswordInput id="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" invalid={!!err("password")} />
          </Field>
          <Field id="confirm" label="Type it again" error={err("confirm")}>
            <PasswordInput id="confirm" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" />
          </Field>
        </div>
      </fieldset>
      <div className="span privacy-box">
        <h2>What we keep and why</h2>
        <p>
          Bcome keeps your name, school email, username, school, school year, and month and year of birth, plus your answers and results each time you
          do the Career Profile. Your careers advisers at your school can see these to help you plan. We use them to give you career matches and to
          produce school-level statistics. We don&apos;t sell your information, show ads, or share it with other schools. Your information is stored in
          Australia. You can delete your account at any time from your profile.{" "}
          <Link href="/privacy" target="_blank">
            Read the full privacy notice
          </Link>
          .
        </p>
        <label className="check">
          <input type="checkbox" checked={f.acceptedNotice} onChange={set("acceptedNotice")} aria-describedby="acceptedNotice-error" />
          <span>I&apos;ve read this and I&apos;m happy to continue.</span>
        </label>
        {err("acceptedNotice") && (
          <p className="field-error" id="acceptedNotice-error">
            {err("acceptedNotice")}
          </p>
        )}
      </div>
      <div className="span">
        <FormError error={error} fields={["joinCode", "email", "yearLevel", "firstName", "lastName", "birth", "username", "password", "confirm", "acceptedNotice"]} />
        <button className="button primary block" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
        <p className="auth-links">
          <span>
            Already have an account? <Link href="/login/student">Sign in</Link>
          </span>
        </p>
      </div>
    </form>
  );
}

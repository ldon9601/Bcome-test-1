"use client";

import { useState } from "react";
import { Field, FormError, useAction } from "@/components/forms.tsx";
import { Icon } from "@/components/Icon.tsx";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const reload = () => window.location.reload();

function Done({ text }: { text: string | null }) {
  return text ? (
    <p className="form-ok" role="status">
      <Icon name="check" size={16} /> {text}
    </p>
  ) : null;
}

export function CreateSchoolForm() {
  const { submit, busy, error } = useAction("/api/admin/create-school");
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        setDone(null);
        submit(Object.fromEntries(f), (d) => {
          setDone(`School created and active. Student sign-up code: ${d.joinCode}`);
          form.reset();
          setTimeout(reload, 1800);
        });
      }}
    >
      <Field id="s-name" label="School name" error={error?.field === "name" ? error.message : null}>
        <input id="s-name" name="name" required autoComplete="off" />
      </Field>
      <Field id="s-state" label="State or territory" error={error?.field === "state" ? error.message : null}>
        <select id="s-state" name="state" required defaultValue="">
          <option value="" disabled>
            Choose
          </option>
          {STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field id="s-domains" label="Student email domains" hint="For example students.example.nsw.edu.au. Separate with commas." error={error?.field === "studentDomains" ? error.message : null}>
        <input id="s-domains" name="studentDomains" required autoCapitalize="none" spellCheck={false} />
      </Field>
      <button className="button primary" disabled={busy}>
        <Icon name="school" size={18} /> Create school
      </button>
      <FormError error={error} fields={["name", "state", "studentDomains"]} />
      <Done text={done} />
    </form>
  );
}

export function SchoolActions({ schoolId, status, name }: { schoolId: string; status: string; name: string }) {
  const { submit, busy, error } = useAction("/api/admin/school-action");
  const invite = useAction("/api/admin/invite-adviser");
  const [done, setDone] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const act = (action: string, msg: (d: Record<string, unknown>) => string, refresh = true) => {
    setDone(null);
    submit({ schoolId, action }, (d) => {
      setDone(msg(d));
      if (refresh) setTimeout(reload, 1500);
    });
  };
  return (
    <div className="admin-actions">
      <div className="button-row">
        {status === "pending" && (
          <button type="button" className="button primary small-btn" disabled={busy} onClick={() => act("approve", () => "Approved. The advisers have been emailed the school code.")}>
            <Icon name="check" size={16} /> Approve
          </button>
        )}
        {status === "active" ? (
          <button type="button" className="button ghost danger small-btn" disabled={busy} onClick={() => act("suspend", () => "Suspended. Nobody at the school can sign in.")}>
            <Icon name="lock" size={16} /> Suspend
          </button>
        ) : status === "suspended" ? (
          <button type="button" className="button secondary small-btn" disabled={busy} onClick={() => act("activate", () => "Reactivated.")}>
            <Icon name="refresh" size={16} /> Reactivate
          </button>
        ) : null}
        <button type="button" className="button secondary small-btn" disabled={busy} onClick={() => act("join-code", (d) => `New code: ${d.joinCode}`)}>
          <Icon name="refresh" size={16} /> New code
        </button>
        <button type="button" className="button secondary small-btn" disabled={busy} onClick={() => act("email-code", (d) => `School code emailed to ${d.sent} adviser${d.sent === 1 ? "" : "s"}.`, false)}>
          <Icon name="mail" size={16} /> Email code to advisers
        </button>
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          setDone(null);
          invite.submit({ schoolId, email }, () => {
            setDone(`Invite emailed to ${email}.`);
            setEmail("");
          });
        }}
      >
        <label htmlFor={`inv-${schoolId}`} className="sr-only">
          Adviser email for {name}
        </label>
        <input id={`inv-${schoolId}`} type="email" placeholder="Adviser's school email" value={email} onChange={(e) => setEmail(e.target.value)} required autoCapitalize="none" />
        <button className="button secondary small-btn" disabled={invite.busy}>
          <Icon name="mail" size={16} /> Invite adviser
        </button>
      </form>
      <FormError error={error ?? invite.error} />
      <Done text={done} />
    </div>
  );
}

export function CreateUserForm({ schools, thisYear }: { schools: { id: string; name: string; domains: string[] }[]; thisYear: number }) {
  const { submit, busy, error } = useAction("/api/admin/create-user");
  const [role, setRole] = useState("student");
  const [done, setDone] = useState<string | null>(null);
  const err = (f: string) => (error?.field === f ? error.message : null);
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const body = Object.fromEntries(new FormData(form));
        setDone(null);
        submit({ ...body, role }, () => {
          setDone(`Account created. ${body.email} has been emailed a link to set their password (valid for 3 days).`);
          form.reset();
          setTimeout(reload, 2200);
        });
      }}
    >
      <fieldset className="role-pick">
        <legend>Account type</legend>
        {[
          ["student", "Student"],
          ["adviser", "Careers adviser"],
        ].map(([v, l]) => (
          <label key={v}>
            <input type="radio" name="role-pick" value={v} checked={role === v} onChange={() => setRole(v)} /> {l}
          </label>
        ))}
      </fieldset>
      <Field id="u-school" label="School" error={err("schoolId")}>
        <select id="u-school" name="schoolId" required defaultValue="">
          <option value="" disabled>
            Choose a school
          </option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (@{s.domains[0]})
            </option>
          ))}
        </select>
      </Field>
      <div className="two-col">
        <Field id="u-first" label="First name" error={err("firstName")}>
          <input id="u-first" name="firstName" required autoComplete="off" />
        </Field>
        <Field id="u-last" label="Last name" error={err("lastName")}>
          <input id="u-last" name="lastName" required autoComplete="off" />
        </Field>
      </div>
      <Field id="u-email" label="School email" hint={role === "student" ? "Must use the school's student domain." : "The adviser's staff email."} error={err("email")}>
        <input id="u-email" name="email" type="email" required autoCapitalize="none" autoComplete="off" />
      </Field>
      <Field id="u-username" label="Username" hint="3 to 30 letters, numbers, dots or dashes." error={err("username")}>
        <input id="u-username" name="username" required autoCapitalize="none" autoComplete="off" spellCheck={false} />
      </Field>
      {role === "student" && (
        <div className="three-col">
          <Field id="u-year" label="Year" error={err("yearLevel")}>
            <select id="u-year" name="yearLevel" required defaultValue="">
              <option value="" disabled>
                Year
              </option>
              {[10, 11, 12].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </Field>
          <Field id="u-bm" label="Birth month" error={err("birth")}>
            <select id="u-bm" name="birthMonth" required defaultValue="">
              <option value="" disabled>
                Month
              </option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString("en-AU", { month: "short" })}
                </option>
              ))}
            </select>
          </Field>
          <Field id="u-by" label="Birth year">
            <select id="u-by" name="birthYear" required defaultValue="">
              <option value="" disabled>
                Year
              </option>
              {Array.from({ length: 8 }, (_, i) => thisYear - 13 - i).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <p className="small">Nobody sees the password. The person gets a one-time email link to choose their own, which also confirms their email.</p>
      <button className="button primary" disabled={busy}>
        <Icon name="user" size={18} /> Create account and email link
      </button>
      <FormError error={error} fields={["schoolId", "firstName", "lastName", "email", "username", "yearLevel", "birth"]} />
      <Done text={done} />
    </form>
  );
}

export function UserActions({ userId, name, locked, self }: { userId: string; name: string; locked: boolean; self: boolean }) {
  const { submit, busy, error } = useAction("/api/admin/user-action");
  const [done, setDone] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const act = (action: string, msg: string, refresh = false) => {
    setDone(null);
    submit({ userId, action }, () => {
      setDone(msg);
      setConfirm(false);
      if (refresh) setTimeout(reload, 1200);
    });
  };
  return (
    <details className="row-menu">
      <summary>
        Manage <span className="sr-only">{name}</span>
      </summary>
      <div className="row-menu-body">
        <button type="button" className="button secondary small-btn" disabled={busy} onClick={() => act("password-link", "Password link emailed.")}>
          <Icon name="mail" size={16} /> Email password link
        </button>
        {locked && (
          <button type="button" className="button secondary small-btn" disabled={busy} onClick={() => act("unlock", "Unlocked.", true)}>
            <Icon name="lock" size={16} /> Unlock
          </button>
        )}
        <button type="button" className="button secondary small-btn" disabled={busy} onClick={() => act("sign-out", "Signed out of every device.")}>
          <Icon name="logout" size={16} /> Sign out everywhere
        </button>
        {!self &&
          (confirm ? (
            <div className="confirm-box">
              <p className="small">Permanently delete {name} and all their results?</p>
              <div className="button-row">
                <button type="button" className="button danger small-btn" disabled={busy} onClick={() => act("delete", "Deleted.", true)}>
                  Delete
                </button>
                <button type="button" className="button ghost small-btn" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="button ghost danger small-btn" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={16} /> Delete
            </button>
          ))}
        <FormError error={error} />
        <Done text={done} />
      </div>
    </details>
  );
}

export function TestEmailForm({ email }: { email: string }) {
  const { submit, busy, error } = useAction("/api/admin/test-email");
  const [to, setTo] = useState(email);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(null);
        submit({ to }, () => setDone(`Test email sent to ${to}.`));
      }}
    >
      <label htmlFor="test-to" className="sr-only">
        Send a test email to
      </label>
      <input id="test-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required autoCapitalize="none" />
      <button className="button secondary small-btn" disabled={busy}>
        <Icon name="mail" size={16} /> Send test
      </button>
      <FormError error={error} />
      <Done text={done} />
    </form>
  );
}

export function PurgeButton() {
  const { submit, busy, error } = useAction("/api/admin/purge");
  const [done, setDone] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="button secondary small-btn" disabled={busy} onClick={() => submit({}, () => setDone("Expired sessions, codes and old logs removed."))}>
        <Icon name="trash" size={16} /> Run clean-up now
      </button>
      <FormError error={error} />
      <Done text={done} />
    </>
  );
}

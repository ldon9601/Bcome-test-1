"use client";

import { useState } from "react";
import { createClient, supabaseConfiguredInBrowser } from "@/lib/supabase/client.ts";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "parent">("student");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  if (!supabaseConfiguredInBrowser) {
    return (
      <main className="page">
        <h1>Sign in</h1>
        <p className="lead">Accounts aren&apos;t switched on yet. You can still answer the questions and get a plan.</p>
      </main>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { role } },
    });
    if (error) {
      setMessage(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  };

  return (
    <main className="page">
      <h1>Sign in</h1>
      {state === "sent" ? (
        <p className="lead">Check your email for a sign-in link. It works once and expires in an hour.</p>
      ) : (
        <form onSubmit={send}>
          <p className="lead">We&apos;ll email you a link. No password needed.</p>
          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <fieldset className="form-row" style={{ border: 0, padding: 0 }}>
            <legend>I am a</legend>
            <div className="choices">
              <button type="button" aria-pressed={role === "student"} onClick={() => setRole("student")}>
                Student
              </button>
              <button type="button" aria-pressed={role === "parent"} onClick={() => setRole("parent")}>
                Parent or carer
              </button>
            </div>
          </fieldset>
          {state === "error" && <p className="error">Couldn&apos;t send the link: {message}</p>}
          <button className="button" disabled={state === "sending"}>
            {state === "sending" ? "Sending link…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { FormError, useAction } from "@/components/forms.tsx";
import { Icon } from "@/components/Icon.tsx";

export function JoinCodeCard({ joinCode, domains }: { joinCode: string; domains: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is on screen */
    }
  };
  return (
    <section className="join-card" aria-labelledby="join">
      <h2 id="join">Student sign-up code</h2>
      <p className="join-code" aria-label={`School code ${joinCode.split("").join(" ")}`}>
        {joinCode}
      </p>
      <button type="button" className="button secondary small-btn" onClick={copy}>
        <Icon name="copy" size={16} /> {copied ? "Copied" : "Copy code"}
      </button>
      <p className="small">
        Students sign up at <strong>/signup</strong> with this code and an email ending in {domains.map((d) => `@${d}`).join(" or ")}.{" "}
        <Link href="/adviser/settings#code">Change the code</Link>
      </p>
    </section>
  );
}

export function RemoveStudent({ studentId, name }: { studentId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const { submit, busy, error } = useAction("/api/adviser/remove-student");
  if (!confirming) {
    return (
      <button type="button" className="button ghost danger small-btn" onClick={() => setConfirming(true)}>
        <Icon name="trash" size={16} /> Remove student
      </button>
    );
  }
  return (
    <div className="confirm-box" role="alertdialog" aria-label={`Remove ${name}`}>
      <p className="small">
        Permanently delete {name}&apos;s account and all their assessments? Use this when a student leaves the school.
      </p>
      <div className="button-row">
        <button type="button" className="button danger small-btn" disabled={busy} onClick={() => submit({ studentId }, () => (window.location.href = "/adviser"))}>
          Delete
        </button>
        <button type="button" className="button ghost small-btn" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
      <FormError error={error} />
    </div>
  );
}

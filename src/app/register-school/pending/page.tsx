import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/forms.tsx";

export const metadata: Metadata = { title: "School registration received | Bcome" };

export default function PendingPage() {
  return (
    <AuthShell title="Thanks, we've got your registration" icon="check" tone="violet">
      <p>Your email is confirmed. Bcome checks each new school before students can join, usually within two business days.</p>
      <p>
        We&apos;ll email you when your school is active, with the <strong>school code</strong> students use to sign up. After that you can sign in
        to your dashboard.
      </p>
      <p>
        <Link href="/" className="button secondary">
          Back to Bcome
        </Link>
      </p>
    </AuthShell>
  );
}

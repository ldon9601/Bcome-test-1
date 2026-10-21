import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/forms.tsx";
import { auth } from "@/lib/auth/server.ts";
import AcceptInviteForm from "./AcceptInviteForm.tsx";

export const metadata: Metadata = { title: "Join your school on Bcome", referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await (await auth()).describeInvite(token);
  if (!invite) {
    return (
      <AuthShell title="This invitation has expired" icon="mail" tone="violet">
        <p>Invitations work once and last seven days. Ask a colleague at your school to send a new one.</p>
        <Link href="/login" className="button secondary">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Join ${invite.schoolName}`} intro={`Set up your careers adviser account for ${invite.email}.`} icon="school" tone="violet">
      <AcceptInviteForm token={token} email={invite.email} />
    </AuthShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/forms.tsx";
import { auth } from "@/lib/auth/server.ts";
import SetPasswordForm from "./SetPasswordForm.tsx";

export const metadata: Metadata = { title: "Set your password | Bcome", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await (await auth()).describePasswordLink(token);
  if (!link) {
    return (
      <AuthShell title="This link has expired" intro="Set-password links work once and expire after three days." icon="lock" tone="violet">
        <p>
          Ask your careers adviser or Bcome for a new link, or <Link href="/forgot-password">reset your password</Link> yourself.
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Set your password" intro={`For the account ${link.username} (${link.emailHint}).`} icon="lock" tone="violet">
      <SetPasswordForm token={token} />
    </AuthShell>
  );
}

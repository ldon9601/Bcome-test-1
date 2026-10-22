import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/forms.tsx";
import { currentSession } from "@/lib/auth/server.ts";
import SignInForm from "../SignInForm.tsx";

export const metadata: Metadata = { title: "Administrator sign in | Bcome", robots: { index: false } };

const NOTICES: Record<string, string> = {
  reset: "Your password has been changed. Sign in with your new password.",
  idle: "You were signed out after 15 minutes without activity.",
  out: "You've been signed out.",
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const cur = await currentSession();
  if (cur?.user.role === "admin") redirect("/admin");
  const notice = Object.keys(NOTICES).find((k) => sp[k] !== undefined || sp.reason === k);
  return (
    <AuthShell title="Bcome administrator" intro="For Bcome staff who run the platform. Every sign-in is confirmed with an emailed code and logged." icon="shield" tone="violet">
      <SignInForm role="admin" next={sp.next} notice={notice ? NOTICES[notice] : null} />
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/forms.tsx";
import { currentSession } from "@/lib/auth/server.ts";
import SignInForm from "../SignInForm.tsx";

export const metadata: Metadata = { title: "Student sign in | Bcome" };

const NOTICES: Record<string, string> = {
  reset: "Your password has been changed. Sign in with your new password.",
  joined: "Your adviser account is ready. Sign in to continue.",
  idle: "You were signed out after a period of inactivity.",
  out: "You've been signed out.",
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const cur = await currentSession();
  if (cur?.user.role === "student") redirect("/account");
  const notice = Object.keys(NOTICES).find((k) => sp[k] !== undefined || sp.reason === k);
  return (
    <AuthShell title="Student sign in" intro="Use your Bcome username or your school email address." icon="grad" tone="teal">
      <SignInForm role="student" next={sp.next} notice={notice ? NOTICES[notice] : null} />
    </AuthShell>
  );
}

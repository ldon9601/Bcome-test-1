import type { Metadata } from "next";
import { AuthShell } from "@/components/forms.tsx";
import VerifyForm from "./VerifyForm.tsx";

export const metadata: Metadata = { title: "Check your email | Bcome" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const purpose = sp.p === "verify_email" ? "verify_email" : "login";
  const role = sp.role === "adviser" ? "adviser" : sp.role === "admin" ? "admin" : "student";
  const title = purpose === "verify_email" ? "Confirm your email" : role !== "student" ? "Confirm it's you" : "New device check";
  const intro =
    purpose === "verify_email"
      ? "We've sent a 6-digit code to your school email to make sure it's yours."
      : role === "admin"
        ? "Administrator accounts can see every school, so we check every sign-in with a code."
        : role === "adviser"
        ? "Because advisers can see student information, we check every sign-in with a code."
        : "You're signing in on a device we don't recognise, so we've emailed you a code.";
  return (
    <AuthShell title={title} intro={intro} icon="mail" tone={role !== "student" ? "violet" : "teal"}>
      <VerifyForm purpose={purpose} role={role} emailHint={sp.to ?? "your email"} next={sp.next} />
    </AuthShell>
  );
}

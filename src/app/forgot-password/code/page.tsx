import type { Metadata } from "next";
import { AuthShell } from "@/components/forms.tsx";
import ResetForm from "./ResetForm.tsx";

export const metadata: Metadata = { title: "Choose a new password | Bcome" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthShell title="Choose a new password" intro="Enter the code we emailed you and a new password. You'll be signed out on other devices." icon="lock" tone="teal">
      <ResetForm emailHint={sp.to ?? "your email address"} />
    </AuthShell>
  );
}

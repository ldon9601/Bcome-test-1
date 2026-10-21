import type { Metadata } from "next";
import { AuthShell } from "@/components/forms.tsx";
import SignupForm from "./SignupForm.tsx";

export const metadata: Metadata = { title: "Create a student account | Bcome" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <AuthShell
      wide
      title={
        <>
          Create your <span className="grad-text">student account</span>
        </>
      }
      intro="Save your Career Profile and come back to it any time. You'll need your school email and the school code from your careers adviser."
      icon="grad"
      tone="teal"
    >
      <SignupForm initialCode={code ?? ""} />
    </AuthShell>
  );
}

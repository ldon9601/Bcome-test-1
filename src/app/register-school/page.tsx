import type { Metadata } from "next";
import { AuthShell } from "@/components/forms.tsx";
import RegisterSchoolForm from "./RegisterSchoolForm.tsx";

export const metadata: Metadata = { title: "Register your school | Bcome" };

export default function RegisterSchoolPage() {
  return (
    <AuthShell
      wide
      title={
        <>
          Register your <span className="grad-text">school</span>
        </>
      }
      intro="For careers advisers and school staff. Once your school is confirmed, you'll get a school code to share with students so they can create accounts."
      icon="school"
      tone="violet"
    >
      <RegisterSchoolForm />
    </AuthShell>
  );
}

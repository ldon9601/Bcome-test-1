import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon.tsx";
import { buildCv } from "@/lib/activity/cv.ts";
import { ActivityService } from "@/lib/activity/service.ts";
import { auth, requireStudent } from "@/lib/auth/server.ts";
import CvEditor from "./CvEditor.tsx";

export const metadata: Metadata = { title: "My CV | Bcome" };
export const dynamic = "force-dynamic";

export default async function CvPage() {
  const cur = await requireStudent("/account/cv");
  const service = await auth();
  const activity = new ActivityService(service.store, service.now);
  const [student, evidence] = await Promise.all([activity.student(cur), service.store.listEvidence(cur.user.id)]);
  const cv = buildCv({
    firstName: cur.user.firstName,
    lastName: cur.user.lastName,
    yearLevel: cur.user.yearLevel ?? 10,
    school: cur.school.name,
    subjects: student.subjects,
    careers: student.careers.slice(0, 2).map((c) => c.title),
    evidence,
  });
  return (
    <main className="page wide">
      <p className="crumbs">
        <Link href="/">
          <Icon name="arrowLeft" size={16} /> Back to Discover
        </Link>
      </p>
      <h1>
        My <span className="grad-text">CV</span>
      </h1>
      <p className="hero-sub">Built from your Skills Evidence Portfolio. Add your contact details, tweak the wording, then download it as a Word document or save it as a PDF.</p>
      {evidence.length === 0 ? (
        <p className="notice warn">
          Your portfolio is empty, so there&apos;s nothing to put in a CV yet. <Link href="/#portfolio-section">Add some evidence</Link> first.
        </p>
      ) : (
        <CvEditor cv={cv} fileName={`${cur.user.firstName} ${cur.user.lastName} CV`} />
      )}
    </main>
  );
}

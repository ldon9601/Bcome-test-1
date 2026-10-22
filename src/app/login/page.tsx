import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon.tsx";

export const metadata: Metadata = { title: "Sign in | Bcome" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <main className="page-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)", maxWidth: "64rem" }}>
      <section className="hero">
        <div>
          <h1>
            Welcome to <span className="grad-text">Bcome</span>
          </h1>
          <p className="hero-sub">Choose how you&apos;d like to sign in.</p>
        </div>
      </section>
      <div className="tile-grid">
        <section className="role-tile student" aria-labelledby="t-student">
          <span className="tile-icon" aria-hidden="true">
            <Icon name="grad" size={34} />
          </span>
          <h2 id="t-student">I&apos;m a student</h2>
          <p>Sign in with your username or school email to save your results and see every assessment you&apos;ve done.</p>
          <div className="tile-actions">
            <Link href={`/login/student${q}`} className="button primary">
              Student sign in <Icon name="arrowRight" size={18} />
            </Link>
            <Link href="/signup" className="button secondary">
              Create a student account
            </Link>
          </div>
          <p className="small">You&apos;ll need the school code from your careers adviser.</p>
        </section>
        <section className="role-tile adviser" aria-labelledby="t-adviser">
          <span className="tile-icon" aria-hidden="true">
            <Icon name="school" size={34} />
          </span>
          <h2 id="t-adviser">Careers adviser or school staff</h2>
          <p>See which students have finished, the careers they&apos;re matched with, their interests and who may need a conversation.</p>
          <div className="tile-actions">
            <Link href={`/login/adviser${q}`} className="button primary violet">
              Adviser sign in <Icon name="arrowRight" size={18} />
            </Link>
            <Link href="/register-school" className="button secondary">
              Register your school
            </Link>
          </div>
          <p className="small">Schools register first, then students can join with the school code.</p>
        </section>
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        Just exploring? You can <Link href="/">answer the questions</Link> without an account, but your results won&apos;t be saved.
      </p>
      <p className="small" style={{ textAlign: "center" }}>
        <Link href="/login/admin">Bcome administrator sign in</Link>
      </p>
    </main>
  );
}

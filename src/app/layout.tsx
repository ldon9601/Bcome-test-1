import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600", "700"] });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], variable: "--font-body", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Bcome: your career plan",
  description: "Answer questions about what you enjoy and get a career plan for school, study and your first jobs, built on Australian job projections.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            B<span>come</span>
          </Link>
          <nav>
            <Link href="/questionnaire">Start</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

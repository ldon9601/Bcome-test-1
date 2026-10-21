import type { Metadata } from "next";
import { Caveat, Plus_Jakarta_Sans } from "next/font/google";
import { Header } from "@/components/Header.tsx";
import { HarbourScene } from "@/components/OccupationArt.tsx";
import { careerCatalogue, courseCatalogue, searchIndex } from "@/lib/careers/catalogue.ts";
import { currentSession } from "@/lib/auth/server.ts";
import { jsaOutlook, occupationData, qualificationData } from "@/lib/data.ts";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600", "700", "800"] });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Bcome: discover your future",
  description:
    "Answer questions about what you enjoy and get personalised career matches, study pathways and a year-by-year plan, built on Australian job projections.",
};

const index = searchIndex(careerCatalogue(occupationData.occupations, jsaOutlook), courseCatalogue(qualificationData, occupationData.occupations));

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cur = await currentSession();
  const user = cur ? { firstName: cur.user.firstName, lastName: cur.user.lastName, role: cur.user.role, yearLevel: cur.user.yearLevel } : null;
  return (
    <html lang="en-AU" className={`${sans.variable} ${hand.variable}`}>
      <body>
        <div className="shell">
          <aside className="rail" aria-hidden="true">
            <p className="hand note-top">
              Real people.
              <br />
              Real pathways.
            </p>
            <HarbourScene className="rail-art" />
            <p className="hand note-bottom">
              Big questions,
              <br />
              brighter futures.
            </p>
          </aside>
          <div className="frame">
            <Header searchIndex={index} user={user} />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

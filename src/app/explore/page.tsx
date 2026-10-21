import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon.tsx";
import { courseCatalogue } from "@/lib/careers/catalogue.ts";
import { formatYears } from "@/lib/careers/facts.ts";
import { occupationData, qualificationData } from "@/lib/data.ts";

export const metadata: Metadata = { title: "Explore Uni & TAFE | Bcome" };

const SECTORS = [
  { id: "higher-ed", title: "University", intro: "Bachelor degrees and above (AQF 7+).", icon: "grad", tone: "tone-purple" },
  { id: "vet", title: "TAFE and VET", intro: "Certificates, diplomas and apprenticeships, often with paid work built in.", icon: "tools", tone: "tone-amber" },
] as const;

export default function ExplorePage() {
  const courses = courseCatalogue(qualificationData, occupationData.occupations);
  return (
    <main className="page-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)", maxWidth: "64rem" }}>
      <section className="hero">
        <div>
          <h1>
            Explore <span className="grad-text">Uni &amp; TAFE</span>
          </h1>
          <p className="hero-sub">Qualifications that lead to the careers in Bcome, and where each one can take you.</p>
        </div>
      </section>
      {SECTORS.map((s) => {
        const list = courses.filter((c) => c.sector === s.id);
        if (!list.length) return null;
        return (
          <section key={s.id} aria-labelledby={`sec-${s.id}`}>
            <div className="group-head">
              <h2 id={`sec-${s.id}`}>{s.title}</h2>
              <p>{s.intro}</p>
            </div>
            <div className="course-list" style={{ marginTop: "0.75rem" }}>
              {list.map((c) => (
                <article key={c.id} id={c.id} className="course">
                  <span className={`course-icon ${s.tone}`}>
                    <Icon name={s.icon} size={24} />
                  </span>
                  <div>
                    <h3>{c.title}</h3>
                    <p className="small" style={{ margin: 0 }}>
                      AQF level {c.aqfLevel} · {formatYears(c.durationYears)} full time
                      {c.tgaCode && <> · {c.tgaCode}</>}
                    </p>
                    <div className="leads" aria-label="Leads to">
                      {c.leadsTo.map((o) => (
                        <Link key={o.osca} href={`/careers?career=${o.osca}`}>
                          {o.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      <p className="small-print">Durations are typical full-time figures. Always check entry requirements, ATARs and prerequisites with the provider.</p>
    </main>
  );
}

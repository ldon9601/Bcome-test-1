"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TafeCourse, UniversityCourse } from "@/components/Courses.tsx";
import { Icon } from "@/components/Icon.tsx";
import type { CatalogueCourse } from "@/lib/careers/catalogue.ts";
import { unmet } from "@/lib/careers/courses.ts";
import { formatYears } from "@/lib/careers/facts.ts";
import type { CourseSource } from "@/lib/careers/types.ts";

type Sector = "higher-ed" | "vet";
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

interface MyResult {
  state: string;
  subjects: string[];
  /** Qualification id → the matched careers it leads to. */
  quals: Map<string, string[]>;
}

/** Reads the student's latest results from this browser, if they have any, to highlight their courses. */
function readMyResult(): MyResult | null {
  try {
    const raw = sessionStorage.getItem("bcome:result");
    if (!raw) return null;
    const r = JSON.parse(raw) as {
      profile?: { state: string; currentSubjects: string[] };
      matches?: { title: string; courses?: { university: { qualificationId: string }[]; tafe: { qualificationId: string }[] } }[];
      plan?: { careers: { title: string; facts?: { pathways: { qualification?: { id: string } }[] } }[] };
    };
    const quals = new Map<string, string[]>();
    const add = (q: string, t: string) => quals.set(q, [...new Set([...(quals.get(q) ?? []), t])]);
    for (const c of r.plan?.careers ?? []) for (const p of c.facts?.pathways ?? []) if (p.qualification) add(p.qualification.id, c.title);
    for (const m of r.matches ?? []) for (const o of [...(m.courses?.university ?? []), ...(m.courses?.tafe ?? [])]) add(o.qualificationId, m.title);
    return r.profile ? { state: r.profile.state, subjects: r.profile.currentSubjects, quals } : null;
  } catch {
    return null;
  }
}

export default function ExploreView({ courses, sources, retrieved }: { courses: CatalogueCourse[]; sources: Record<string, CourseSource>; retrieved: string }) {
  const [sector, setSector] = useState<Sector>("higher-ed");
  const [state, setState] = useState("all");
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [me, setMe] = useState<MyResult | null>(null);

  useEffect(() => {
    const r = readMyResult();
    setMe(r);
    if (r) {
      setState(r.state);
      setMineOnly(r.quals.size > 0);
    }
    // Open the right tab when arriving from a link like /explore#UEE30820.
    const id = decodeURIComponent(window.location.hash.slice(1));
    const hit = courses.find((c) => c.id === id);
    if (hit) {
      setSector(hit.sector);
      setMineOnly(false);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
    }
  }, [courses]);

  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      courses.filter((c) => {
        if (c.sector !== sector) return false;
        if (mineOnly && me && !me.quals.has(c.id)) return false;
        if (!q) return true;
        const text = [c.title, c.tgaCode, ...c.leadsTo.map((o) => o.title), ...c.university.map((u) => `${u.provider} ${u.course}`), ...c.tafe.map((t) => t.provider)].join(" ").toLowerCase();
        return text.includes(q);
      }),
    [courses, sector, mineOnly, me, q],
  );
  const inState = <T extends { state: string }>(xs: T[]) => (state === "all" ? xs : xs.filter((x) => x.state === state));

  return (
    <main className="page-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)", maxWidth: "70rem" }}>
      <section className="hero">
        <div>
          <h1>
            Explore <span className="grad-text">Uni &amp; TAFE</span>
          </h1>
          <p className="hero-sub">Specific courses that lead to the careers in Bcome, with ATARs, prerequisites and TAFE entry requirements.</p>
        </div>
      </section>

      <div className="explore-tools">
        <div className="seg" role="tablist" aria-label="Type of study">
          <button role="tab" aria-selected={sector === "higher-ed"} onClick={() => setSector("higher-ed")}>
            <Icon name="grad" size={18} /> University
          </button>
          <button role="tab" aria-selected={sector === "vet"} onClick={() => setSector("vet")}>
            <Icon name="tools" size={18} /> TAFE and VET
          </button>
        </div>
        <label className="inline-select">
          State{" "}
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="all">All states</option>
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span className="search" style={{ margin: 0, flex: "1 1 16rem" }}>
          <Icon name="search" size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses, universities or careers" aria-label="Search courses" />
        </span>
        {me && me.quals.size > 0 && (
          <label className="check">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            <span>Only courses for my career matches</span>
          </label>
        )}
      </div>
      {!me && (
        <p className="notice">
          <Link href="/">Answer the Discover questions</Link> and this page will show the courses for your career matches, checked against the subjects you&apos;re taking.
        </p>
      )}
      <p className="muted" aria-live="polite" style={{ margin: 0 }}>
        {list.length} qualification{list.length === 1 ? "" : "s"}
        {state !== "all" && ` · showing ${state} courses first where we have them`}
      </p>

      <div className="course-list">
        {list.map((c) => {
          const uni = inState(c.university);
          const others = state === "all" ? [] : c.university.filter((u) => u.state !== state);
          const tafe = c.tafe;
          const mine = me?.quals.get(c.id);
          return (
            <article key={c.id} id={c.id} className={`course${mine ? " mine" : ""}`}>
              <span className={`course-icon ${c.sector === "vet" ? "tone-amber" : "tone-purple"}`}>
                <Icon name={c.sector === "vet" ? "tools" : "grad"} size={24} />
              </span>
              <div style={{ minWidth: 0 }}>
                <h3>{c.title}</h3>
                <p className="small" style={{ margin: 0 }}>
                  AQF level {c.aqfLevel} · {formatYears(c.durationYears)} full time
                  {c.tgaCode && <> · {c.tgaCode}</>}
                </p>
                {mine && (
                  <p className="mine-note">
                    <Icon name="star" size={14} /> For your match{mine.length > 1 ? "es" : ""}: {mine.join(", ")}
                  </p>
                )}
                <div className="leads" aria-label="Leads to">
                  {c.leadsTo.map((o) => (
                    <Link key={o.osca} href={`/careers?career=${o.osca}`}>
                      {o.title}
                    </Link>
                  ))}
                </div>
                {c.sector === "higher-ed" ? (
                  uni.length || others.length ? (
                    <ul className="course-list-compact">
                      {[...uni, ...others].map((u) => (
                        <UniversityCourse
                          key={`${u.provider}${u.course}${u.campus ?? ""}`}
                          o={u}
                          missing={me ? unmet(u.prerequisites, me.subjects) : []}
                          gaps={me ? unmet(u.assumedKnowledge, me.subjects) : []}
                          sourceUrl={sources[u.source]?.url}
                          highlight={state !== "all" && u.state === state}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No university courses listed yet.</p>
                  )
                ) : tafe.length ? (
                  <ul className="course-list-compact">
                    {tafe.map((t) => (
                      <TafeCourse key={`${t.provider}${t.qualificationId}`} o={t} />
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No TAFE course details yet.</p>
                )}
                {c.sector === "higher-ed" && state !== "all" && !uni.length && others.length > 0 && (
                  <p className="small">We don&apos;t have {state} universities for this qualification yet; these are from other states.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="side-card small-print" aria-labelledby="about-atars">
        <h2 id="about-atars" style={{ fontSize: "1.05rem" }}>
          About these figures
        </h2>
        <ul>
          <li>
            <strong>Guaranteed ATAR:</strong> get this (including adjustment factors) and meet the prerequisites, and you&apos;re guaranteed an offer.{" "}
            <strong>Indicative selection rank:</strong> roughly what was needed last year. <strong>Minimum ATAR:</strong> the lowest rank considered; it
            doesn&apos;t guarantee a place. RC means a range of criteria, such as an interview, audition or personal statement.
          </li>
          <li>Prerequisite subjects are named the way each state does: HSC (NSW), VCE (VIC), QCE (QLD) and WACE (WA).</li>
          <li>TAFE entry requirements are from TAFE NSW. TAFEs in other states set their own, often similar, requirements.</li>
          <li>
            Collected {new Date(retrieved).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })} from:{" "}
            {Object.values(sources).map((s, i) => (
              <span key={s.url}>
                {i > 0 && "; "}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.provider}
                </a>
              </span>
            ))}
            . Always check the course page and your state&apos;s admissions centre (UAC, VTAC, QTAC, TISC, SATAC) before you apply.
          </li>
        </ul>
      </section>
    </main>
  );
}

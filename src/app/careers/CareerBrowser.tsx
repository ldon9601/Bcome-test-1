"use client";

import { FAMILY_LABELS } from "@/lib/careers/families.ts";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { JsaProfileCard } from "@/components/Courses.tsx";
import { InfoTip, LabourPanel, SkillLevelDefinitions } from "@/components/Labour.tsx";
import { SKILL_LEVELS } from "@/lib/labour-terms.ts";
import { Icon } from "@/components/Icon.tsx";
import { Modal } from "@/components/Modal.tsx";
import { OccupationImage } from "@/components/OccupationArt.tsx";
import { Tags } from "@/components/Tags.tsx";
import type { CatalogueCareer } from "@/lib/careers/catalogue.ts";
import { formatRange, formatYears, ROUTE_LABEL } from "@/lib/careers/facts.ts";
import { readShortlist, toggleShortlist } from "@/lib/progress/gamification.ts";
import { RIASEC_NAMES, type RiasecType } from "@/lib/questionnaire/types.ts";

const FAMILY_LABEL = FAMILY_LABELS;

export default function CareerBrowser({ careers }: { careers: CatalogueCareer[] }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [limit, setLimit] = useState(36);
  const [open, setOpen] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);

  const [myState, setMyState] = useState<string | null>(null);
  useEffect(() => setLimit(36), [family, level, query]);
  useEffect(() => {
    try {
      const r = JSON.parse(sessionStorage.getItem("bcome:result") ?? "null");
      if (typeof r?.profile?.state === "string") setMyState(r.profile.state);
    } catch {
      // No saved result in this browser.
    }
    setShortlist(readShortlist());
    const sync = () => setOpen(new URLSearchParams(window.location.search).get("career"));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const families = useMemo(() => [...new Set(careers.map((c) => c.family))].sort((a, b) => FAMILY_LABEL[a].localeCompare(FAMILY_LABEL[b])), [careers]);
  const q = query.trim().toLowerCase();
  const shown = careers.filter(
    (c) =>
      (!family || c.family === family) &&
      (!level || c.skillLevels.includes(level)) &&
      (!q || `${c.title} ${c.summary} ${c.osca} ${c.anzsco.unitGroup} ${c.anzsco.title} ${c.anzsic?.code ?? ""} ${c.anzsic?.title ?? ""}`.toLowerCase().includes(q)),
  );
  const current = careers.find((c) => c.osca === open);

  const show = (osca: string | null) => {
    setOpen(osca);
    const url = osca ? `?career=${osca}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  };

  return (
    <main className="page-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <section className="hero">
        <div>
          <h1>
            Explore <span className="grad-text">Careers</span>
          </h1>
          <p className="hero-sub">
            {careers.length} Australian careers covering every occupation group in Jobs and Skills Australia&apos;s projections, with pay, skill levels, vacancies and the ways in.
          </p>
        </div>
      </section>
      <div className="search" style={{ marginLeft: 0, maxWidth: 480, flex: "none" }}>
        <Icon name="search" size={18} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter careers" aria-label="Filter careers" />
      </div>
      <div className="filters" role="group" aria-label="Career areas">
        <button aria-pressed={!family} onClick={() => setFamily(null)}>
          All
        </button>
        {families.map((f) => (
          <button key={f} aria-pressed={family === f} onClick={() => setFamily(family === f ? null : f)}>
            {FAMILY_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="filters" role="group" aria-label="Skill level">
        <span className="small" style={{ alignSelf: "center" }}>
          Skill level
        </span>
        <button aria-pressed={!level} onClick={() => setLevel(null)}>
          Any
        </button>
        {[1, 2, 3, 4, 5].map((l) => (
          <button key={l} aria-pressed={level === l} onClick={() => setLevel(level === l ? null : l)} title={SKILL_LEVELS[l].short}>
            {l}
          </button>
        ))}
        <InfoTip label="a skill level">
          <SkillLevelDefinitions current={level ? [level] : []} />
        </InfoTip>
      </div>
      <p className="muted" aria-live="polite" style={{ margin: 0 }}>
        Showing {Math.min(limit, shown.length)} of {shown.length} career{shown.length === 1 ? "" : "s"}
      </p>
      <div className="match-grid">
        {shown.slice(0, limit).map((c) => (
          <article key={c.osca} className="match-card">
            <div className="match-art">
              <OccupationImage family={c.family} title={c.title} photo={c.photo} />
            </div>
            <h3>{c.title}</h3>
            <p>{c.summary}</p>
            <Tags tags={c.tags} limit={3} />
            <p className="small" style={{ margin: 0 }}>
              Skill level {c.skillLevels.length > 1 ? `${Math.min(...c.skillLevels)}–${Math.max(...c.skillLevels)}` : c.skillLevel} · {formatRange(c.salary.entry)} starting ·{" "}
              {formatYears(c.timeToQualify.years)} to qualify
              {c.courses.atarRange && ` · ATAR ${c.courses.atarRange[0]}–${c.courses.atarRange[1]}`}
            </p>
            <div className="actions">
              <button className="button outline" onClick={() => show(c.osca)}>
                View Career <Icon name="arrowRight" size={16} />
              </button>
              <button
                className="save"
                aria-pressed={shortlist.includes(c.osca)}
                aria-label={shortlist.includes(c.osca) ? `Remove ${c.title} from shortlist` : `Save ${c.title} to shortlist`}
                onClick={() => setShortlist(toggleShortlist(c.osca))}
              >
                <Icon name="bookmark" size={20} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {shown.length > limit && (
        <button className="button secondary" style={{ justifySelf: "center" }} onClick={() => setLimit((n) => n + 36)}>
          Show more careers ({shown.length - limit} more)
        </button>
      )}

      <Modal open={!!current} onClose={() => show(null)} label={current?.title ?? "Career"}>
        {current && (
          <>
            <div className="detail-art">
              <OccupationImage family={current.family} title={current.title} photo={current.photo} />
            </div>
            <div className="detail-body">
              <h2 style={{ fontSize: "1.6rem" }}>{current.title}</h2>
              <p className="muted">{current.summary}</p>
              <Tags tags={current.tags} />
              <div className="detail-grid">
                <div>
                  <h4>Pay and time</h4>
                  <dl className="kv">
                    <dt>Starting</dt>
                    <dd>{formatRange(current.salary.entry)}</dd>
                    <dt>Experienced</dt>
                    <dd>{formatRange(current.salary.experienced)}</dd>
                    <dt>To qualify</dt>
                    <dd>{formatYears(current.timeToQualify.years)} after Year 12</dd>
                  </dl>
                </div>
                <div>
                  <h4>Interest types</h4>
                  <p style={{ margin: 0 }}>{(current.riasec.split("") as RiasecType[]).map((t) => RIASEC_NAMES[t]).join(", ")}</p>
                  <h4 style={{ marginTop: "0.8rem" }}>Job outlook</h4>
                  <p style={{ margin: 0 }}>{current.outlook.summary}</p>
                </div>
              </div>
              <h4>Ways in</h4>
              <ul>
                {current.pathways.map((p) => (
                  <li key={`${p.route}-${p.description}`}>
                    <strong>{ROUTE_LABEL[p.route]}</strong> ({formatYears(p.years)}): {p.description}
                    {p.qualification && (
                      <>
                        {" "}
                        · <Link href={`/explore#${p.qualification}`}>courses and entry requirements</Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {(current.courses.universities > 0 || current.courses.tafe) && (
                <p className="small">
                  {current.courses.universities > 0 && (
                    <>
                      Listed at {current.courses.universities} {current.courses.universities === 1 ? "university" : "universities"}
                      {current.courses.atarRange &&
                        ` (ATARs from ${current.courses.atarRange[0]} to ${current.courses.atarRange[1]})`}
                    </>
                  )}
                  {current.courses.universities > 0 && current.courses.tafe && " · "}
                  {current.courses.tafe && "TAFE entry requirements listed"}
                </p>
              )}
              {current.identified && (
                <p className="notice">This is an identified position: these roles are for Aboriginal and Torres Strait Islander people. Bcome doesn&apos;t recommend it automatically.</p>
              )}
              {current.anzsco.profile && (
                <>
                  <h4 style={{ marginTop: "1rem" }}>The job in numbers</h4>
                  <JsaProfileCard unitGroup={current.anzsco.unitGroup} title={current.anzsco.title} occupation={current.anzsco.occupation} profile={current.anzsco.profile} />
                </>
              )}
              <LabourPanel key={current.osca} osca={current.osca} state={myState} />
              <p className="source">
                {current.oscaPending ? `ANZSCO ${current.anzsco.unitGroup}; OSCA code to be confirmed. Added from the JSA 2025 projections, with a profile Bcome estimated from similar jobs.` : `OSCA ${current.osca}.`} Take the Discover
                questions to see how well this career fits you.
              </p>
            </div>
          </>
        )}
      </Modal>
    </main>
  );
}

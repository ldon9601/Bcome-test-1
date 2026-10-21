"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { JourneyTimeline } from "@/components/JourneyTimeline.tsx";
import { Meter, RiasecBars, RiasecRadar, ScoreRing } from "@/components/Charts.tsx";
import { Icon } from "@/components/Icon.tsx";
import { Modal } from "@/components/Modal.tsx";
import { OccupationImage } from "@/components/OccupationArt.tsx";
import { StatsCard } from "@/components/StatsCard.tsx";
import { Tags } from "@/components/Tags.tsx";
import { formatRange, formatYears, ROUTE_LABEL } from "@/lib/careers/facts.ts";
import type { MatchSummary } from "@/lib/careers/matching.ts";
import type { CareerPlan, PlanCareer } from "@/lib/plan/types.ts";
import { readActivity, readShortlist, recordVisit, streakFrom, toggleShortlist, xpFor } from "@/lib/progress/gamification.ts";
import { RIASEC, type RiasecType } from "@/lib/questionnaire/types.ts";

interface Scored {
  id: string;
  label: string;
  score: number;
}
interface DnaView {
  dimensions: Scored[];
  interests: Scored[];
  strongestSignals: Scored[];
  values: Scored[];
}
export interface Result {
  dna: DnaView;
  matches: MatchSummary[];
  plan: CareerPlan;
  saved: boolean;
}

const SEEN_DNA_KEY = "bcome:seen-dna";
const QUESTIONS_ANSWERED = 40;

/** Lower-cases ordinary words but keeps acronyms such as CAD and AI. */
const inSentence = (t: string) => t.replace(/\b([A-Z])([a-z]+)\b/g, (_w, a: string, b: string) => a.toLowerCase() + b);
const pct = (v: number | undefined) => Math.round((v ?? 0) * 100);

const BAND_TEXT: Record<string, string> = {
  strong: "Strong",
  good: "Good",
  moderate: "Moderate",
  limited: "Limited",
  declining: "Shrinking",
  unknown: "Not yet known",
};
const DNA_COLOURS = ["#6c5ce7", "#3b82f6", "#14b8a6", "#22c55e", "#f59e0b", "#f43f5e", "#a855f7"];

function Bars({ items, colours }: { items: Scored[]; colours?: string[] }) {
  return (
    <ul className="mini-bars">
      {items.map((d, i) => (
        <li key={d.id}>
          <span>{d.label}</span>
          <span className="muted">{d.score}</span>
          <span className="bar" aria-hidden="true">
            <span style={{ width: `${d.score}%`, background: colours?.[i % colours.length] ?? "var(--violet)" }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function CareerDnaReveal({ dna, summary, onNext, adviser }: { dna: DnaView; summary: string; onNext?: () => void; adviser?: boolean }) {
  return (
    <section className="dna-card" aria-labelledby="dna">
      <h2 id="dna" style={{ fontSize: "1.6rem" }}>
        <span className="grad-text">{adviser ? "Career DNA" : "Your Career DNA"}</span>
      </h2>
      <p className="muted">{adviser ? "Built from their 36 answers. These are answers on the day, not fixed traits." : "Built from your 36 answers. These are your answers today, not fixed traits."}</p>
      <div className="dna-dims">
        {dna.dimensions.map((d, i) => (
          <div key={d.id} className="dna-dim">
            <strong>{d.label}</strong>
            <span className="muted">{d.score}</span>
            <span className="bar" aria-hidden="true">
              <span style={{ width: `${d.score}%`, background: DNA_COLOURS[i % DNA_COLOURS.length] }} />
            </span>
          </div>
        ))}
      </div>
      <div className="dna-suggests">
        <h2>What this suggests</h2>
        <p style={{ margin: 0 }}>{summary}</p>
      </div>
      <div className="dna-cols">
        <div>
          <h3>{adviser ? "Strongest signals" : "Your strongest signals"}</h3>
          <Bars items={dna.strongestSignals} colours={["#14b8a6"]} />
        </div>
        <div>
          <h3>{adviser ? "What they value most" : "What you value most"}</h3>
          <Bars items={dna.values.slice(0, 5)} colours={["#f43f5e"]} />
          <p className="small">{adviser ? "Compared with their other values." : "Compared with your other values."}</p>
        </div>
      </div>
      {onNext && (
        <p style={{ marginTop: "1.5rem", marginBottom: 0 }}>
          <button className="button primary" onClick={onNext}>
            See my career matches <Icon name="arrowRight" size={18} />
          </button>
        </p>
      )}
    </section>
  );
}

function SaveButton({ osca, saved, onToggle, title }: { osca: string; saved: boolean; onToggle?: (osca: string) => void; title: string }) {
  if (!onToggle) return null;
  return (
    <button className="save" aria-pressed={saved} onClick={() => onToggle(osca)} aria-label={saved ? `Remove ${title} from shortlist` : `Save ${title} to shortlist`}>
      <Icon name="bookmark" size={20} />
    </button>
  );
}

function FeatureCard({ c, m, saved, onToggle, onOpen, journeyHref }: { c: PlanCareer; m: MatchSummary; saved: boolean; onToggle?: (o: string) => void; onOpen: () => void; journeyHref: string }) {
  const s = c.scores!;
  return (
    <article className="feature-card" aria-labelledby={`t-${c.occupationId}`}>
      <div className="feature-art">
        <OccupationImage family={m.family} title={c.title} photo={m.photo} />
        <span className="top-badge">
          <Icon name="star" size={16} /> {onToggle ? "#1 Match for You" : "#1 Match"}
        </span>
      </div>
      <div className="feature-main">
        <div className="feature-head">
          <div>
            <h2 id={`t-${c.occupationId}`}>{c.title}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {m.summary}
            </p>
          </div>
          <ScoreRing value={s.personalFit} label="Personal fit" size={112} stroke={10} />
        </div>
        <div className="feature-meters">
          <Meter label="Interests fit" value={pct(m.fitParts.interests)} colour="#6c5ce7" />
          <Meter label="Skills fit" value={pct(m.fitParts.skills)} colour="#3b82f6" />
          <Meter label="Values fit" value={pct(m.fitParts.values)} colour="#f43f5e" />
          <Meter label="Work-style fit" value={pct(m.fitParts.environment)} colour="#14b8a6" />
          <Meter label="Future opportunity" value={s.futureOpportunity} colour="#22c55e" />
          <Meter label="Pathway feasibility" value={s.pathwayFeasibility} colour="#f59e0b" />
        </div>
        <Tags tags={m.tags} />
        <p className="small" style={{ margin: "0.4rem 0 0" }}>
          {c.matchScore}% overall match · {c.confidence?.level} confidence · about {formatYears(m.timeToQualify.years)} to qualify ·{" "}
          {formatRange(m.salary.entry)} starting
        </p>
      </div>
      <div className="feature-why">
        <Icon name="bulb" size={34} className="bulb" />
        <p>
          <strong>Why this matches you</strong>
          <br />
          {c.whyItFits}
        </p>
        <div className="why-actions">
          <SaveButton osca={c.occupationId} saved={saved} onToggle={onToggle} title={c.title} />
          <button className="button secondary" onClick={onOpen}>
            Details
          </button>
          <Link href={journeyHref} className="button primary">
            View Journey <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function MatchCard({ c, m, saved, onToggle, onOpen }: { c: PlanCareer; m: MatchSummary; saved: boolean; onToggle?: (o: string) => void; onOpen: () => void }) {
  return (
    <article className="match-card" aria-labelledby={`t-${c.occupationId}`}>
      <div className="match-art">
        <OccupationImage family={m.family} title={c.title} photo={m.photo} />
        <ScoreRing value={c.scores!.personalFit} label="Fit" size={74} stroke={7} />
      </div>
      <h3 id={`t-${c.occupationId}`}>{c.title}</h3>
      <p>{m.summary}</p>
      <Tags tags={m.tags} limit={3} />
      <p className="small" style={{ margin: 0 }}>
        Future opportunity {c.scores!.futureOpportunity} · Pathway {c.scores!.pathwayFeasibility}
      </p>
      <div className="actions">
        <button className="button outline" onClick={onOpen}>
          View Career <Icon name="arrowRight" size={16} />
        </button>
        <SaveButton osca={c.occupationId} saved={saved} onToggle={onToggle} title={c.title} />
      </div>
    </article>
  );
}

function CareerDetail({ c, m }: { c: PlanCareer; m: MatchSummary }) {
  const s = c.scores!;
  const f = c.future!;
  const facts = c.facts;
  return (
    <>
      <div className="detail-art">
        <OccupationImage family={m.family} title={c.title} photo={m.photo} />
      </div>
      <div className="detail-body">
        <h2 style={{ fontSize: "1.6rem" }}>{c.title}</h2>
        <Tags tags={m.tags} />
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", margin: "0.75rem 0" }}>
          <ScoreRing value={s.personalFit} label="Personal fit" />
          <div style={{ flex: 1, minWidth: 220, display: "grid", gap: "0.4rem" }}>
            <Meter label="Future opportunity" value={s.futureOpportunity} colour="#22c55e" />
            <Meter label="Pathway feasibility" value={s.pathwayFeasibility} colour="#f59e0b" />
            <span className="small">
              {c.matchScore}% overall match (personal fit counts most) · {c.confidence?.level} confidence
            </span>
          </div>
        </div>
        <p>{c.whyItFits}</p>
        {c.improvement && (
          <p className="improve">
            Pathway feasibility could rise from {s.pathwayFeasibility} to about {c.improvement.to} {c.improvement.action}.
          </p>
        )}
        <div className="detail-grid">
          <div>
            <h4>Strong matches</h4>
            <ul className="plus-list">
              {c.strengths!.map((x) => (
                <li key={x.label}>
                  <span>{x.label}</span>
                  <span className="plus" aria-label={`strength ${x.strength} of 9`}>
                    {"+".repeat(x.strength)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {c.challenges!.length > 0 && (
            <div>
              <h4>Things you&apos;d need to build</h4>
              <ul>
                {c.challenges!.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4>Future outlook</h4>
            <dl className="kv">
              <dt>Employment outlook</dt>
              <dd>{BAND_TEXT[f.employment]}</dd>
              <dt>Skills shortage now</dt>
              <dd>{f.shortage ? "Yes" : "No"}</dd>
              <dt>AI augmentation</dt>
              <dd>{f.aiAugmentation}</dd>
              <dt>AI automation</dt>
              <dd>{f.aiAutomation}</dd>
              <dt>Income outlook</dt>
              <dd>{f.income}</dd>
            </dl>
          </div>
          {facts && (
            <div>
              <h4>Pay and time</h4>
              <dl className="kv">
                <dt>Starting</dt>
                <dd>{formatRange(facts.salary.entry)}</dd>
                <dt>Experienced</dt>
                <dd>{formatRange(facts.salary.experienced)}</dd>
                <dt>To qualify</dt>
                <dd>{formatYears(facts.timeToQualify.years)} after Year 12</dd>
                <dt>From now</dt>
                <dd>about {formatYears(facts.timeToQualify.fromNow)}</dd>
              </dl>
            </div>
          )}
        </div>
        <p className="muted">{c.outlook}</p>
        <p>
          <strong>How to get there:</strong> {c.howToGetThere}
        </p>
        {facts && (
          <>
            <h4>Ways in</h4>
            <ul>
              {facts.pathways.map((p) => (
                <li key={`${p.route}-${p.description}`}>
                  <strong>{ROUTE_LABEL[p.route]}</strong> ({formatYears(p.years)}): {p.description}
                  {p.qualification && <span className="muted"> · AQF level {p.qualification.aqfLevel}</span>}
                </li>
              ))}
            </ul>
            <h4 style={{ marginTop: "1rem" }}>Skills you&apos;d use</h4>
            <ul className="tags">
              {facts.skills.map((sk) => (
                <li key={sk} className="tag teal">
                  {sk}
                </li>
              ))}
            </ul>
            <p className="source">
              OSCA {facts.osca}: {facts.oscaTitle}
              {m.evidence && <> · Sources: {[...new Set(Object.values(m.evidence).map((e) => e.split(" (")[0]))].join("; ")}</>}
            </p>
          </>
        )}
      </div>
    </>
  );
}

export type PlanMode = "live" | "history" | "adviser";

/**
 * The results page. "live": straight after the questions (from sessionStorage). "history": a saved
 * assessment on the student's profile. "adviser": a careers adviser viewing a student's assessment.
 */
export default function PlanView({ initial, mode = "live", title, subtitle }: { initial?: Result; mode?: PlanMode; title?: ReactNode; subtitle?: string }) {
  const live = mode === "live";
  const [result, setResult] = useState<Result | null | undefined>(initial);
  const [showCareers, setShowCareers] = useState(!live);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!live) {
      setShortlist(readShortlist());
      return;
    }
    try {
      const raw = sessionStorage.getItem("bcome:result");
      setResult(raw ? (JSON.parse(raw) as Result) : null);
      setShowCareers(sessionStorage.getItem(SEEN_DNA_KEY) === "1");
    } catch {
      setResult(null);
    }
    recordVisit();
    setStreak(streakFrom(readActivity()));
    setShortlist(readShortlist());
  }, [live]);

  if (result === undefined) return null;
  if (result === null || !result.dna) {
    return (
      <main className="page">
        <h1>No Career Profile yet</h1>
        <p className="lead">Answer the questions first and your Career DNA and career matches will appear here.</p>
        <Link href="/" className="button primary">
          Start the questions
        </Link>
      </main>
    );
  }

  const { plan, matches, dna } = result;
  const matchFor = (id: string) => matches.find((m) => m.id === id);
  const careers = plan.careers.filter((c) => matchFor(c.occupationId) && c.scores);
  const best = careers.filter((c) => c.group === "best");
  const [top, ...rest] = best;
  const explore = careers.filter((c) => c.group === "explore");
  const wildcard = careers.filter((c) => c.group === "wildcard");
  const riasec = Object.fromEntries(RIASEC.map((t) => [t, dna.interests.find((i) => i.id === t)?.score ?? 0])) as Record<RiasecType, number>;
  const [i1, i2] = dna.interests;
  const xp = xpFor(QUESTIONS_ANSWERED, true);
  const saved = (o: string) => shortlist.includes(o);
  const toggle = (o: string) => setShortlist(toggleShortlist(o));
  const shortlisted = Math.min(shortlist.filter((o) => careers.some((c) => c.occupationId === o)).length, 2);
  const openCareer = careers.find((c) => c.occupationId === open);

  const reveal = () => {
    setShowCareers(true);
    try {
      sessionStorage.setItem(SEEN_DNA_KEY, "1");
    } catch {
      /* storage blocked: fine */
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const restart = () => {
    for (const k of ["bcome:answers", "bcome:history", "bcome:result", SEEN_DNA_KEY]) sessionStorage.removeItem(k);
  };

  const card = (c: PlanCareer) => (
    <MatchCard key={c.occupationId} c={c} m={matchFor(c.occupationId)!} saved={saved(c.occupationId)} onToggle={mode === "adviser" ? undefined : toggle} onOpen={() => setOpen(c.occupationId)} />
  );

  return (
    <main className="page-grid">
      <div className="main-col">
        <section className="hero">
          <div>
            <h1>
              {title ?? (showCareers ? (
                <>
                  Your <span className="grad-text">Career Matches</span>
                </>
              ) : (
                <>
                  Meet your <span className="grad-text">Career DNA</span>
                </>
              ))}
            </h1>
            <p className="hero-sub">
              {subtitle ?? (showCareers
                ? "Based on your answers, here are the careers that fit you best, ordered by personal fit."
                : "You've finished the questions. Here's what your answers say about you.")}
            </p>
          </div>
          {mode !== "adviser" && (
          <p className="hand hero-note" aria-hidden="true">
            Your future,
            <br />
            your way.
            <Icon name="sun" size={46} strokeWidth={1.6} className="hero-sun" />
          </p>
          )}
        </section>

        {live && <StatsCard pct={100} xp={xp} streak={streak} />}
        {!live && <CareerDnaReveal dna={dna} summary={plan.dnaSummary} adviser={mode === "adviser"} />}

        {!showCareers ? (
          <CareerDnaReveal dna={dna} summary={plan.dnaSummary} onNext={reveal} />
        ) : (
          <>
            {top && (
              <FeatureCard
                c={top}
                m={matchFor(top.occupationId)!}
                saved={saved(top.occupationId)}
                onToggle={mode === "adviser" ? undefined : toggle}
                onOpen={() => setOpen(top.occupationId)}
                journeyHref={live ? "/journey" : "#journey"}
              />
            )}

            {rest.length > 0 && (
              <section aria-labelledby="more-best">
                <div className="group-head">
                  <h2 id="more-best">More great matches</h2>
                  <p>Strong fits, spread across different fields.</p>
                </div>
                <div className="match-grid" style={{ marginTop: "0.75rem" }}>
                  {rest.map(card)}
                </div>
              </section>
            )}

            {explore.length > 0 && (
              <section aria-labelledby="explore">
                <div className="group-head">
                  <h2 id="explore">Careers worth exploring</h2>
                  <p>Good fits that may need subjects, skills or study you haven&apos;t planned for yet.</p>
                </div>
                <div className="match-grid" style={{ marginTop: "0.75rem" }}>
                  {explore.map(card)}
                </div>
              </section>
            )}

            {wildcard.length > 0 && (
              <section aria-labelledby="wildcard">
                <div className="group-head">
                  <h2 id="wildcard">Wildcard</h2>
                  <p>A strong match from a field you might not have considered.</p>
                </div>
                <div className="match-grid" style={{ marginTop: "0.75rem" }}>
                  {wildcard.map(card)}
                </div>
              </section>
            )}

            <p className="fit-note">
              Careers are ordered by <strong>personal fit</strong>: how well the work matches your interests, strengths, values and preferred way of working.
              Future opportunity and pathway feasibility are shown alongside. A score describes fit, not the chance you&apos;ll enjoy the job.
            </p>

            {plan.skillsBridge && plan.skillsBridge.length > 0 && (
              <section className="side-card" aria-labelledby="bridge">
                <h2 id="bridge">Skills worth building whichever you choose</h2>
                <ul className="tags">
                  {plan.skillsBridge.map((sk) => (
                    <li key={sk} className="tag blue">
                      {sk}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="side-card" aria-labelledby="this-term">
              <h2 id="this-term">Do these this term</h2>
              <ul className="feature-list">
                {plan.nextSteps.map((n) => (
                  <li key={n}>
                    <Icon name="check" size={18} className="tone-teal" /> {n}
                  </li>
                ))}
              </ul>
            </section>

            <section className="side-card" aria-labelledby="future">
              <h2 id="future">How work is changing</h2>
              <ul>
                {plan.futureOfWork.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {plan.caveats.length > 0 && (
                <>
                  <h3 style={{ marginTop: "1rem" }}>Keep in mind</h3>
                  <ul>
                    {plan.caveats.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {!live && (
              <section className="side-card" aria-labelledby="journey" id="journey">
                <h2 id="journey">Journey towards {inSentence(plan.journey.title)}</h2>
                <JourneyTimeline periods={plan.journey.periods} />
              </section>
            )}

            <div className="no-print" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {live && (
                <Link href="/journey" className="button primary">
                  See my journey to {inSentence(plan.journey.title)}
                </Link>
              )}
              <button className="button secondary" onClick={() => window.print()}>
                Print or save as PDF
              </button>
              {live && (
                <Link href="/" className="button ghost" onClick={restart}>
                  Start again
                </Link>
              )}
            </div>
            {live && !result.saved && (
              <p className="muted no-print">
                This plan isn&apos;t saved. <Link href="/login/student">Sign in</Link> or <Link href="/signup">create an account</Link> before you
                start, to keep every result on your profile.
              </p>
            )}
            {live && result.saved && (
              <p className="notice success no-print">
                <Icon name="check" size={16} /> Saved to your profile. <Link href="/account">See all your assessments</Link>
              </p>
            )}
            <p className="small-print">
              Job outlooks use {plan.meta.dataSource}. Figures marked &ldquo;about&rdquo; are estimates from projections for similar jobs. JSA&apos;s
              projections don&apos;t include generative AI, so AI exposure is shown separately and is currently a Bcome estimate. Shortage, regional
              demand, graduate outcomes and pay are rough guides until official data is loaded. Occupations are coded to OSCA 2024. Pictures are
              illustrations. Always check entry requirements with the course provider.
            </p>
          </>
        )}
      </div>

      <aside className="side-col" aria-label="Your profile">
        <section className="side-card">
          <div className="side-head">
            <span className="side-icon">
              <Icon name="chart" size={22} />
            </span>
            <div>
              <h2>{mode === "adviser" ? "RIASEC Profile" : "Your RIASEC Profile"}</h2>
              <p>{mode === "adviser" ? "How their interests line up" : "How your interests line up"}</p>
            </div>
            <span className="pill">{plan.hollandCode}</span>
          </div>
          <div className="riasec-wrap">
            <RiasecRadar scores={riasec} size={150} />
            <RiasecBars scores={riasec} />
          </div>
          {i1 && i2 && (
            <div className="types-card">
              <span className="side-icon" style={{ background: "var(--tone-purple)", color: "var(--violet)" }}>
                <Icon name="spark" size={22} />
              </span>
              <div>
                <span className="small">{mode === "adviser" ? "Top profile types" : "Your top profile types"}</span>
                <h3>
                  {i1.label} + {i2.label}
                </h3>
                <p>{plan.dnaSummary}</p>
              </div>
            </div>
          )}
        </section>

        {live && (
          <>
        <section className="badge-card">
          <span className="medal" aria-hidden="true">
            <Icon name="trophy" size={30} />
          </span>
          <div>
            <span className="small">Badge unlocked</span>
            <h2>Assessment Complete</h2>
            <p>You&apos;ve completed your career profile. +100 XP</p>
          </div>
        </section>

        <section className="side-card">
          <div className="challenge">
            <span className="flag">
              <Icon name="flag" size={22} />
            </span>
            <div>
              <h2>Your Next Challenge</h2>
              <p>Save 2 career matches to your shortlist.</p>
              <div className="progress-row" style={{ marginTop: "0.6rem" }}>
                <span className="progress" aria-hidden="true">
                  <span style={{ width: `${(shortlisted / 2) * 100}%` }} />
                </span>
                <strong>{shortlisted}/2</strong>
              </div>
            </div>
            <span className="coin" aria-hidden="true">
              <Icon name="star" size={18} />
            </span>
          </div>
        </section>
          </>
        )}
      </aside>

      <Modal open={!!openCareer} onClose={() => setOpen(null)} label={openCareer?.title ?? "Career"}>
        {openCareer && <CareerDetail c={openCareer} m={matchFor(openCareer.occupationId)!} />}
      </Modal>
    </main>
  );
}

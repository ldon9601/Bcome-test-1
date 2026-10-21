"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRange, formatYears, ROUTE_LABEL, type CareerFacts } from "@/lib/careers/facts.ts";
import type { MatchSummary } from "@/lib/careers/matching.ts";
import type { CareerPlan, PlanCareer } from "@/lib/plan/types.ts";

interface DnaView {
  dimensions: { id: string; label: string; score: number }[];
  interests: { id: string; label: string; score: number }[];
  strongestSignals: { id: string; label: string; score: number }[];
  values: { id: string; label: string; score: number }[];
}

interface Result {
  dna: DnaView;
  matches: MatchSummary[];
  plan: CareerPlan;
  saved: boolean;
}

/** Lower-cases ordinary words but keeps acronyms such as CAD and AI. */
const inSentence = (t: string) => t.replace(/\b([A-Z])([a-z]+)\b/g, (_w, a: string, b: string) => a.toLowerCase() + b);

const BAND_TEXT: Record<string, string> = {
  strong: "Strong",
  good: "Good",
  moderate: "Moderate",
  limited: "Limited",
  declining: "Shrinking",
  unknown: "Not yet known",
};

const GROUPS: { id: "best" | "explore" | "wildcard"; title: string; intro: string }[] = [
  { id: "best", title: "Best matches", intro: "The careers that fit you best, spread across different fields." },
  { id: "explore", title: "Careers worth exploring", intro: "More strong fits, especially ones that may need subjects, skills or study you haven't planned for yet." },
  { id: "wildcard", title: "Wildcard", intro: "A strong match from a field you might not have considered." },
];

function Bars({ items }: { items: { id: string; label: string; score: number }[] }) {
  return (
    <ul className="dna-bars">
      {items.map((d) => (
        <li key={d.id}>
          <span className="dna-label">{d.label}</span>
          <span className="score-bar" aria-hidden="true">
            <span style={{ width: `${d.score}%` }} />
          </span>
          <span className="score-value">{d.score}</span>
        </li>
      ))}
    </ul>
  );
}

function CareerDna({ dna, summary }: { dna: DnaView; summary: string }) {
  return (
    <section className="plan-section" aria-labelledby="dna">
      <h1 id="dna">Your Career DNA</h1>
      <Bars items={dna.dimensions} />
      <h2>What this suggests</h2>
      <p className="plan-summary">{summary}</p>
      <div className="dna-grid">
        <div>
          <h3>Core interests</h3>
          <Bars items={dna.interests} />
        </div>
        <div>
          <h3>Your strongest signals</h3>
          <Bars items={dna.strongestSignals} />
        </div>
        <div>
          <h3>What you value</h3>
          <p className="muted">Compared with your other values.</p>
          <Bars items={dna.values} />
        </div>
      </div>
      <p className="muted">These are your answers today, not fixed traits. Skills and interests change a lot between 15 and 25.</p>
    </section>
  );
}

function Scores({ c, match }: { c: PlanCareer; match?: MatchSummary }) {
  const s = c.scores!;
  const rows = [
    { key: "futureOpportunity" as const, label: "Future opportunity", score: s.futureOpportunity },
    { key: "pathwayFeasibility" as const, label: "Pathway feasibility", score: s.pathwayFeasibility },
  ];
  return (
    <div className="scores">
      <div className="fit-score">
        <span className="fit-number">{s.personalFit}%</span>
        <span>
          <strong>Personal fit</strong>
          <span className="muted">
            {" "}
            · {c.matchScore}% overall match · {c.confidence?.level} confidence
          </span>
        </span>
      </div>
      {rows.map((r) => (
        <details key={r.key} className="score">
          <summary>
            <span className="score-label">{r.label}</span>
            <span className="score-bar" role="meter" aria-valuenow={r.score} aria-valuemin={0} aria-valuemax={100} aria-label={r.label}>
              <span style={{ width: `${r.score}%` }} />
            </span>
            <span className="score-value">{r.score}</span>
          </summary>
          <ul>
            {match?.scores[r.key].reasons.map((x) => <li key={x}>{x}</li>)}
            {match?.scores[r.key].cautions.map((x) => (
              <li key={x} className="caution">
                {x}
              </li>
            ))}
          </ul>
        </details>
      ))}
      {c.improvement && (
        <p className="improve">
          Pathway feasibility today: {s.pathwayFeasibility}. It could rise to about {c.improvement.to} {c.improvement.action}.
        </p>
      )}
      {c.confidence?.note && <p className="muted">{c.confidence.note}</p>}
    </div>
  );
}

function Facts({ facts }: { facts: CareerFacts }) {
  return (
    <>
      <dl className="facts">
        <div>
          <dt>Time to qualify</dt>
          <dd>
            {formatYears(facts.timeToQualify.years)} after Year 12<span className="muted"> · about {formatYears(facts.timeToQualify.fromNow)} from now</span>
          </dd>
        </div>
        <div>
          <dt>Pay, roughly</dt>
          <dd>
            {formatRange(facts.salary.entry)} starting, {formatRange(facts.salary.experienced)} with experience
          </dd>
        </div>
      </dl>
      {facts.salary.note && <p className="muted">{facts.salary.note}</p>}
      <h4>Ways in</h4>
      <ul className="pathways">
        {facts.pathways.map((p) => (
          <li key={`${p.route}-${p.description}`}>
            <strong>{ROUTE_LABEL[p.route]}</strong> ({formatYears(p.years)}): {p.description}
            {p.qualification && <span className="muted"> · AQF level {p.qualification.aqfLevel}</span>}
            {p.skillsBuilt.length > 0 && <span className="muted"> · builds {p.skillsBuilt.map(inSentence).join(", ")}</span>}
          </li>
        ))}
      </ul>
      <h4>Skills you&apos;d use</h4>
      <ul className="chips" aria-label="Skills">
        {facts.skills.map((sk) => (
          <li key={sk}>{sk}</li>
        ))}
      </ul>
    </>
  );
}

function CareerCard({ c, match }: { c: PlanCareer; match?: MatchSummary }) {
  const f = c.future!;
  return (
    <article className="career">
      <h3>{c.title}</h3>
      <Scores c={c} match={match} />
      <p>{c.whyItFits}</p>
      <details className="why">
        <summary>Why this matches you</summary>
        <div className="why-grid">
          <div>
            <h4>Strong matches</h4>
            <ul className="plus-list">
              {c.strengths!.map((s) => (
                <li key={s.label}>
                  <span>{s.label}</span>
                  <span className="plus" aria-label={`strength ${s.strength} of 9`}>
                    {"+".repeat(s.strength)}
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
            <dl className="outlook-table">
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
              <dt>Education requirement</dt>
              <dd>{f.education}</dd>
            </dl>
          </div>
        </div>
      </details>
      <p className="muted">{c.outlook}</p>
      <p>
        <strong>How to get there:</strong> {c.howToGetThere}
      </p>
      {c.facts && <Facts facts={c.facts} />}
      {c.facts && (
        <p className="code">
          OSCA {c.facts.osca}: {c.facts.oscaTitle}
          {match?.evidence && <> · Sources: {[...new Set(Object.values(match.evidence).map((e) => e.split(" (")[0]))].join("; ")}</>}
        </p>
      )}
    </article>
  );
}

export default function PlanView() {
  const [result, setResult] = useState<Result | null | undefined>(undefined);
  const [showCareers, setShowCareers] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bcome:result");
      setResult(raw ? (JSON.parse(raw) as Result) : null);
    } catch {
      setResult(null);
    }
  }, []);

  if (result === undefined) return null;
  if (result === null || !result.dna) {
    return (
      <>
        <h1>No Career Profile yet</h1>
        <p className="lead">Answer the questions first and your Career DNA and career matches will appear here.</p>
        <Link href="/questionnaire" className="button">
          Start the questions
        </Link>
      </>
    );
  }

  const { plan, matches, dna } = result;
  const matchFor = (id: string) => matches.find((m) => m.id === id);
  const restart = () => {
    sessionStorage.removeItem("bcome:answers");
    sessionStorage.removeItem("bcome:history");
    sessionStorage.removeItem("bcome:result");
  };

  return (
    <>
      <CareerDna dna={dna} summary={plan.dnaSummary} />

      {!showCareers ? (
        <button className="button" onClick={() => setShowCareers(true)}>
          Show careers that fit me
        </button>
      ) : (
        <>
          <section className="plan-section" aria-labelledby="careers">
            <h2 id="careers">Careers that fit you</h2>
            <p>{plan.summary}</p>
            <p className="muted">
              Careers are ordered by personal fit. Future opportunity and pathway feasibility are shown alongside; the overall match weights the three
              60 / 25 / 15. A match score describes fit, not the chance you&apos;ll enjoy the job.
            </p>
            {GROUPS.map((g) => {
              const careers = plan.careers.filter((c) => c.group === g.id);
              if (!careers.length) return null;
              return (
                <div key={g.id} className="career-group">
                  <h3 className="group-title">{g.title}</h3>
                  <p className="muted">{g.intro}</p>
                  {careers.map((c) => (
                    <CareerCard key={c.occupationId} c={c} match={matchFor(c.occupationId)} />
                  ))}
                </div>
              );
            })}
          </section>

          <section className="plan-section" aria-labelledby="journey">
            <h2 id="journey">Your journey towards {inSentence(plan.journey.title)}</h2>
            <ol className="route">
              {plan.journey.periods.map((p, i) => (
                <li key={p.id} data-step={i + 1}>
                  <h3>{p.period}</h3>
                  <p className="timeframe">{p.focus}</p>
                  <ul>
                    {p.actions.map((a) => (
                      <li key={a.text}>{a.text}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>

          {plan.skillsBridge && plan.skillsBridge.length > 0 && (
            <section className="plan-section" aria-labelledby="bridge">
              <h2 id="bridge">Skills worth building whichever you choose</h2>
              <ul className="chips">
                {plan.skillsBridge.map((sk) => (
                  <li key={sk}>{sk}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="plan-section" aria-labelledby="this-term">
            <h2 id="this-term">Do these this term</h2>
            <ul>
              {plan.nextSteps.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>

          <section className="plan-section" aria-labelledby="future">
            <h2 id="future">How work is changing</h2>
            <ul>
              {plan.futureOfWork.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>

          {plan.caveats.length > 0 && (
            <section className="plan-section" aria-labelledby="mind">
              <h2 id="mind">Keep in mind</h2>
              <ul>
                {plan.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="no-print" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="button" onClick={() => window.print()}>
              Print or save as PDF
            </button>
            <Link href="/questionnaire" className="button secondary" onClick={restart}>
              Start again
            </Link>
          </div>
          {!result.saved && (
            <p className="muted no-print" style={{ marginTop: "1rem" }}>
              This plan isn&apos;t saved. <Link href="/login">Sign in</Link> before you start to keep it and come back for a check-in in six months.
            </p>
          )}

          <p className="small-print">
            Job outlooks use {plan.meta.dataSource}. Figures marked &ldquo;about&rdquo; are estimates from projections for similar jobs. JSA&apos;s
            projections don&apos;t include generative AI, so AI exposure is shown separately and is currently a Bcome estimate. Shortage, regional demand,
            graduate outcomes and pay are rough guides until official data is loaded. Occupations are coded to OSCA 2024. Always check entry requirements
            with the course provider.
          </p>
        </>
      )}
    </>
  );
}

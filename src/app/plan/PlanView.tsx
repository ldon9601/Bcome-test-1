"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRange, formatYears, ROUTE_LABEL, type CareerFacts } from "@/lib/careers/facts.ts";
import type { MatchSummary } from "@/lib/careers/matching.ts";
import type { Outlook } from "@/lib/careers/types.ts";
import type { CareerPlan, CareerScores } from "@/lib/plan/types.ts";
import type { StudentProfile } from "@/lib/questionnaire/types.ts";

type ScoreName = keyof CareerScores;

/** Lower-cases ordinary words but keeps acronyms such as CAD and AI. */
const inSentence = (t: string) => t.replace(/\b([A-Z])([a-z]+)\b/g, (_w, a: string, b: string) => a.toLowerCase() + b);


const SCORE_INFO: { key: ScoreName; label: string; hint: string }[] = [
  { key: "personalFit", label: "Personal fit", hint: "How well it suits your interests, values and subjects" },
  { key: "futureOpportunity", label: "Future opportunity", hint: "Job growth over the next 5–15 years, and where its skills could take you" },
  { key: "pathwayFeasibility", label: "Pathway feasibility", hint: "How realistic the route in is for you right now" },
];

function ScoreBars({ match }: { match: MatchSummary }) {
  return (
    <div className="scores">
      {SCORE_INFO.map(({ key, label, hint }) => {
        const s = match.scores[key];
        return (
          <details key={key} className="score">
            <summary>
              <span className="score-label">{label}</span>
              <span className="score-bar" role="meter" aria-valuenow={s.score} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
                <span style={{ width: `${s.score}%` }} />
              </span>
              <span className="score-value">{s.score}</span>
            </summary>
            <p className="muted">{hint}.</p>
            {s.reasons.length > 0 && (
              <ul>
                {s.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {s.cautions.length > 0 && (
              <ul className="cautions">
                {s.cautions.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
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
            {formatYears(facts.timeToQualify.years)} after Year 12
            <span className="muted"> · about {formatYears(facts.timeToQualify.fromNow)} from now</span>
          </dd>
        </div>
        <div>
          <dt>Pay, roughly</dt>
          <dd>
            {formatRange(facts.salary.entry)} starting, {formatRange(facts.salary.experienced)} with experience
            {facts.salary.medianAnnual && <span className="muted"> · JSA median about {formatRange([facts.salary.medianAnnual, facts.salary.medianAnnual])}</span>}
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
        {facts.coreCompetencies.map((sk) => (
          <li key={sk} className="core">
            {sk}
          </li>
        ))}
      </ul>
      {facts.relatedCareers.length > 0 && (
        <p className="muted">
          These skills also lead to {facts.relatedCareers.map((r) => r.title).join(", ")}.
        </p>
      )}
    </>
  );
}

interface Result {
  profile: StudentProfile;
  matches: MatchSummary[];
  plan: CareerPlan;
  saved: boolean;
}

const BAND_TEXT: Record<Outlook["band10"], string> = {
  strong: "Strong growth",
  good: "Good growth",
  moderate: "Moderate growth",
  limited: "Limited growth",
  declining: "Shrinking",
  unknown: "Not yet known",
};

function OutlookRow({ outlook }: { outlook: Outlook }) {
  return (
    <div className="outlook-row">
      <span>
        To 2035: <span className={`band band-${outlook.band10}`}>{BAND_TEXT[outlook.band10]}</span>
        {outlook.growth10Pct != null && ` (${outlook.basis === "jsa-occupation" ? "" : "about "}${Math.round(outlook.growth10Pct)}%)`}
      </span>
      <span>
        Around 2040 (indicative): <span className={`band band-${outlook.band15}`}>{BAND_TEXT[outlook.band15]}</span>
      </span>
    </div>
  );
}

export default function PlanView() {
  const [result, setResult] = useState<Result | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bcome:result");
      setResult(raw ? (JSON.parse(raw) as Result) : null);
    } catch {
      setResult(null);
    }
  }, []);

  if (result === undefined) return null;
  if (result === null) {
    return (
      <>
        <h1>No plan yet</h1>
        <p className="lead">Answer the questions first and your plan will appear here.</p>
        <Link href="/questionnaire" className="button">
          Start the questions
        </Link>
      </>
    );
  }

  const { plan, matches } = result;
  const outlookFor = (id: string) => matches.find((m) => m.id === id)?.outlook;
  const restart = () => {
    sessionStorage.removeItem("bcome:answers");
    sessionStorage.removeItem("bcome:history");
    sessionStorage.removeItem("bcome:result");
  };

  return (
    <>
      <h1>Your career plan</h1>
      <p className="plan-summary">{plan.summary}</p>

      <section className="plan-section" aria-labelledby="careers">
        <h2 id="careers">Careers that fit you</h2>
        {plan.topCareers.map((c) => {
          const outlook = outlookFor(c.occupationId);
          const match = matches.find((m) => m.id === c.occupationId);
          return (
            <article key={c.occupationId} className="career">
              <h3>{c.title}</h3>
              {match && <p className="fit">{match.score}% overall match</p>}
              {match?.scores && <ScoreBars match={match} />}
              <p>{c.whyItFits}</p>
              {outlook && <OutlookRow outlook={outlook} />}
              <p className="muted">{c.outlook}</p>
              <p>
                <strong>How to get there:</strong> {c.howToGetThere}
              </p>
              {c.facts && <Facts facts={c.facts} />}
              {c.facts && <p className="code">OSCA {c.facts.osca}: {c.facts.oscaTitle}</p>}
            </article>
          );
        })}
      </section>

      <section className="plan-section" aria-labelledby="journey">
        <h2 id="journey">Your journey</h2>
        <ol className="route">
          {plan.stages.map((s, i) => (
            <li key={s.id} data-step={i + 1}>
              <h3>{s.title}</h3>
              <p className="timeframe">{s.timeframe}</p>
              <ul>
                {s.actions.map((a) => (
                  <li key={a}>{a}</li>
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

      {plan.alternatives.length > 0 && (
        <section className="plan-section" aria-labelledby="also">
          <h2 id="also">Also worth a look</h2>
          <ul>
            {plan.alternatives.map((a) => (
              <li key={a.title}>
                <strong>{a.title}</strong>: {a.why}
              </li>
            ))}
          </ul>
        </section>
      )}

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
          This plan isn&apos;t saved. <Link href="/login">Sign in</Link> before you start to keep it and share it with your
          careers adviser.
        </p>
      )}

      <p className="small-print">
        Job outlooks use {plan.meta.dataSource}. Figures marked &ldquo;about&rdquo; are estimates from projections for
        similar jobs. The 2040 view is an indicative scenario, not an official projection. Pay ranges are rough guides
        for full-time work before tax and vary by employer, state and award. Occupations are coded to the ABS
        Occupation Standard Classification for Australia (OSCA) 2024. Always check entry requirements with the course
        provider.
      </p>
    </>
  );
}

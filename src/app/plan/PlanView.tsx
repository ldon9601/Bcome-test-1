"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Outlook } from "@/lib/careers/types.ts";
import type { CareerPlan } from "@/lib/plan/types.ts";
import type { StudentProfile } from "@/lib/questionnaire/types.ts";

interface MatchSummary {
  id: string;
  title: string;
  score: number;
  outlook: Outlook;
  reasons: string[];
  cautions: string[];
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
              {match && <p className="fit">{match.score}% match</p>}
              <p>{c.whyItFits}</p>
              {outlook && <OutlookRow outlook={outlook} />}
              <p className="muted">{c.outlook}</p>
              <p>
                <strong>How to get there:</strong> {c.howToGetThere}
              </p>
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
        similar jobs. The 2040 view is an indicative scenario, not an official projection. Always check entry
        requirements with the course provider.
      </p>
    </>
  );
}

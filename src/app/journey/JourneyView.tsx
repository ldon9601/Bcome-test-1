"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon.tsx";
import { OccupationImage } from "@/components/OccupationArt.tsx";
import type { MatchSummary } from "@/lib/careers/matching.ts";
import type { CareerPlan } from "@/lib/plan/types.ts";

const STEP_COLOURS = ["#6c5ce7", "#3b82f6", "#14b8a6", "#22c55e", "#f59e0b", "#f43f5e", "#a855f7"];
const TYPE_LABEL: Record<string, string> = {
  academic: "school",
  skills: "skills",
  exploration: "explore",
  portfolio: "portfolio",
  applications: "apply",
  alternative: "plan B",
  study: "study",
  work: "work",
};

export default function JourneyView() {
  const [result, setResult] = useState<{ plan: CareerPlan; matches: MatchSummary[] } | null | undefined>(undefined);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bcome:result");
      setResult(raw ? JSON.parse(raw) : null);
    } catch {
      setResult(null);
    }
  }, []);

  if (result === undefined) return null;
  if (!result?.plan) {
    return (
      <main className="page">
        <h1>
          Your <span className="grad-text">Journey</span>
        </h1>
        <p className="lead">Finish the Discover questions and your year-by-year plan towards your top career will appear here.</p>
        <Link href="/" className="button primary">
          Start the questions
        </Link>
      </main>
    );
  }

  const { journey } = result.plan;
  const match = result.matches.find((m) => m.id === journey.occupationId);
  return (
    <main className="page" style={{ maxWidth: "56rem" }}>
      <h1>
        Your <span className="grad-text">Journey</span>
      </h1>
      <p className="lead">Steps from where you are now towards {journey.title.toLowerCase()}, your top match. Plans change, and that&apos;s fine.</p>
      {match && (
        <div className="feature-art" style={{ minHeight: 0, height: 200, marginBottom: "1rem" }}>
          <OccupationImage family={match.family} title={match.title} photo={match.photo} />
          <span className="top-badge">
            <Icon name="flag" size={16} /> {journey.title}
          </span>
        </div>
      )}
      <ol className="timeline">
        {journey.periods.map((p, i) => (
          <li key={p.id}>
            <span className="step-dot" style={{ background: STEP_COLOURS[i % STEP_COLOURS.length] }}>
              {i + 1}
            </span>
            <div className="step-card">
              <h3>{p.period}</h3>
              <p className="step-focus">{p.focus}</p>
              <ul>
                {p.actions.map((a) => (
                  <li key={a.text}>
                    <span className="act-type">{TYPE_LABEL[a.type] ?? a.type}</span>
                    {a.text}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/plan" className="button secondary">
          <Icon name="arrowLeft" size={18} /> Back to my matches
        </Link>
      </p>
    </main>
  );
}

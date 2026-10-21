"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon.tsx";
import { JourneyTimeline } from "@/components/JourneyTimeline.tsx";
import { OccupationImage } from "@/components/OccupationArt.tsx";
import type { MatchSummary } from "@/lib/careers/matching.ts";
import type { CareerPlan } from "@/lib/plan/types.ts";

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
      <JourneyTimeline periods={journey.periods} />
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/plan" className="button secondary">
          <Icon name="arrowLeft" size={18} /> Back to my matches
        </Link>
      </p>
    </main>
  );
}

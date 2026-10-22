"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon.tsx";
import { OpportunityCalendar } from "@/components/OpportunityCalendar.tsx";
import { Portfolio } from "@/components/Portfolio.tsx";
import type { ActionCard, CardKind } from "@/lib/activity/cards.ts";
import { activity } from "@/lib/activity/client.ts";
import type { MissionKind, PointsSummary } from "@/lib/activity/missions.ts";
import type { HubData } from "@/lib/activity/service.ts";
import type { EvidenceItem, MissionCompletion } from "@/lib/activity/types.ts";

const MISSION_STYLE: Record<MissionKind, { label: string; icon: IconName; tone: string }> = {
  talk: { label: "Talk to someone", icon: "users", tone: "pink" },
  research: { label: "Research", icon: "search", tone: "blue" },
  do: { label: "Try it", icon: "wrench", tone: "amber" },
  reflect: { label: "Reflect", icon: "bulb", tone: "purple" },
  explore: { label: "Explore", icon: "compass", tone: "teal" },
  apply: { label: "Take action", icon: "flag", tone: "green" },
};
const EFFORT = { quick: "About 20 minutes", standard: "About 45 minutes", stretch: "A stretch: an hour or more" } as const;

const CARD_STYLE: Record<CardKind, { label: string; icon: IconName; tone: string }> = {
  talk: { label: "Talk to people", icon: "users", tone: "pink" },
  attend: { label: "Go along", icon: "flag", tone: "blue" },
  investigate: { label: "Investigate", icon: "search", tone: "teal" },
};

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

function PointsStrip({ p }: { p: PointsSummary }) {
  return (
    <section className="stats-card points-strip" aria-label="Your mission points">
      <div className="stat">
        <span className="coin" aria-hidden="true">
          <Icon name="star" size={20} />
        </span>
        <span>
          <strong>{p.thisWeek} pts</strong>
          <span>This week</span>
        </span>
      </div>
      <div className="stat">
        <Icon name="trophy" size={30} className="xp-star" />
        <span>
          <strong>{p.total.toLocaleString("en-AU")} pts</strong>
          <span>All time</span>
        </span>
      </div>
      <div className="stat">
        <Icon name="flame" size={30} className="flame" />
        <span>
          <strong>
            {p.streak} week{p.streak === 1 ? "" : "s"}
          </strong>
          <span>Mission streak</span>
        </span>
      </div>
      <div className="stat">
        <Icon name="check" size={30} className="xp-star" />
        <span>
          <strong>{p.completed}</strong>
          <span>Missions done</span>
        </span>
      </div>
    </section>
  );
}

function WeeklyChart({ p }: { p: PointsSummary }) {
  const max = Math.max(100, ...p.history.map((h) => h.points));
  return (
    <section className="side-card" aria-labelledby="weekly-points">
      <div className="side-head">
        <span className="side-icon" style={{ background: "var(--tone-amber)", color: "#b45309" }}>
          <Icon name="chart" size={22} />
        </span>
        <div>
          <h2 id="weekly-points">Weekly points</h2>
          <p>Complete a mission each week to build your streak. Every week in a row adds 10 bonus points (up to 50).</p>
        </div>
      </div>
      <div className="week-bars" role="img" aria-label={p.history.map((h) => `Week of ${short(h.monday)}: ${h.points} points`).join("; ")}>
        {p.history.map((h, i) => (
          <div key={h.week} className={`week-bar${i === p.history.length - 1 ? " now" : ""}`}>
            <span className="week-val">{h.points || ""}</span>
            <span className="week-fill" style={{ height: `${Math.max(4, (h.points / max) * 100)}%` }} />
            <span className="week-label">{i === p.history.length - 1 ? "Now" : `${Number(h.monday.slice(8))}/${Number(h.monday.slice(5, 7))}`}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MissionCard({ hub, onDone }: { hub: HubData; onDone: (c: MissionCompletion, p: PointsSummary, e: EvidenceItem | null) => void }) {
  const m = hub.mission;
  const [ticks, setTicks] = useState<boolean[]>([]);
  const [reflection, setReflection] = useState("");
  const [toPortfolio, setToPortfolio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextMonday = new Date(new Date(`${hub.weekStarts}T00:00:00Z`).getTime() + 7 * 864e5).toISOString().slice(0, 10);

  if (hub.completed) {
    return (
      <section className="quest-card mission-card" aria-labelledby="mission-title">
        <div className="quest-body">
          <div className="quest-title">
            <Icon name="check" size={26} />
            <h2 id="mission-title">Mission complete!</h2>
            <span className="pill">+{hub.completed.points} pts</span>
          </div>
          <p>
            <strong>{hub.completed.title}</strong>
          </p>
          <blockquote className="reflection">&ldquo;{hub.completed.reflection}&rdquo;</blockquote>
          <p>Your next mission unlocks on {fmtDay(nextMonday)}. In the meantime, try an action card or add something to your portfolio.</p>
        </div>
      </section>
    );
  }
  if (!m) {
    return (
      <section className="card side-card">
        <h2>Weekly Career Missions</h2>
        <p className="muted">Complete your Career Profile to get a personalised mission every week.</p>
        <Link href="/?retake=1" className="button primary">
          Start the questions
        </Link>
      </section>
    );
  }
  const style = MISSION_STYLE[m.kind];
  return (
    <section className="quest-card mission-card" aria-labelledby="mission-title">
      <div className="quest-body">
        <div className="mission-top">
          <span className={`tag ${style.tone}`}>
            <Icon name={style.icon} size={14} /> {style.label}
          </span>
          <span className="small">
            This week&apos;s mission · {EFFORT[m.effort]}
            {m.career ? ` · for ${m.career.title}` : ""}
          </span>
        </div>
        <div className="quest-title">
          <Icon name="target" size={26} />
          <h2 id="mission-title">{m.title}</h2>
        </div>
        <p>{m.why}</p>
        <ol className="mission-steps">
          {m.steps.map((s, i) => (
            <li key={i}>
              <label className="check">
                <input type="checkbox" checked={!!ticks[i]} onChange={(e) => setTicks((t) => Object.assign([...t], { [i]: e.target.checked }))} />
                <span className={ticks[i] ? "ticked" : ""}>{s}</span>
              </label>
            </li>
          ))}
        </ol>
        {m.link && (
          <p>
            {m.link.url.startsWith("/") ? (
              <Link href={m.link.url} className="button secondary small-btn">
                {m.link.label} <Icon name="arrowRight" size={16} />
              </Link>
            ) : (
              <a href={m.link.url} target="_blank" rel="noopener noreferrer" className="button secondary small-btn">
                {m.link.label} <Icon name="arrowRight" size={16} />
              </a>
            )}
          </p>
        )}
        <form
          className="mission-done"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const r = await activity<{ completion: MissionCompletion; points: PointsSummary; evidence: EvidenceItem | null }>("mission-complete", { missionId: m.id, reflection, addToPortfolio: toPortfolio });
            setBusy(false);
            if (!r.ok) return setError(r.error);
            onDone(r.completion, r.points, r.evidence);
          }}
        >
          <label htmlFor="reflection" className="label-like">
            Done it? Tell us what you did or found out
          </label>
          <textarea id="reflection" rows={3} maxLength={600} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="e.g. I found out the course needs Chemistry, so I'll talk to my adviser about subjects." />
          <label className="check small">
            <input type="checkbox" checked={toPortfolio} onChange={(e) => setToPortfolio(e.target.checked)} /> Also save it to my Skills Evidence Portfolio
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="mission-submit">
            <button className="button primary" disabled={busy || reflection.trim().length < 10}>
              <Icon name="check" size={18} /> {busy ? "Saving…" : "Complete mission"}
            </button>
            <div className="quest-reward">
              <span className="coin" aria-hidden="true">
                <Icon name="star" size={20} />
              </span>
              <span>
                <strong>+{m.points} points</strong>
                <span>{m.streakBonus ? `Includes a ${m.streakBonus}-point streak bonus` : "Start a streak this week"}</span>
              </span>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

function ActionCards({ initial, month }: { initial: ActionCard[]; month: string }) {
  const [cards, setCards] = useState(initial);
  const [showHidden, setShowHidden] = useState(false);
  const set = async (key: string, status: "done" | "dismissed" | null) => {
    const prev = cards;
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, status } : c)));
    const r = await activity("card", { key, status });
    if (!r.ok) setCards(prev);
  };
  const open = cards.filter((c) => !c.status);
  const done = cards.filter((c) => c.status === "done").length;
  const hidden = cards.filter((c) => c.status);
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });

  return (
    <section aria-labelledby="action-cards">
      <div className="group-head">
        <h2 id="action-cards">
          <Icon name="flag" size={22} /> Real-World Action Cards
        </h2>
        <span className="small">
          {done} of {cards.length} done in {label}
        </span>
      </div>
      <p className="muted">Things to do out in the world this month: talk to people, go to events and look into your pathways.</p>
      {open.length === 0 ? (
        <p className="notice success">
          <Icon name="check" size={18} /> You&apos;ve worked through this month&apos;s cards. New ones arrive at the start of next month.
        </p>
      ) : (
        <div className="action-grid">
          {open.map((c) => {
            const s = CARD_STYLE[c.kind];
            return (
              <article key={c.key} className={`action-card ${s.tone}`}>
                <div className="action-top">
                  <span className={`event-icon ${s.tone}`} aria-hidden="true">
                    <Icon name={s.icon} size={18} />
                  </span>
                  <span className="small">{s.label}</span>
                  {c.date && <span className="date-chip">{short(c.date)}</span>}
                </div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                {c.career && <span className="small">For: {c.career}</span>}
                <div className="action-buttons">
                  {c.link &&
                    (c.link.external ? (
                      <a href={c.link.url} target="_blank" rel="noopener noreferrer" className="linkish">
                        {c.link.label}
                      </a>
                    ) : (
                      <Link href={c.link.url} className="linkish">
                        {c.link.label}
                      </Link>
                    ))}
                  <span style={{ flex: 1 }} />
                  <button className="button secondary small-btn" onClick={() => set(c.key, "dismissed")}>
                    Not now
                  </button>
                  <button className="button primary small-btn" onClick={() => set(c.key, "done")}>
                    <Icon name="check" size={16} /> Done
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {hidden.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          <button className="linkish" onClick={() => setShowHidden((x) => !x)} aria-expanded={showHidden}>
            {showHidden ? "Hide" : "Show"} done and skipped cards ({hidden.length})
          </button>
          {showHidden && (
            <ul className="done-cards">
              {hidden.map((c) => (
                <li key={c.key}>
                  <span className={`tag ${c.status === "done" ? "green" : "slate"}`}>{c.status === "done" ? "Done" : "Skipped"}</span> {c.title}{" "}
                  <button className="linkish" onClick={() => set(c.key, null)}>
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** The Discover tab once a student has their Career Profile results. */
export default function DiscoverHub({ initial, latestAssessmentId }: { initial: HubData; latestAssessmentId: string | null }) {
  const [hub, setHub] = useState(initial);
  const [portfolioKey, setPortfolioKey] = useState(0);
  return (
    <main className="page-grid">
      <div className="main-col">
        <section className="hero">
          <div>
            <h1>
              Your week, <span className="grad-text">{hub.firstName}</span>
            </h1>
            <p className="hero-sub">One mission, a few real-world actions, what&apos;s on, and the evidence you&apos;re building for your future.</p>
          </div>
          <div className="hero-actions">
            {latestAssessmentId && (
              <Link href={`/account/assessments/${latestAssessmentId}`} className="button secondary">
                <Icon name="briefcase" size={18} /> My career matches
              </Link>
            )}
            <Link href="/?retake=1" className="button secondary">
              <Icon name="refresh" size={18} /> Retake Career Profile
            </Link>
          </div>
        </section>
        <PointsStrip p={hub.points} />
        <MissionCard
          hub={hub}
          onDone={(completion, points, evidence) => {
            setHub((h) => ({ ...h, completed: completion, points, recentMissions: [completion, ...h.recentMissions], evidence: evidence ? [evidence, ...h.evidence] : h.evidence }));
            if (evidence) setPortfolioKey((k) => k + 1);
          }}
        />
        <ActionCards initial={hub.cards} month={hub.today.slice(0, 7)} />
        <OpportunityCalendar
          events={hub.events}
          today={hub.today}
          interested={hub.interested}
          intro="Open days, work experience, competitions and more from your careers adviser. Events marked with a star suit your career matches."
          onInterest={async (eventId, interested) => (await activity("interest", { eventId, interested })).ok}
        />
        <Portfolio key={portfolioKey} initial={hub.evidence} skillOptions={hub.skillOptions} thisMonth={hub.today.slice(0, 7)} />
      </div>
      <aside className="side-col" aria-label="Your progress">
        <WeeklyChart p={hub.points} />
        <section className="side-card" aria-labelledby="recent-missions">
          <div className="side-head">
            <span className="side-icon" style={{ background: "var(--tone-green)", color: "#15803d" }}>
              <Icon name="history" size={22} />
            </span>
            <div>
              <h2 id="recent-missions">Recent missions</h2>
              <p>What you&apos;ve done so far</p>
            </div>
          </div>
          {hub.recentMissions.length === 0 ? (
            <p className="muted">Your completed missions will show here.</p>
          ) : (
            <ul className="recent-missions">
              {hub.recentMissions.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <span className="pill">+{r.points}</span>
                  <span>
                    <strong>{r.title}</strong>
                    <span className="small">Completed {short(r.completedAt.slice(0, 10))}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="side-card privacy-note">
          <p className="small" style={{ margin: 0 }}>
            <Icon name="lock" size={14} /> Your portfolio, missions and events are saved to your school account. Your careers adviser can see them to help you. <Link href="/privacy">Privacy</Link>
          </p>
        </section>
      </aside>
    </main>
  );
}

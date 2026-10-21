import { levelFor } from "@/lib/progress/gamification.ts";
import { Icon } from "./Icon.tsx";

/** Progress, level, XP and streak strip shared by the Discover and results pages. */
export function StatsCard({ pct, xp, streak }: { pct: number; xp: number; streak: number }) {
  const level = levelFor(xp);
  return (
    <section className="stats-card" aria-label="Your progress">
      <div className="stat-progress">
        <span className="stat-label">Your progress</span>
        <div className="progress-row">
          <span className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Questionnaire progress">
            <span style={{ width: `${pct}%` }} />
          </span>
          <strong>{pct}%</strong>
        </div>
      </div>
      <div className="stat">
        <span className="hex-badge" aria-hidden="true">
          <Icon name="star" size={20} />
        </span>
        <span>
          <strong>{level.name}</strong>
          <span>Level {level.level}</span>
        </span>
      </div>
      <div className="stat">
        <Icon name="star" size={30} className="xp-star" />
        <span>
          <strong>{xp} XP</strong>
          <span>{level.toNext ? `${level.toNext} to next level` : "Top level"}</span>
        </span>
      </div>
      <div className="stat">
        <Icon name="flame" size={30} className="flame" />
        <span>
          <strong>
            {streak} day streak
          </strong>
          <span>{streak > 1 ? "Keep it going!" : "Come back tomorrow"}</span>
        </span>
      </div>
    </section>
  );
}

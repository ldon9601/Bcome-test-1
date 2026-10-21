import type { JourneyPeriod } from "@/lib/plan/types.ts";

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

/** The year-by-year journey as a coloured timeline. */
export function JourneyTimeline({ periods }: { periods: JourneyPeriod[] }) {
  return (
    <ol className="timeline">
      {periods.map((p, i) => (
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
  );
}

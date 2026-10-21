import { RIASEC, RIASEC_NAMES, type RiasecType } from "@/lib/questionnaire/types.ts";

export const RIASEC_COLOURS: Record<RiasecType, string> = {
  R: "var(--riasec-r)",
  I: "var(--riasec-i)",
  A: "var(--riasec-a)",
  S: "var(--riasec-s)",
  E: "var(--riasec-e)",
  C: "var(--riasec-c)",
};

/** Hexagonal RIASEC radar, axes in Holland's order. */
export function RiasecRadar({ scores, size = 200 }: { scores: Record<RiasecType, number>; size?: number }) {
  const c = size / 2;
  const r = size / 2 - 14;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v];
  };
  const ring = (v: number) => RIASEC.map((_, i) => pt(i, v).join(",")).join(" ");
  const shape = RIASEC.map((t, i) => pt(i, Math.max(0.04, scores[t] / 100)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="radar" role="img" aria-label={RIASEC.map((t) => `${RIASEC_NAMES[t]} ${scores[t]}`).join(", ")}>
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <polygon key={v} points={ring(v)} fill="none" stroke="var(--line)" strokeWidth="1" />
      ))}
      {RIASEC.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" />;
      })}
      <polygon points={shape} fill="rgba(108, 92, 231, 0.28)" stroke="#6c5ce7" strokeWidth="2" strokeLinejoin="round" />
      {RIASEC.map((t, i) => {
        const [x, y] = pt(i, Math.max(0.04, scores[t] / 100));
        return <circle key={t} cx={x} cy={y} r="3.5" fill="#6c5ce7" />;
      })}
      {RIASEC.map((t, i) => {
        const [x, y] = pt(i, 1);
        return <circle key={`o${t}`} cx={x} cy={y} r="2.5" fill="var(--ink-soft)" />;
      })}
    </svg>
  );
}

export function RiasecBars({ scores }: { scores: Record<RiasecType, number> }) {
  return (
    <ul className="riasec-bars">
      {RIASEC.map((t) => (
        <li key={t}>
          <span className="riasec-name">{RIASEC_NAMES[t]}</span>
          <span className="bar">
            <span style={{ width: `${scores[t]}%`, background: RIASEC_COLOURS[t] }} />
          </span>
          <span className="riasec-value">{scores[t]}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Circular score, e.g. "92% Match". */
export function ScoreRing({ value, label, size = 96, stroke = 9 }: { value: number; label: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${value}% ${label}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--teal)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circ} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-text">
        <strong>{value}%</strong>
        <span>{label}</span>
      </span>
    </div>
  );
}

/** Labelled horizontal bar, used for fit components. */
export function Meter({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="meter">
      <span className="meter-label">{label}</span>
      <span className="bar" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ width: `${value}%`, background: colour }} />
      </span>
      <span className="meter-value">{value}%</span>
    </div>
  );
}

"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { LabourHistory, LabourSnapshot } from "@/lib/labour.ts";
import { ANZSIC_NOTE, SKILL_LEVEL_NOTE, SKILL_LEVELS } from "@/lib/labour-terms.ts";
import { Icon } from "./Icon.tsx";

/**
 * The jobs-market drill-down for a career: skill level (with a "?" definition), ANZSCO and ANZSIC
 * codes, vacancies when the assessment was done, and history charts from JSA data.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const period = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const quarterLabel = (ym: string) => `${period(ym)} quarter`;
const n = (v: number | null | undefined) => (v == null ? "N/A" : v.toLocaleString("en-AU"));
const k = (v: number | null | undefined) => (v == null ? "N/A" : v >= 1000 ? `${(v / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 })} million` : `${Math.round(v).toLocaleString("en-AU")},000`);
const signed = (v: number | null | undefined) => (v == null ? "" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("en-AU")}%`);

/** A small "?" button that shows a definition below it. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="infotip">
      <button type="button" className="infotip-btn" aria-expanded={open} aria-controls={id} aria-label={`What is ${label}?`} onClick={() => setOpen((o) => !o)}>
        ?
      </button>
      {open && (
        <span id={id} role="note" className="infotip-body">
          {children}
          <button type="button" className="linkish" onClick={() => setOpen(false)}>
            Close
          </button>
        </span>
      )}
    </span>
  );
}

export function SkillLevelDefinitions({ current }: { current: number[] }) {
  return (
    <>
      <span className="infotip-lead">{SKILL_LEVEL_NOTE}</span>
      <ol className="skill-levels">
        {[1, 2, 3, 4, 5].map((l) => (
          <li key={l} className={current.includes(l) ? "on" : ""}>
            <strong>Skill level {l}</strong> {SKILL_LEVELS[l].definition}
          </li>
        ))}
      </ol>
    </>
  );
}

export function SkillLevelBadge({ levels, primary }: { levels: number[]; primary: number }) {
  const label = levels.length > 1 ? `Skill level ${Math.min(...levels)}–${Math.max(...levels)}` : `Skill level ${primary}`;
  return (
    <span className="code-chip skill">
      <span className="level-dots" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={levels.includes(l) ? "on" : ""} />
        ))}
      </span>
      <strong>{label}</strong>
      <span className="small">{SKILL_LEVELS[primary]?.short}</span>
      <InfoTip label="a skill level">
        <SkillLevelDefinitions current={levels} />
      </InfoTip>
    </span>
  );
}

export function CodeChips({ anzsco, anzsic, levels, primary }: { anzsco: { unitGroup: string; title: string }; anzsic: { code: string; title: string; divisionTitle: string } | null; levels: number[]; primary: number }) {
  return (
    <div className="code-chips">
      <SkillLevelBadge levels={levels} primary={primary} />
      <span className="code-chip">
        <span className="small">ANZSCO</span> <strong>{anzsco.unitGroup}</strong> <span className="small">{anzsco.title}</span>
      </span>
      {anzsic && (
        <span className="code-chip">
          <span className="small">ANZSIC</span> <strong>{anzsic.code}</strong> <span className="small">{anzsic.title}</span>
          <InfoTip label="ANZSIC">
            <span className="infotip-lead">{ANZSIC_NOTE}</span>
            <span>
              This career: <strong>{anzsic.code}</strong> {anzsic.title}, part of the <strong>{anzsic.divisionTitle}</strong> division.
            </span>
          </InfoTip>
        </span>
      )}
    </div>
  );
}

/** Responsive line chart in SVG with first, last and peak labels. */
export function LineChart({ periods, values, label, format = (v) => v.toLocaleString("en-AU"), tickEvery = 4, colour = "#6c5ce7", tickLabel = (p) => p.slice(0, 4) }: {
  periods: string[];
  values: (number | null)[];
  label: string;
  format?: (v: number) => string;
  tickEvery?: number;
  colour?: string;
  tickLabel?: (p: string) => string;
}) {
  const id = useId().replace(/:/g, "");
  const W = 380;
  const H = 150;
  const pad = { l: 8, r: 8, t: 22, b: 26 };
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return <p className="muted">Not enough data to chart.</p>;
  const max = Math.max(...pts.map((p) => p.v));
  const min = Math.min(0, ...pts.map((p) => p.v));
  const x = (i: number) => pad.l + (i / (values.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const path = pts.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(pts.at(-1)!.i).toFixed(1)} ${y(min)} L${x(pts[0].i).toFixed(1)} ${y(min)} Z`;
  const last = pts.at(-1)!;
  const peak = pts.reduce((a, b) => (b.v > a.v ? b : a));
  const ticks = periods.map((p, i) => ({ p, i })).filter(({ i }) => i % tickEvery === 0);
  return (
    <figure className="line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${format(pts[0].v)} in ${periods[pts[0].i]}, ${format(last.v)} in ${periods[last.i]}, highest ${format(peak.v)} in ${periods[peak.i]}.`}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={colour} stopOpacity="0.22" />
            <stop offset="1" stopColor={colour} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={y(min + (max - min) * f)} y2={y(min + (max - min) * f)} stroke="#e4e9f2" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#g${id})`} />
        <path d={path} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last.i)} cy={y(last.v)} r="4.5" fill={colour} />
        {peak.i !== last.i && <circle cx={x(peak.i)} cy={y(peak.v)} r="3.5" fill="#fff" stroke={colour} strokeWidth="2" />}
        <text x={Math.min(x(last.i), W - 34)} y={Math.max(14, y(last.v) - 10)} className="chart-label" textAnchor="middle">
          {format(last.v)}
        </text>
        {peak.i !== last.i && Math.abs(x(peak.i) - x(last.i)) > 64 && (
          <text x={Math.max(30, Math.min(x(peak.i), W - 30))} y={Math.max(14, y(peak.v) - 9)} className="chart-label muted" textAnchor="middle">
            {format(peak.v)}
          </text>
        )}
        {ticks.map(({ p, i }) => (
          <text key={p} x={x(i)} y={H - 8} className="chart-tick" textAnchor={i === 0 ? "start" : x(i) > W - 24 ? "end" : "middle"}>
            {tickLabel(p)}
          </text>
        ))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function ProjectionBars({ points }: { points: { year: string; employedK: number | null }[] }) {
  const max = Math.max(...points.map((p) => p.employedK ?? 0)) || 1;
  return (
    <figure className="proj-bars" aria-label={`Projected employment: ${points.map((p) => `${p.year} ${k(p.employedK)}`).join(", ")}`}>
      {points.map((p, i) => (
        <div key={p.year} className="proj-bar">
          <span className="proj-val">{k(p.employedK)}</span>
          <span className={`proj-fill${i ? " projected" : ""}`} style={{ height: `${Math.max(6, ((p.employedK ?? 0) / max) * 100)}%` }} />
          <span className="proj-year">
            {p.year}
            {i ? " (projected)" : ""}
          </span>
        </div>
      ))}
    </figure>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "up" | "down" }) {
  return (
    <div className="labour-stat">
      <span className="small">{label}</span>
      <strong className={tone ?? ""}>{value}</strong>
      {note && <span className="small">{note}</span>}
    </div>
  );
}

/**
 * Jobs market panel. `snapshot` is what the student saw when they completed the assessment;
 * without one (career browser), the latest figures are shown.
 */
export function LabourPanel({ osca, state, snapshot, title = "Jobs market" }: { osca: string; state?: string | null; snapshot?: LabourSnapshot | null; title?: string }) {
  const [data, setData] = useState<{ history: LabourHistory; latest: LabourSnapshot } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/careers/${encodeURIComponent(osca)}/labour${state ? `?state=${encodeURIComponent(state)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [osca, state]);

  const s = snapshot ?? data?.latest ?? null;
  const h = data?.history;
  const saved = !!snapshot;
  const when = s ? new Date(s.asAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "";
  const tnv = s?.vacancies.tnv;
  const ivi = s?.vacancies.ivi;

  return (
    <section className="labour" aria-label={title}>
      <h4 className="labour-title">
        <Icon name="chart" size={18} /> {title}
      </h4>
      {s && <CodeChips anzsco={s.anzsco} anzsic={s.anzsic} levels={s.skillLevel.levels} primary={s.skillLevel.primary} />}
      {s && (
        <>
          <p className="small labour-asat">
            {saved ? `Vacancies when you completed the questions (${when}), using the latest JSA data at the time.` : "The latest Jobs and Skills Australia figures."}
          </p>
          <div className="labour-stats">
            {tnv && (
              <Stat
                label={`New vacancies, ${quarterLabel(tnv.quarter)}`}
                value={tnv.estimate != null ? `about ${n(tnv.estimate)}` : n(tnv.group)}
                note={tnv.estimate != null ? `Bcome estimate for this job (${tnv.sharePct}% of ${tnv.groupTitle}, which had ${n(tnv.group)})` : tnv.groupTitle}
              />
            )}
            {tnv?.groupChange1yPct != null && <Stat label={`${tnv.groupTitle}, change on a year earlier`} value={signed(tnv.groupChange1yPct)} tone={tnv.groupChange1yPct >= 0 ? "up" : "down"} />}
            {ivi && (
              <Stat
                label={`Online job ads, ${period(ivi.month)}`}
                value={n(ivi.ads)}
                note={`Skill level ${ivi.skillLevel} jobs in ${ivi.state === "AUST" ? "Australia" : ivi.state}${ivi.change1yPct != null ? ` (${signed(ivi.change1yPct)} on a year earlier)` : ""}`}
              />
            )}
            {s.projection && (
              <Stat
                label="Projected growth to May 2035"
                value={signed(s.projection.growth10Pct)}
                note={`${k(s.projection.employed2025k)} employed in 2025`}
                tone={(s.projection.growth10Pct ?? 0) >= 0 ? "up" : "down"}
              />
            )}
            {s.anzsic && s.anzsic.employedK != null && (
              <Stat
                label={`Employed in ${s.anzsic.title}`}
                value={k(s.anzsic.employedK)}
                note={`${period(s.anzsic.reference)}${s.anzsic.change1yPct != null ? ` · ${signed(s.anzsic.change1yPct)} in a year` : ""}`}
              />
            )}
            {s.shortage?.majorGroupPct != null && (
              <Stat
                label={`${s.shortage.majorGroup} in shortage (OSL ${s.shortage.year})`}
                value={`${s.shortage.majorGroupPct}%`}
                note={s.shortage.skillLevelPct != null ? `${s.shortage.skillLevelPct}% of skill level ${s.skillLevel.primary} jobs` : undefined}
              />
            )}
          </div>
        </>
      )}
      {!h && !failed && <p className="muted">Loading the history…</p>}
      {failed && !s && <p className="muted">Jobs market figures aren&apos;t available right now.</p>}
      {h && (
        <div className="labour-charts">
          {h.tnv && (
            <LineChart
              periods={h.tnv.periods}
              values={h.tnv.values}
              label={`New vacancies each quarter: ${h.tnv.title} (Total New Vacancies)`}
              tickEvery={8}
              tickLabel={(p) => p.slice(0, 4)}
            />
          )}
          {h.ivi && (
            <LineChart
              periods={h.ivi.periods}
              values={h.ivi.values}
              label={`Online job ads each month: skill level ${h.ivi.skillLevel}, ${h.ivi.state === "AUST" ? "Australia" : h.ivi.state} (Internet Vacancy Index, trend)`}
              tickEvery={24}
              colour="#14b8a6"
            />
          )}
          {h.industry && (
            <LineChart
              periods={h.industry.years}
              values={h.industry.values}
              label={`People employed in ${h.industry.title} ('000, each February)`}
              tickEvery={5}
              colour="#3b82f6"
              format={(v) => `${Math.round(v).toLocaleString("en-AU")}k`}
            />
          )}
          {h.projection && (
            <figure className="line-chart">
              <ProjectionBars points={h.projection.points} />
              <figcaption>People employed in this occupation group, with JSA projections to 2035</figcaption>
            </figure>
          )}
        </div>
      )}
      {h && (
        <p className="source">
          Sources:{" "}
          {h.sources.map((src, i) => (
            <span key={src.url + i}>
              {i > 0 && "; "}
              <a href={src.url} target="_blank" rel="noopener noreferrer">
                {src.title}
              </a>
            </span>
          ))}
          . Vacancies are published for occupation groups; Bcome estimates this job&apos;s share from its share of the group&apos;s employment.
        </p>
      )}
    </section>
  );
}

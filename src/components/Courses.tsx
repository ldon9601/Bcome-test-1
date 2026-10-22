import { atarLabel } from "@/lib/careers/courses.ts";
import type { JsaProfile, QualificationMix, TafeOffering, UniversityOffering } from "@/lib/careers/types.ts";
import { Icon } from "./Icon.tsx";

/** University course row: provider, ATAR, prerequisites and other requirements. */
export function UniversityCourse({
  o,
  missing = [],
  gaps = [],
  sourceUrl,
  highlight,
}: {
  o: UniversityOffering;
  missing?: string[];
  gaps?: string[];
  sourceUrl?: string;
  highlight?: boolean;
}) {
  return (
    <li className={`course-row${highlight ? " in-state" : ""}`}>
      <div className="course-row-main">
        <span className="course-provider">
          {o.provider} <span className="state-chip">{o.state}</span>
          {o.campus && <span className="small"> · {o.campus}</span>}
        </span>
        <strong>{o.course}</strong>
        {o.prerequisites.length > 0 && (
          <span className="req-line">
            <span className="req-label">Prerequisites:</span>{" "}
            {o.prerequisites.map((p) => (
              <span key={p} className={`req${missing.includes(p) ? " missing" : ""}`}>
                {missing.includes(p) && <Icon name="alert" size={13} />} {p}
              </span>
            ))}
          </span>
        )}
        {o.assumedKnowledge.length > 0 && (
          <span className="req-line">
            <span className="req-label">Assumed knowledge:</span>{" "}
            {o.assumedKnowledge.map((p) => (
              <span key={p} className={`req soft${gaps.includes(p) ? " gap" : ""}`}>
                {p}
              </span>
            ))}
          </span>
        )}
        {o.recommended.length > 0 && (
          <span className="req-line small">
            <span className="req-label">Recommended:</span> {o.recommended.join(", ")}
          </span>
        )}
        {o.otherRequirements.length > 0 && <span className="req-line small">{o.otherRequirements.join(" · ")}</span>}
        {missing.length > 0 && (
          <span className="req-warning">
            You&apos;re not studying {missing.join(" or ")}. Talk to your careers adviser about subject choices or a bridging course.
          </span>
        )}
      </div>
      <div className="atar-badge" title={o.atar.kind ? atarLabel(o.atar.kind, o.atar.year) : "ATAR not collected yet"}>
        {o.atar.display ? (
          <>
            <strong>{o.atar.display}</strong>
            <span>{atarLabel(o.atar.kind, o.atar.year)}</span>
          </>
        ) : (
          <span>See course page for ATAR</span>
        )}
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="small">
            Source
          </a>
        )}
      </div>
    </li>
  );
}

export function TafeCourse({ o }: { o: TafeOffering }) {
  return (
    <li className="course-row tafe">
      <div className="course-row-main">
        <span className="course-provider">
          {o.provider} <span className="state-chip">{o.state}</span>
          {o.apprenticeship && (
            <span className="tag amber" style={{ marginLeft: 6 }}>
              <Icon name="tools" size={12} /> Apprenticeship
            </span>
          )}
        </span>
        <strong>
          {o.course} <span className="small">({o.offeredCode})</span>
        </strong>
        <ul className="req-list">
          {o.requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="atar-badge tafe">
        <span>No ATAR needed</span>
        <a href={o.url} target="_blank" rel="noopener noreferrer" className="small">
          TAFE page
        </a>
      </div>
    </li>
  );
}

const MIX: { key: keyof QualificationMix; label: string; colour: string }[] = [
  { key: "postgraduate", label: "Postgraduate", colour: "#6c5ce7" },
  { key: "bachelor", label: "Bachelor degree", colour: "#3b82f6" },
  { key: "diploma", label: "Diploma", colour: "#14b8a6" },
  { key: "certificate", label: "Certificate III/IV", colour: "#f59e0b" },
  { key: "year12", label: "Year 12", colour: "#f43f5e" },
  { key: "year11", label: "Year 11", colour: "#fb7185" },
  { key: "year10OrBelow", label: "Year 10 or below", colour: "#cbd5e1" },
];

const n = (v: number | null, f: (x: number) => string) => (v === null ? "N/A" : f(v));

/** Jobs and Skills Australia figures for the career's ANZSCO unit group. */
export function JsaProfileCard({
  unitGroup,
  title,
  occupation,
  profile,
}: {
  unitGroup: string;
  title: string;
  occupation: { code: string; title: string } | null;
  profile: JsaProfile | null | undefined;
}) {
  return (
    <section className="jsa-card" aria-label="Jobs and Skills Australia occupation profile">
      <p className="small" style={{ margin: 0 }}>
        ANZSCO {unitGroup} {title}
        {occupation && (
          <>
            {" "}
            · occupation {occupation.code} {occupation.title}
          </>
        )}
      </p>
      {profile ? (
        <>
          <dl className="jsa-stats">
            <div>
              <dt>Employed</dt>
              <dd>{n(profile.employed, (x) => x.toLocaleString("en-AU"))}</dd>
            </div>
            <div>
              <dt>Median full-time pay</dt>
              <dd>{n(profile.medianWeeklyEarnings, (x) => `$${x.toLocaleString("en-AU")}/wk`)}</dd>
            </div>
            <div>
              <dt>Past year</dt>
              <dd className={profile.annualGrowth !== null && profile.annualGrowth < 0 ? "down" : "up"}>
                {n(profile.annualGrowth, (x) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toLocaleString("en-AU")}`)}
              </dd>
            </div>
            <div>
              <dt>Median age</dt>
              <dd>{n(profile.medianAge, (x) => String(x))}</dd>
            </div>
            <div>
              <dt>Women</dt>
              <dd>{n(profile.femalePct, (x) => `${x}%`)}</dd>
            </div>
            <div>
              <dt>Part-time</dt>
              <dd>{n(profile.partTimePct, (x) => `${x}%`)}</dd>
            </div>
          </dl>
          <p className="small" style={{ margin: "0.5rem 0 0.25rem" }}>
            Highest qualification of people in this job
          </p>
          <div className="mix-bar" role="img" aria-label={MIX.map((m) => `${m.label} ${profile.qualifications[m.key]}%`).join(", ")}>
            {MIX.map((m) => (
              <span key={m.key} style={{ width: `${profile.qualifications[m.key]}%`, background: m.colour }} />
            ))}
          </div>
          <ul className="mix-legend">
            {MIX.filter((m) => profile.qualifications[m.key] >= 3).map((m) => (
              <li key={m.key}>
                <span className="dot" style={{ background: m.colour }} /> {m.label} {Math.round(profile.qualifications[m.key])}%
              </li>
            ))}
          </ul>
          <p className="source">
            Source:{" "}
            <a href={profile.url} target="_blank" rel="noopener noreferrer">
              Jobs and Skills Australia occupation profile
            </a>{" "}
            (ABS data; pay is median full-time weekly earnings before tax).
          </p>
        </>
      ) : (
        <p className="muted">No JSA profile figures yet.</p>
      )}
    </section>
  );
}

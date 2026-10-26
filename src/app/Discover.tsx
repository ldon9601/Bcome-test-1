"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RiasecBars, RiasecRadar } from "@/components/Charts.tsx";
import { Icon, type IconName } from "@/components/Icon.tsx";
import { StatsCard } from "@/components/StatsCard.tsx";
import { nextPage, progress, sectionPosition } from "@/lib/questionnaire/engine.ts";
import { scoreRiasec } from "@/lib/questionnaire/scoring.ts";
import type { AnswerValue, Answers, Question, QuestionBank, SectionId } from "@/lib/questionnaire/types.ts";
import { answeredToday, readActivity, recordAnswers, recordVisit, streakFrom, xpFor } from "@/lib/progress/gamification.ts";

const ANSWERS_KEY = "bcome:answers";
const HISTORY_KEY = "bcome:history";
const RESULT_KEY = "bcome:result";

const SECTION_ICON: Record<SectionId, IconName> = {
  about: "user",
  interests: "bulb",
  strengths: "star",
  values: "heart",
  environment: "building",
  school: "grad",
  ideas: "compass",
};

/** A career a student can name as an idea: code, title and other words to search on. */
export interface CareerOption {
  osca: string;
  title: string;
  also: string;
  /** People employed (JSA, thousands): more common careers come first in search. */
  size: number;
}

/** Icon and colour for options shown as cards. */
const OPTION_STYLE: Record<string, { icon: IconName; tone: string }> = {
  people: { icon: "users", tone: "pink" },
  ideas: { icon: "palette", tone: "purple" },
  data: { icon: "chart", tone: "green" },
  things: { icon: "wrench", tone: "blue" },
  university: { icon: "grad", tone: "blue" },
  vet: { icon: "school", tone: "green" },
  apprenticeship: { icon: "tools", tone: "amber" },
  work_learn: { icon: "briefcase", tone: "teal" },
  business: { icon: "spark", tone: "purple" },
  defence_public: { icon: "badge", tone: "slate" },
  gap_year: { icon: "map", tone: "pink" },
  unsure: { icon: "compass", tone: "slate" },
};

function load<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the questionnaire still works for this visit.
  }
}

function isComplete(q: Question, v: AnswerValue | undefined): boolean {
  if (v === undefined) return false;
  if (q.kind === "multi") return Array.isArray(v) && v.length >= (q.min ?? 1);
  if (q.kind === "careers") return Array.isArray(v) && v.length >= 1;
  if (q.kind === "rank") return Array.isArray(v) && v.length === q.options.length;
  if (q.kind === "matrix") return typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === q.rows.length * q.columns.length;
  return typeof v === "string" && v !== "";
}

export default function Discover({ bank, careers = [], account = null }: { bank: QuestionBank; careers?: CareerOption[]; account?: { role: string; firstName: string } | null }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [history, setHistory] = useState<string[][]>([]);
  const [draft, setDraft] = useState<Answers>({});
  const [status, setStatus] = useState<"answering" | "submitting" | "error">("answering");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [activity, setActivity] = useState<Record<string, number>>({});

  useEffect(() => {
    setAnswers(load(ANSWERS_KEY, {}));
    setHistory(load(HISTORY_KEY, []));
    setActivity(recordVisit());
    setLoaded(true);
  }, []);

  const page = useMemo(() => (loaded ? nextPage(bank, answers) : []), [bank, answers, loaded]);
  const { answered, estimatedTotal } = progress(bank, answers);
  const pct = Math.round((answered / Math.max(estimatedTotal, 1)) * 100);
  const section = page.length ? bank.sections.find((s) => s.id === page[0].section)! : null;
  const position = page.length ? sectionPosition(bank, answers, page) : null;
  const xp = xpFor(answered, false);
  const streak = streakFrom(activity);
  const today = answeredToday(activity);
  const riasec = scoreRiasec(bank, { ...answers, ...draft });
  const interestAnswered = Object.values(riasec.counts).some((n) => n > 0);
  const sectionLeft = section ? bank.questions.filter((q) => q.section === section.id && !isComplete(q, answers[q.id])).length : 0;
  const pageReady = page.length > 0 && page.every((q) => isComplete(q, draft[q.id] ?? answers[q.id]));

  const next = () => {
    if (!pageReady) return;
    const values = Object.fromEntries(page.map((q) => [q.id, draft[q.id] ?? answers[q.id]]));
    const nextAnswers = { ...answers, ...values };
    const nextHistory = [...history, page.map((q) => q.id)];
    setAnswers(nextAnswers);
    setHistory(nextHistory);
    setDraft({});
    setActivity(recordAnswers(page.length));
    save(ANSWERS_KEY, nextAnswers);
    save(HISTORY_KEY, nextHistory);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    const last = history.at(-1);
    if (!last) return;
    const restored = Object.fromEntries(last.map((id) => [id, answers[id]]));
    const nextAnswers = { ...answers };
    for (const id of last) delete nextAnswers[id];
    setAnswers(nextAnswers);
    setDraft(restored);
    setHistory(history.slice(0, -1));
    save(ANSWERS_KEY, nextAnswers);
    save(HISTORY_KEY, history.slice(0, -1));
  };

  // Everything answered: build the Career Profile.
  useEffect(() => {
    if (!loaded || page.length || status !== "answering") return;
    setStatus("submitting");
    fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers }) })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        save(RESULT_KEY, data);
        // The answers are now in the saved result. Clearing them stops a later visit to Discover
        // from submitting the same answers again, and lets "Retake" start fresh.
        try {
          sessionStorage.removeItem(ANSWERS_KEY);
          sessionStorage.removeItem(HISTORY_KEY);
        } catch {
          // Storage blocked: nothing to clear.
        }
        router.push("/plan");
      })
      .catch((e: Error) => {
        setError(e.message);
        setStatus("error");
      });
  }, [loaded, page.length, status, answers, router]);

  const setValue = (id: string, v: AnswerValue) => setDraft((d) => ({ ...d, [id]: v }));

  return (
    <main className="page-grid">
      <div className="main-col">
        <section className="hero">
          <div>
            <h1>
              Discover <span className="grad-text">Your Future</span>
            </h1>
            <p className="hero-sub">Answer questions about yourself to unlock personalised career matches, study pathways and real opportunities.</p>
          </div>
          <p className="hand hero-note" aria-hidden="true">
            Honest answers.
            <br />
            Brighter tomorrows.
            <Icon name="sun" size={46} strokeWidth={1.6} className="hero-sun" />
          </p>
        </section>

        <StatsCard pct={pct} xp={xp} streak={streak} />

        {account?.role === "student" ? (
          <p className="notice success">
            <Icon name="check" size={16} /> Signed in as {account.firstName}. Your results will be saved to <Link href="/account">your profile</Link>.
          </p>
        ) : account?.role === "adviser" ? (
          <p className="notice">You&apos;re signed in as a careers adviser, so results from this device won&apos;t be saved to a student profile.</p>
        ) : (
          <p className="notice">
            <Link href="/login/student">Sign in</Link> or <Link href="/signup">create a student account</Link> to save your results and see how they change over time.
          </p>
        )}

        <section className="question-card" aria-live="polite">
          {!loaded ? null : !page.length ? (
            status === "error" ? (
              <div className="done">
                <p className="error">Your Career Profile couldn&apos;t be built: {error}</p>
                <button className="button" onClick={() => setStatus("answering")}>
                  Try again
                </button>
              </div>
            ) : (
              <div className="done">
                <Icon name="trophy" size={44} className="done-icon" />
                <h2>All done! Building your Career Profile…</h2>
              </div>
            )
          ) : (
            <>
              <header className="qc-head">
                <span className="qc-icon" aria-hidden="true">
                  <Icon name={SECTION_ICON[section!.id]} size={30} />
                </span>
                <div>
                  <h2>{section!.title}</h2>
                  <p>{section!.intro}</p>
                </div>
                <span className="qc-count">
                  {position!.from === position!.to ? `Question ${position!.from}` : `Questions ${position!.from}–${position!.to}`} of {position!.total}
                </span>
              </header>

              {page.map((q, i) => (
                <QuestionBlock key={q.id} q={q} n={q.number ?? i + 1} bank={bank} careers={careers} value={draft[q.id] ?? answers[q.id]} onChange={(v) => setValue(q.id, v)} />
              ))}

              <footer className="qc-actions">
                <button className="button ghost" onClick={back} disabled={!history.length}>
                  <Icon name="arrowLeft" size={18} /> Back
                </button>
                <button className="button primary" onClick={next} disabled={!pageReady}>
                  {estimatedTotal - answered <= page.length ? "See my results" : "Next"} <Icon name="arrowRight" size={18} />
                </button>
              </footer>
            </>
          )}
        </section>
      </div>

      <aside className="side-col">
        <section className="quest-card">
          <div className="quest-body">
            <div className="quest-title">
              <Icon name="target" size={30} />
              <h2>Today&apos;s Quest</h2>
              {section && <span className="pill">{Math.max(0, (position?.from ?? 1) - 1 + 1)}/{position?.total}</span>}
            </div>
            {section ? (
              <>
                <p>
                  Finish <strong>{section.title.replace(/^Section [A-E]: /, "")}</strong>: {sectionLeft} question{sectionLeft === 1 ? "" : "s"} to go to earn{" "}
                  <strong className="xp">{sectionLeft * 10} XP</strong>
                </p>
                <span className="progress light" aria-hidden="true">
                  <span style={{ width: `${((position!.total - sectionLeft) / position!.total) * 100}%` }} />
                </span>
              </>
            ) : (
              <p>Quest complete! Your career matches are ready.</p>
            )}
          </div>
          <div className="quest-reward">
            <span className="coin" aria-hidden="true">
              <Icon name="star" size={18} />
            </span>
            <span>
              <strong>+100 XP</strong>
              <span>For finishing the whole profile</span>
            </span>
          </div>
        </section>

        <section className="side-card">
          <div className="side-head">
            <span className="side-icon" aria-hidden="true">
              <Icon name="chart" size={22} />
            </span>
            <div>
              <h2>Your RIASEC Profile</h2>
              <p>{interestAnswered ? "Your answers are shaping your profile in real time." : "Answer Section A to see your interest profile take shape."}</p>
            </div>
            <span className="pill">Live preview</span>
          </div>
          <div className="riasec-wrap">
            <RiasecRadar scores={riasec.scores} size={180} />
            <RiasecBars scores={riasec.scores} />
          </div>
        </section>

        <section className="roll-card">
          <span className="roll-icon" aria-hidden="true">
            <Icon name="star" size={26} />
          </span>
          <div>
            <h2>{today >= 5 ? "You're on a roll!" : "Nice work!"}</h2>
            <p>
              {today} question{today === 1 ? "" : "s"} answered today. {today >= 5 ? "Keep going to build your streak!" : "Every answer sharpens your matches."}
            </p>
          </div>
          <Icon name="trophy" size={56} strokeWidth={1.4} className="roll-trophy" />
        </section>
      </aside>
    </main>
  );
}

function QuestionBlock({ q, n, bank, careers, value, onChange }: { q: Question; n: number; bank: QuestionBank; careers: CareerOption[]; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void }) {
  const titleId = `q-${q.id}`;
  return (
    <div className="q-block">
      <h3 className="q-title" id={titleId}>
        <span className="q-num">{n}</span>
        {q.prompt}
      </h3>
      {q.help && <p className="muted q-help">{q.help}</p>}

      {q.kind === "likert" && (
        <div className="pills five" role="radiogroup" aria-labelledby={titleId}>
          {bank.scales[q.scaleId].map((o) => (
            <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {q.kind === "single" && (
        <div className={`pills ${q.options.length > 5 ? "wrap" : "five"}`} role="radiogroup" aria-labelledby={titleId}>
          {q.options.map((o) => (
            <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {q.kind === "multi" &&
        (q.options.every((o) => OPTION_STYLE[o.value]) ? (
          <div className="option-cards" role="group" aria-labelledby={titleId}>
            {q.options.map((o) => {
              const picked = Array.isArray(value) && value.includes(o.value);
              return (
                <button
                  key={o.value}
                  className={`option-card tone-${OPTION_STYLE[o.value].tone}`}
                  aria-pressed={picked}
                  onClick={() => onChange(toggle(Array.isArray(value) ? value : [], o.value, q.exclusive ?? [], q.max))}
                >
                  <Icon name={OPTION_STYLE[o.value].icon} size={30} />
                  <span>{o.label}</span>
                  {picked && <Icon name="check" size={18} className="tick" />}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="chips-select" role="group" aria-labelledby={titleId}>
              {q.options.map((o) => {
                const picked = Array.isArray(value) && value.includes(o.value);
                return (
                  <button key={o.value} aria-pressed={picked} onClick={() => onChange(toggle(Array.isArray(value) ? value : [], o.value, q.exclusive ?? [], q.max))}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            {q.max && (
              <p className="muted">
                {Array.isArray(value) ? value.length : 0} of {q.max} picked
              </p>
            )}
          </>
        ))}

      {q.kind === "rank" && (
        <>
          <div className="option-cards" role="group" aria-labelledby={titleId}>
            {q.options.map((o) => {
              const order = Array.isArray(value) ? value : [];
              const pos = order.indexOf(o.value);
              const style = OPTION_STYLE[o.value];
              return (
                <button
                  key={o.value}
                  className={`option-card tone-${style.tone}`}
                  aria-pressed={pos > -1}
                  aria-label={`${o.label}: ${o.detail}${pos > -1 ? `, ranked ${pos + 1}` : ""}`}
                  onClick={() => onChange(pos > -1 ? order.filter((x) => x !== o.value) : [...order, o.value])}
                >
                  {pos > -1 && <span className="rank-badge">{pos + 1}</span>}
                  <Icon name={style.icon} size={30} />
                  <strong>{o.label}</strong>
                  <span className="small">{o.detail}</span>
                </button>
              );
            })}
          </div>
          <p className="muted">
            {Array.isArray(value) && value.length === q.options.length ? "Tap one again to change its place." : `Tap your number ${(Array.isArray(value) ? value.length : 0) + 1}.`}
          </p>
        </>
      )}

      {q.kind === "bipolar" && (
        <div className="slider" role="radiogroup" aria-labelledby={titleId}>
          <div className="slider-track" aria-hidden="true" />
          {["1", "2", "3", "4", "5"].map((v, i) => {
            const label = [q.left, "", q.middle, "", q.right][i];
            return (
              <button
                key={v}
                role="radio"
                aria-checked={value === v}
                aria-label={label || (i === 1 ? `Leaning ${q.left.toLowerCase()}` : `Leaning ${q.right.toLowerCase()}`)}
                onClick={() => onChange(v)}
              >
                <span className="slider-dot" />
                <span className="slider-label">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.kind === "careers" && <CareerPicker q={q} careers={careers} value={Array.isArray(value) ? value : []} onChange={onChange} labelledBy={titleId} />}

      {q.kind === "matrix" && (
        <div className="matrix" role="group" aria-labelledby={titleId}>
          <div className="matrix-head" aria-hidden="true">
            <span />
            {q.columns.map((c) => (
              <span key={c.value}>{c.label}</span>
            ))}
          </div>
          {q.rows.map((r) => (
            <div key={r.value} className="matrix-row">
              <span className="matrix-subject">{r.label}</span>
              {q.columns.map((c) => {
                const cells = value && typeof value === "object" && !Array.isArray(value) ? value : {};
                const key = `${r.value}.${c.value}`;
                return (
                  <div key={c.value} className="matrix-scale" role="radiogroup" aria-label={`${r.label}: ${c.label}`}>
                    <span className="matrix-col">{c.label}</span>
                    {bank.scales[c.scaleId].map((o) => (
                      <button key={o.value} role="radio" aria-checked={cells[key] === o.value} aria-label={`${o.value}, ${o.label}`} title={o.label} onClick={() => onChange({ ...cells, [key]: o.value })}>
                        {o.value}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          <p className="muted">1 = not at all / not confident yet · 5 = love it / very confident</p>
        </div>
      )}
    </div>
  );
}

/** Search Bcome's careers and pick up to `max`, or choose "none in mind". */
function CareerPicker({ q, careers, value, onChange, labelledBy }: { q: Extract<Question, { kind: "careers" }>; careers: CareerOption[]; value: string[]; onChange: (v: string[]) => void; labelledBy: string }) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const none = value.includes("none");
  const picked = value.filter((v) => v !== "none");
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = words.length
    ? careers
        .filter((c) => !picked.includes(c.osca))
        .map((c) => {
          const title = c.title.toLowerCase();
          const hay = `${title} ${c.also.toLowerCase()}`;
          if (!words.every((w) => hay.includes(w))) return null;
          // A word in the title starting with what they typed comes first, then bigger careers.
          const rank = title.split(/[\s(/-]+/).some((t) => t.startsWith(words[0])) ? 0 : 1;
          return { c, rank };
        })
        .filter((x): x is { c: CareerOption; rank: number } => x !== null)
        .sort((a, b) => a.rank - b.rank || b.c.size - a.c.size || a.c.title.localeCompare(b.c.title))
        .slice(0, 8)
        .map((x) => x.c)
    : [];
  const full = picked.length >= q.max;
  const add = (osca: string) => {
    onChange([...picked, osca].slice(0, q.max));
    setText("");
    setActive(0);
  };
  const title = (osca: string) => careers.find((c) => c.osca === osca)?.title ?? osca;
  const listId = `${labelledBy}-results`;
  return (
    <div className="career-picker">
      {picked.length > 0 && (
        <ul className="picked-careers" aria-label="Careers you picked">
          {picked.map((osca) => (
            <li key={osca}>
              {title(osca)}
              <button type="button" aria-label={`Remove ${title(osca)}`} onClick={() => onChange(picked.filter((x) => x !== osca))}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="picker-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-labelledby={labelledBy}
            aria-activedescendant={results[active] ? `${listId}-${results[active].osca}` : undefined}
            placeholder={q.placeholder ?? "Search careers"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                add(results[active].osca);
              }
            }}
          />
        </div>
      )}
      {results.length > 0 && (
        <ul className="picker-results" id={listId} role="listbox">
          {results.map((c, i) => (
            <li key={c.osca} id={`${listId}-${c.osca}`} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => add(c.osca)} onMouseEnter={() => setActive(i)}>
                {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {words.length > 0 && !results.length && <p className="muted small">No careers match &ldquo;{text}&rdquo;. Try another word, like &ldquo;design&rdquo; or &ldquo;animals&rdquo;.</p>}
      <p className="muted small">
        {picked.length} of {q.max} picked
      </p>
      <div className="pills five" role="radiogroup" aria-label="Or">
        <button role="radio" aria-checked={none} onClick={() => onChange(none ? [] : ["none"])}>
          {q.noneLabel}
        </button>
      </div>
    </div>
  );
}

function toggle(list: string[], v: string, exclusive: string[], max?: number): string[] {
  if (list.includes(v)) return list.filter((x) => x !== v);
  if (exclusive.includes(v)) return [v];
  const rest = list.filter((x) => !exclusive.includes(x));
  return max && rest.length >= max ? rest : [...rest, v];
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { nextQuestion, progress } from "@/lib/questionnaire/engine.ts";
import type {
  AnswerValue,
  Answers,
  BipolarQuestion,
  ChoiceQuestion,
  MatrixQuestion,
  QuestionBank,
  RankQuestion,
} from "@/lib/questionnaire/types.ts";

const ANSWERS_KEY = "bcome:answers";
const HISTORY_KEY = "bcome:history";
export const RESULT_KEY = "bcome:result";

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
    // Private browsing can block storage; the questionnaire still works, it just won't survive a refresh.
  }
}

export default function Questionnaire({ bank }: { bank: QuestionBank }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [history, setHistory] = useState<string[]>([]);
  const [draft, setDraft] = useState<AnswerValue | undefined>(undefined);
  const [status, setStatus] = useState<"answering" | "submitting" | "error">("answering");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAnswers(load(ANSWERS_KEY, {}));
    setHistory(load(HISTORY_KEY, []));
    setLoaded(true);
  }, []);

  const question = loaded ? nextQuestion(bank, answers) : null;
  const { answered, estimatedTotal } = progress(bank, answers);
  const section = bank.sections.find((s) => s.id === question?.section);

  const answer = useCallback(
    (id: string, value: AnswerValue) => {
      const nextAnswers = { ...answers, [id]: value };
      const nextHistory = [...history, id];
      setAnswers(nextAnswers);
      setHistory(nextHistory);
      setDraft(undefined);
      save(ANSWERS_KEY, nextAnswers);
      save(HISTORY_KEY, nextHistory);
    },
    [answers, history],
  );

  const back = () => {
    const last = history.at(-1);
    if (!last) return;
    const nextAnswers = { ...answers };
    setDraft(nextAnswers[last]);
    delete nextAnswers[last];
    const nextHistory = history.slice(0, -1);
    setAnswers(nextAnswers);
    setHistory(nextHistory);
    save(ANSWERS_KEY, nextAnswers);
    save(HISTORY_KEY, nextHistory);
  };

  // Number keys 1–5 answer rating and slider questions.
  useEffect(() => {
    if (question?.kind !== "likert" && question?.kind !== "bipolar") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      if (/^[1-5]$/.test(e.key)) answer(question.id, e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, answer]);

  // All questions answered: build the profile and plan.
  useEffect(() => {
    if (!loaded || question || status !== "answering") return;
    setStatus("submitting");
    fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers }) })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        save(RESULT_KEY, data);
        router.push("/plan");
      })
      .catch((e: Error) => {
        setError(e.message);
        setStatus("error");
      });
  }, [loaded, question, status, answers, router]);

  if (!loaded) return null;

  if (!question) {
    return (
      <div aria-live="polite">
        {status === "error" ? (
          <>
            <p className="error">Your Career Profile couldn&apos;t be built: {error}</p>
            <button className="button" onClick={() => setStatus("answering")}>
              Try again
            </button>
          </>
        ) : (
          <p className="lead">Building your Career Profile…</p>
        )}
      </div>
    );
  }

  const pct = Math.round((answered / Math.max(estimatedTotal, 1)) * 100);
  const current = draft ?? answers[question.id];
  const isFirstInSection = !history.some((id) => bank.questions.find((q) => q.id === id)?.section === question.section);

  return (
    <div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      {section && (
        <>
          <p className="section-name">{section.title}</p>
          {(isFirstInSection || question.section !== "about") && <p className="muted">{section.intro}</p>}
        </>
      )}
      <h1 className="question" id="q">
        {question.number && <span className="q-number">{question.number}. </span>}
        {question.prompt}
      </h1>
      {question.help && <p className="muted">{question.help}</p>}

      {question.kind === "likert" && (
        <div className="likert" role="group" aria-labelledby="q">
          {bank.scales[question.scaleId].map((o) => (
            <button key={o.value} aria-pressed={current === o.value} onClick={() => answer(question.id, o.value)}>
              <span className="dot" aria-hidden="true" />
              {o.label}
            </button>
          ))}
        </div>
      )}

      {question.kind === "single" && (
        <div className="choices" role="group" aria-labelledby="q">
          {question.options.map((o) => (
            <button key={o.value} aria-pressed={current === o.value} onClick={() => answer(question.id, o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {question.kind === "multi" && <MultiChoice key={question.id} question={question} initial={current} onDone={(v) => answer(question.id, v)} />}
      {question.kind === "bipolar" && <Bipolar question={question} current={current} onPick={(v) => answer(question.id, v)} />}
      {question.kind === "rank" && <Rank key={question.id} question={question} initial={current} onDone={(v) => answer(question.id, v)} />}
      {question.kind === "matrix" && <Matrix key={question.id} question={question} bank={bank} initial={current} onDone={(v) => answer(question.id, v)} />}

      <div className="q-actions">
        <button className="link-button" onClick={back} disabled={!history.length}>
          Back
        </button>
        <span className="muted">
          {answered} of {estimatedTotal}
        </span>
      </div>
    </div>
  );
}

function MultiChoice({ question, initial, onDone }: { question: ChoiceQuestion; initial: AnswerValue | undefined; onDone: (v: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>(Array.isArray(initial) ? initial : []);
  const max = question.max ?? question.options.length;
  const exclusive = question.exclusive ?? [];
  const toggle = (v: string) =>
    setPicked((p) => {
      if (p.includes(v)) return p.filter((x) => x !== v);
      if (exclusive.includes(v)) return [v];
      const rest = p.filter((x) => !exclusive.includes(x));
      return rest.length < max ? [...rest, v] : rest;
    });

  return (
    <>
      <div className="choices" role="group" aria-labelledby="q">
        {question.options.map((o) => (
          <button key={o.value} aria-pressed={picked.includes(o.value)} onClick={() => toggle(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {question.max && (
        <p className="muted" aria-live="polite">
          {picked.length} of {max} picked
        </p>
      )}
      <button className="button continue" disabled={picked.length < (question.min ?? 1)} onClick={() => onDone(picked)}>
        Continue
      </button>
    </>
  );
}

function Bipolar({ question, current, onPick }: { question: BipolarQuestion; current: AnswerValue | undefined; onPick: (v: string) => void }) {
  const labels = [question.left, "", question.middle, "", question.right];
  return (
    <div className="bipolar" role="radiogroup" aria-labelledby="q">
      <div className="bipolar-ends" aria-hidden="true">
        <span>{question.left}</span>
        <span>{question.right}</span>
      </div>
      <div className="bipolar-scale">
        {["1", "2", "3", "4", "5"].map((v, i) => (
          <button
            key={v}
            role="radio"
            aria-checked={current === v}
            aria-label={labels[i] || (i === 1 ? `Leaning towards ${question.left.toLowerCase()}` : `Leaning towards ${question.right.toLowerCase()}`)}
            onClick={() => onPick(v)}
          >
            <span className="dot" aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="bipolar-middle muted" aria-hidden="true">
        {question.middle}
      </p>
    </div>
  );
}

function Rank({ question, initial, onDone }: { question: RankQuestion; initial: AnswerValue | undefined; onDone: (v: string[]) => void }) {
  const [order, setOrder] = useState<string[]>(Array.isArray(initial) ? initial : []);
  const tap = (v: string) => setOrder((o) => (o.includes(v) ? o.filter((x) => x !== v) : [...o, v]));
  const complete = order.length === question.options.length;
  return (
    <>
      <div className="rank" role="group" aria-labelledby="q">
        {question.options.map((o) => {
          const pos = order.indexOf(o.value);
          return (
            <button key={o.value} aria-pressed={pos > -1} onClick={() => tap(o.value)} aria-label={`${o.label}${pos > -1 ? `, ranked ${pos + 1}` : ""}`}>
              <span className="rank-pos" aria-hidden="true">
                {pos > -1 ? pos + 1 : ""}
              </span>
              <span>
                <strong>{o.label}</strong>
                {o.detail && <span className="muted"> {o.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="muted" aria-live="polite">
        {complete ? "Tap one again to change its place." : `Next: your number ${order.length + 1}`}
      </p>
      <button className="button continue" disabled={!complete} onClick={() => onDone(order)}>
        Continue
      </button>
    </>
  );
}

function Matrix({
  question,
  bank,
  initial,
  onDone,
}: {
  question: MatrixQuestion;
  bank: QuestionBank;
  initial: AnswerValue | undefined;
  onDone: (v: Record<string, string>) => void;
}) {
  const [cells, setCells] = useState<Record<string, string>>(initial && typeof initial === "object" && !Array.isArray(initial) ? initial : {});
  const total = question.rows.length * question.columns.length;
  const done = Object.keys(cells).length;
  return (
    <>
      <div className="matrix">
        {question.rows.map((r) => (
          <fieldset key={r.value} className="matrix-row">
            <legend>{r.label}</legend>
            {question.columns.map((c) => {
              const key = `${r.value}.${c.value}`;
              return (
                <div key={c.value} className="matrix-cell" role="radiogroup" aria-label={`${r.label}: ${c.label}`}>
                  <span className="matrix-col">{c.label}</span>
                  <div className="matrix-scale">
                    {bank.scales[c.scaleId].map((o) => (
                      <button
                        key={o.value}
                        role="radio"
                        aria-checked={cells[key] === o.value}
                        aria-label={`${o.value}: ${o.label}`}
                        title={o.label}
                        onClick={() => setCells((x) => ({ ...x, [key]: o.value }))}
                      >
                        {o.value}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>
      <p className="muted" aria-live="polite">
        1 = {bank.scales.enjoyment[0].label.toLowerCase()} / {bank.scales.confidence[0].label.toLowerCase()}, 5 = {bank.scales.enjoyment[4].label.toLowerCase()} /{" "}
        {bank.scales.confidence[4].label.toLowerCase()}. {done} of {total} answered.
      </p>
      <button className="button continue" disabled={done < total} onClick={() => onDone(cells)}>
        Continue
      </button>
    </>
  );
}

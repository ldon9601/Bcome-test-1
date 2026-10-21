"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { nextQuestion, progress } from "@/lib/questionnaire/engine.ts";
import type { Answers, ChoiceQuestion, QuestionBank } from "@/lib/questionnaire/types.ts";

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
  const [draft, setDraft] = useState<string | string[] | undefined>(undefined);
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
    (id: string, value: string | string[]) => {
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

  // Number keys 1–5 answer rating questions.
  useEffect(() => {
    if (question?.kind !== "likert") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      if (/^[1-5]$/.test(e.key)) answer(question.id, e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, answer]);

  // All questions answered: build the plan.
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
            <p className="error">Your plan couldn&apos;t be built: {error}</p>
            <button className="button" onClick={() => setStatus("answering")}>
              Try again
            </button>
          </>
        ) : (
          <p className="lead">Building your plan…</p>
        )}
      </div>
    );
  }

  const pct = Math.round((answered / Math.max(estimatedTotal, 1)) * 100);
  const current = draft ?? answers[question.id];

  return (
    <div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      {section && (
        <>
          <p className="section-name">{section.title}</p>
          <p className="muted">{section.intro}</p>
        </>
      )}
      <h1 className="question" id="q">
        {question.prompt}
      </h1>
      {question.help && <p className="muted">{question.help}</p>}

      {question.kind === "likert" && (
        <div className="likert" role="group" aria-labelledby="q">
          {bank.likertScale.map((o) => (
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

      <div className="q-actions">
        <button className="link-button" onClick={back} disabled={!history.length}>
          Back
        </button>
        <span className="muted">
          {answered} of about {estimatedTotal}
        </span>
      </div>
    </div>
  );
}

function MultiChoice({
  question,
  initial,
  onDone,
}: {
  question: ChoiceQuestion;
  initial: string | string[] | undefined;
  onDone: (v: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(Array.isArray(initial) ? initial : []);
  const max = question.max ?? question.options.length;
  const toggle = (v: string) =>
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : p.length < max ? [...p, v] : p));

  return (
    <>
      <div className="choices" role="group" aria-labelledby="q">
        {question.options.map((o) => (
          <button key={o.value} aria-pressed={picked.includes(o.value)} onClick={() => toggle(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="muted" aria-live="polite">
        {picked.length} of {max} picked
      </p>
      <button className="button" disabled={!picked.length} onClick={() => onDone(picked)}>
        Continue
      </button>
    </>
  );
}

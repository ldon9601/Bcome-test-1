import { NextResponse } from "next/server";
import { advise, resultPayload } from "@/lib/advise.ts";
import { ALGORITHM_VERSION } from "@/lib/careers/matching.ts";
import { questionBank } from "@/lib/data.ts";
import { IncompleteAnswersError } from "@/lib/questionnaire/scoring.ts";
import type { Answers } from "@/lib/questionnaire/types.ts";
import { auth, currentSession } from "@/lib/auth/server.ts";

export const runtime = "nodejs";

const MAX_ANSWERS = 200;

function parseAnswers(body: unknown): Answers | null {
  const raw = (body as { answers?: unknown })?.answers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const known = new Set(questionBank.questions.map((q) => q.id));
  const short = (x: unknown): x is string => typeof x === "string" && x.length < 64;
  const out: Answers = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_ANSWERS) return null;
  for (const [id, v] of entries) {
    if (!known.has(id)) continue;
    if (short(v)) out[id] = v;
    else if (Array.isArray(v) && v.length <= 10 && v.every(short)) out[id] = v;
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      const cells = Object.entries(v as Record<string, unknown>);
      if (cells.length <= 40 && cells.every(([k, x]) => k.length < 64 && short(x))) out[id] = Object.fromEntries(cells) as Record<string, string>;
    }
  }
  return out;
}

/**
 * POST { answers } → { profile, matches, plan, saved }
 * Anyone can try the questionnaire. Results are stored on the account of a signed-in student.
 */
export async function POST(request: Request) {
  const answers = parseAnswers(await request.json().catch(() => null));
  if (!answers) return NextResponse.json({ error: "Send { answers: { questionId: value } }" }, { status: 400 });

  // A school decides whether its students' plans may be written by AI (ST4S AI controls).
  const cur = await currentSession();
  const aiAllowed = cur ? cur.school.allowAiPlans : process.env.GUEST_AI_PLANS !== "off";

  let result;
  try {
    result = await advise(answers, {
      apiKey: (aiAllowed && process.env.ANTHROPIC_API_KEY) || undefined,
      model: process.env.ANTHROPIC_MODEL || undefined,
    });
  } catch (e) {
    if (e instanceof IncompleteAnswersError) {
      return NextResponse.json({ error: "Some questions are unanswered", missing: e.missing }, { status: 422 });
    }
    throw e;
  }

  const payload = resultPayload(result);
  const matches = payload.matches;

  // Signed-in students keep every completed assessment on their account.
  let saved = false;
  let assessmentId: string | null = null;
  if (cur?.user.role === "student") {
    const top = matches[0];
    const r = await (await auth()).store.saveAssessment({
      userId: cur.user.id,
      schoolId: cur.school.id,
      completedAt: new Date().toISOString(),
      instrumentVersion: result.profile.instrumentVersion,
      algorithmVersion: ALGORITHM_VERSION,
      yearLevel: result.profile.yearLevel,
      hollandCode: result.profile.riasec.code,
      topOsca: top?.osca ?? null,
      topTitle: top?.title ?? null,
      answers,
      profile: result.profile,
      dna: payload.dna,
      matches,
      plan: result.plan,
    });
    assessmentId = r.id;
    saved = true;
    if (result.profile.yearLevel !== cur.user.yearLevel) await (await auth()).store.updateUser(cur.user.id, { yearLevel: result.profile.yearLevel });
  }

  return NextResponse.json({ ...payload, saved, assessmentId });
}

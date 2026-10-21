import { NextResponse } from "next/server";
import { advise } from "@/lib/advise.ts";
import { toMatchSummary } from "@/lib/careers/matching.ts";
import { questionBank } from "@/lib/data.ts";
import { IncompleteAnswersError } from "@/lib/questionnaire/scoring.ts";
import type { Answers } from "@/lib/questionnaire/types.ts";
import { createAdminClient, createClient, supabaseConfigured } from "@/lib/supabase/server.ts";

export const runtime = "nodejs";

const MAX_ANSWERS = 200;

function parseAnswers(body: unknown): Answers | null {
  const raw = (body as { answers?: unknown })?.answers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const known = new Set(questionBank.questions.map((q) => q.id));
  const out: Answers = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_ANSWERS) return null;
  for (const [id, v] of entries) {
    if (!known.has(id)) continue;
    if (typeof v === "string" && v.length < 64) out[id] = v;
    else if (Array.isArray(v) && v.length <= 10 && v.every((x) => typeof x === "string" && x.length < 64)) out[id] = v;
  }
  return out;
}

/**
 * POST { answers } → { profile, matches, plan, saved }
 * Anyone can try the questionnaire. Results are only stored for signed-in students.
 */
export async function POST(request: Request) {
  const answers = parseAnswers(await request.json().catch(() => null));
  if (!answers) return NextResponse.json({ error: "Send { answers: { questionId: value } }" }, { status: 400 });

  let result;
  try {
    result = await advise(answers, {
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
      model: process.env.ANTHROPIC_MODEL || undefined,
    });
  } catch (e) {
    if (e instanceof IncompleteAnswersError) {
      return NextResponse.json({ error: "Some questions are unanswered", missing: e.missing }, { status: 422 });
    }
    throw e;
  }

  const matches = result.matches.map(toMatchSummary);

  let saved = false;
  if (supabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const admin = createAdminClient();
      const { data: session } = await admin
        .from("questionnaire_sessions")
        .insert({
          student_id: data.user.id,
          bank_id: questionBank.id,
          bank_version: questionBank.version,
          answers,
          status: "complete",
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (session) {
        const { data: res } = await admin
          .from("results")
          .insert({ session_id: session.id, student_id: data.user.id, holland_code: result.profile.riasec.code, profile: result.profile, matches })
          .select("id")
          .single();
        if (res) {
          const { error } = await admin.from("plans").insert({
            result_id: res.id,
            student_id: data.user.id,
            plan: result.plan,
            generated_by: result.plan.meta.generatedBy,
            model: result.plan.meta.model ?? null,
            data_source: result.plan.meta.dataSource,
          });
          saved = !error;
        }
      }
    }
  }

  return NextResponse.json({ profile: result.profile, matches, plan: result.plan, saved });
}

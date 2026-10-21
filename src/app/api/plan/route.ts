import { NextResponse } from "next/server";
import { advise, resultPayload } from "@/lib/advise.ts";
import { ALGORITHM_VERSION } from "@/lib/careers/matching.ts";
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

  const payload = resultPayload(result);
  const matches = payload.matches;

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
          .insert({
            session_id: session.id,
            student_id: data.user.id,
            holland_code: result.profile.riasec.code,
            profile: result.profile,
            dna: payload.dna,
            matches,
            instrument_version: result.profile.instrumentVersion,
            algorithm_version: ALGORITHM_VERSION,
          })
          .select("id")
          .single();
        if (res) {
          await admin.from("match_results").insert(
            matches.map((m, i) => ({
              result_id: res.id,
              student_id: data.user!.id,
              osca: m.osca,
              group: m.group,
              rank: i + 1,
              personal_fit: m.scores.personalFit.score,
              future_opportunity: m.scores.futureOpportunity.score,
              pathway_feasibility: m.scores.pathwayFeasibility.score,
              match_score: m.score,
              confidence: m.confidence.level,
            })),
          );
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

  return NextResponse.json({ ...payload, saved });
}

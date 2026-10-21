import type { PlanContext } from "./context.ts";
import { templatePlan } from "./template.ts";
import { validatePlanBody, type CareerPlan } from "./types.ts";

/**
 * Writes a student's career plan.
 *
 * With an Anthropic API key, Claude writes the plan from the plan context only (the
 * matched careers, their pathways and JSA-based outlooks). The response is checked
 * against the plan schema and must only name careers we supplied; anything else falls
 * back to the deterministic template, so a student always gets a plan.
 *
 * To move to AWS Bedrock (Sydney) later, replace `callAnthropic` with a Bedrock call;
 * the prompt and validation stay the same.
 */

export const SYSTEM_PROMPT = `You are a careers adviser for Australian secondary students in Years 10 to 12 (aged about 15 to 18).
You write a personal career plan from the data you are given.

Rules:
- Use ONLY the careers, pathways, subjects, skills and labour-market figures in the data. Never invent statistics, salaries, course names, ATARs or institutions.
- When an outlook is marked isEstimate, say it is an estimate. The 15-year view is indicative, never a forecast.
- Use Australian terms and spelling (TAFE, VET, ATAR, Year 11, apprenticeship, organise, program).
- Write for a teenager: plain, warm and encouraging, short sentences, no jargon. Address the student as "you".
- Never promise outcomes. Remind them to check entry requirements with the admissions centre or provider.
- Keep the plan realistic for their year level, state, study preference and willingness to move.
- If their interests are flat (profileIsFlat), encourage exploring before deciding.

Reply with a single JSON object and nothing else, in exactly this shape:
{
  "summary": "2–3 sentences",
  "hollandCode": "the student's code",
  "topCareers": [{ "occupationId": "id from topCareers", "title": "...", "whyItFits": "1–2 sentences", "outlook": "1 sentence", "howToGetThere": "1–2 sentences" }],
  "stages": [
    { "id": "school", "title": "...", "timeframe": "...", "actions": ["3–5 specific actions"] },
    { "id": "post-school", "title": "...", "timeframe": "...", "actions": ["3–5 actions"] },
    { "id": "early-career", "title": "...", "timeframe": "...", "actions": ["3–4 actions"] }
  ],
  "futureOfWork": ["2–4 sentences on how these careers are likely to change over 5–15 years"],
  "alternatives": [{ "title": "title from alternativeCareers", "why": "1 sentence" }],
  "nextSteps": ["3 things to do this school term"],
  "caveats": ["1–3 honest cautions from the data"]
}`;

export interface GenerateOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(body.slice(start, end + 1));
}

async function callAnthropic(ctx: PlanContext, apiKey: string, model: string, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Write the career plan for this student.\n\n${JSON.stringify(ctx, null, 2)}` }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Empty response from Anthropic API");
  return text;
}

export async function generatePlan(ctx: PlanContext, options: GenerateOptions = {}): Promise<CareerPlan> {
  const now = options.now ?? (() => new Date().toISOString());
  const { apiKey, model = DEFAULT_MODEL, fetchImpl = fetch } = options;
  if (!apiKey) return templatePlan(ctx, now());

  try {
    const raw = extractJson(await callAnthropic(ctx, apiKey, model, fetchImpl));
    const allowed = new Set(ctx.topCareers.map((c) => c.occupationId));
    const errors = validatePlanBody(raw, allowed);
    if (errors.length) throw new Error(`Plan failed validation: ${errors.join("; ")}`);

    const plan = raw as Omit<CareerPlan, "meta">;
    // Alternatives may only name careers we supplied.
    const altTitles = new Set(ctx.alternativeCareers.map((c) => c.title));
    return {
      ...plan,
      hollandCode: ctx.student.hollandCode,
      alternatives: plan.alternatives.filter((a) => altTitles.has(a.title)),
      caveats: Array.isArray(plan.caveats) ? plan.caveats : [],
      meta: { generatedBy: "claude", model, generatedAt: now(), dataSource: ctx.labourMarket.source },
    };
  } catch (e) {
    const plan = templatePlan(ctx, now());
    plan.meta.fallbackReason = e instanceof Error ? e.message : String(e);
    return plan;
  }
}

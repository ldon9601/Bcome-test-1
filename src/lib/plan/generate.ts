import type { PlanContext } from "./context.ts";
import { buildJourney } from "./journey.ts";
import { attachFacts, templatePlan } from "./template.ts";
import { validatePlanBody, type CareerPlan, type PlanCareer } from "./types.ts";

/**
 * Writes a student's career plan.
 *
 * Rules + structured data decide the recommendations; the AI only explains them and turns the
 * journey skeleton into personal prose. With an Anthropic API key, Claude writes from the plan
 * context only. The response is validated (shape, only careers and journey periods we supplied,
 * no "unsuitable" language). Anything else falls back to the deterministic template, so a student
 * always gets a plan. Scores, salaries, durations and evidence are attached from our data afterwards.
 *
 * To move to another provider (e.g. Azure OpenAI in Australia East, as the requirements suggest),
 * replace `callModel`; the prompt and validation stay the same.
 */

export const SYSTEM_PROMPT = `You are a careers adviser for Australian secondary students in Years 10 to 12 (aged about 15 to 18).
Bcome's rules engine has already chosen and scored the careers. You explain them and write the student's career journey.

You CAN: explain the recommendations, summarise career information, personalise development suggestions, write the Career Journey prose and compare the options.
You CANNOT: assign or change scores, invent statistics, salaries, course prerequisites, ATARs or institutions, add or drop careers, or tell a student they are unsuitable for a career. A gap is always "here's what you'd need to build", never "you can't".

Rules:
- Personal fit comes first. Lead every career explanation with why it fits the student (use its strengths), then mention opportunity and pathway as trade-offs.
- Use only the data given. Outlooks marked isEstimate are estimates; the 15-year view is indicative, never a forecast. JSA's projections exclude generative AI, which is scored separately.
- Keep the careers in the order given. Keep the journey's period ids, order and the facts in each action; you may reword actions to make them personal and specific.
- Use Australian terms and spelling (TAFE, VET, ATAR, Year 11, apprenticeship, organise, program).
- Write for a teenager: plain, warm and encouraging, short sentences. Address the student as "you".
- If profileIsFlat, encourage exploring before deciding.

Reply with a single JSON object and nothing else, in exactly this shape:
{
  "summary": "2–3 sentences",
  "hollandCode": "the student's code",
  "dnaSummary": "2 sentences reading their Career DNA (what energises them, how they like to work, what they value)",
  "careers": [{ "occupationId": "id from careers, same order", "title": "...", "whyItFits": "1–2 sentences, fit first", "outlook": "1 sentence", "howToGetThere": "1–2 sentences" }],
  "journey": { "occupationId": "...", "title": "...", "periods": [{ "id": "same ids as the skeleton", "period": "...", "focus": "...", "actions": [{ "type": "same type", "text": "..." }] }] },
  "futureOfWork": ["2–4 sentences"],
  "skillsBridge": ["up to 5 skill names from the careers' facts worth building whichever career they choose"],
  "nextSteps": ["3–4 things to do this term"],
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

async function callModel(input: unknown, apiKey: string, model: string, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Write the career plan for this student.\n\n${JSON.stringify(input, null, 2)}` }],
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

  const skeleton = buildJourney(ctx);
  try {
    // Only the recommended careers' details go to the model, never the whole occupation dataset.
    const raw = extractJson(await callModel({ ...ctx, journeySkeleton: skeleton }, apiKey, model, fetchImpl));
    const errors = validatePlanBody(raw, new Set(ctx.careers.map((c) => c.occupationId)), skeleton.periods.map((p) => p.id));
    if (errors.length) throw new Error(`Plan failed validation: ${errors.join("; ")}`);

    const plan = raw as Omit<CareerPlan, "meta">;
    const knownSkills = new Set(ctx.careers.flatMap((c) => [...c.facts.skills, ...c.facts.coreCompetencies]));
    // Careers stay in the engine's order (personal fit first), whatever order the model used.
    const written = new Map(plan.careers.map((c) => [c.occupationId, c]));
    const careers: PlanCareer[] = ctx.careers.filter((c) => written.has(c.occupationId)).map((c) => attachFacts(written.get(c.occupationId)!, c));
    return {
      ...plan,
      careers,
      journey: { ...plan.journey, occupationId: skeleton.occupationId, title: skeleton.title },
      skillsBridge: Array.isArray(plan.skillsBridge) ? plan.skillsBridge.filter((sk) => knownSkills.has(sk)).slice(0, 5) : [],
      hollandCode: ctx.student.hollandCode,
      caveats: Array.isArray(plan.caveats) ? plan.caveats : [],
      meta: { generatedBy: "claude", model, generatedAt: now(), dataSource: ctx.labourMarket.source, instrumentVersion: ctx.instrumentVersion },
    };
  } catch (e) {
    const plan = templatePlan(ctx, now());
    plan.meta.fallbackReason = e instanceof Error ? e.message : String(e);
    return plan;
  }
}

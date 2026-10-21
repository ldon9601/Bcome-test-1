import { adviserAction } from "@/lib/auth/api.ts";
import { handle } from "@/lib/auth/route.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return handle(request, (body, ctx) => adviserAction(action, body, ctx));
}

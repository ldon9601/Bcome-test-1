import { activityAction } from "@/lib/activity/api.ts";
import { handle } from "@/lib/auth/route.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return handle(request, (body, ctx) => activityAction(action, body, ctx));
}

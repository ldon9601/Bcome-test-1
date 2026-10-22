import { NextResponse } from "next/server";
import { jsaOutlook, occupationData } from "@/lib/data.ts";
import { labourHistory, labourSnapshot } from "@/lib/labour.ts";

export const runtime = "nodejs";

const STATES = new Set(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);

/**
 * GET /api/careers/{osca}/labour?state=NSW
 * Public labour market figures for a career: the latest snapshot and the history series for the
 * drill-down charts. No student data is involved, so responses can be cached.
 */
export async function GET(request: Request, { params }: { params: Promise<{ osca: string }> }) {
  const { osca } = await params;
  const occ = occupationData.occupations.find((o) => o.osca === osca);
  if (!occ) return NextResponse.json({ error: "Unknown career" }, { status: 404 });
  const state = new URL(request.url).searchParams.get("state") ?? "";
  const st = STATES.has(state) ? state : "AUST";
  return NextResponse.json(
    { history: labourHistory(occ, st, jsaOutlook), latest: labourSnapshot(occ, st, new Date(), jsaOutlook) },
    { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}

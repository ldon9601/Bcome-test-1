import { ActivityService } from "@/lib/activity/service.ts";
import { auth, currentSession } from "@/lib/auth/server.ts";
import { jsaOutlook, occupationData, questionBank } from "@/lib/data.ts";
import Discover from "./Discover.tsx";
import DiscoverHub from "./DiscoverHub.tsx";

export const dynamic = "force-dynamic";

/**
 * Discover: the Career Profile questions, or, for a signed-in student who already has results,
 * their hub (weekly mission, action cards, opportunity calendar and portfolio). ?retake=1 shows the
 * questions again.
 */
export default async function Home({ searchParams }: { searchParams?: Promise<{ retake?: string }> }) {
  const { retake } = (await searchParams) ?? {};
  const cur = await currentSession();
  if (cur?.user.role === "student" && !retake) {
    const service = await auth();
    const [latest] = await service.store.listAssessments(cur.user.id);
    if (latest) {
      const hub = await new ActivityService(service.store, service.now).hub(cur);
      return <DiscoverHub initial={hub} latestAssessmentId={latest.id} />;
    }
  }
  // Careers a student can name as an idea (Section F), with the ANZSCO title as extra search words.
  const careers = occupationData.occupations
    .map((o) => ({ osca: o.osca, title: o.title, also: `${o.anzscoTitle} ${o.anzscoOccupation ?? ""}`, size: jsaOutlook.occupations[o.anzsco]?.employed2025k ?? 0 }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return <Discover bank={questionBank} careers={careers} account={cur ? { role: cur.user.role, firstName: cur.user.firstName } : null} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { ActivityService } from "@/lib/activity/service.ts";
import { auth, requireAdviser } from "@/lib/auth/server.ts";
import EventsManager from "./EventsManager.tsx";

export const metadata: Metadata = { title: "Opportunity calendar | Bcome" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const cur = await requireAdviser("/adviser/events");
  const service = await auth();
  const { today, events } = await new ActivityService(service.store, service.now).schoolEvents(cur);
  return (
    <main className="page-grid">
      <div className="main-col">
        <p className="crumbs">
          <Link href="/adviser">← School dashboard</Link>
        </p>
        <section className="hero">
          <div>
            <h1>
              Opportunity <span className="grad-text">calendar</span>
            </h1>
            <p className="hero-sub">
              Add open days, work experience, competitions and more for {cur.school.name}. Students see them on their Discover tab and profile, as action cards when they suit their career matches, and can mark the ones they&apos;re interested in.
            </p>
          </div>
        </section>
        <EventsManager initial={events} today={today} />
      </div>
    </main>
  );
}

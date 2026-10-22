import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon.tsx";
import { EVENT_LABELS } from "@/lib/auth/event-labels.ts";
import { auth, requireAdviser } from "@/lib/auth/server.ts";
import { AdviserList, AiToggle, DomainsForm, InviteForm, JoinCodeForm, SignOutButton } from "./SettingsForms.tsx";

export const metadata: Metadata = { title: "School settings | Bcome" };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });


export default async function SettingsPage() {
  const cur = await requireAdviser("/adviser/settings");
  const store = (await auth()).store;
  const [advisers, invites, audit, students] = await Promise.all([
    store.listUsers(cur.school.id, "adviser"),
    store.listInvites(cur.school.id),
    store.listAudit(cur.school.id, 100),
    store.listUsers(cur.school.id, "student"),
  ]);
  const names = new Map([...advisers, ...students].map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  const now = Date.now();
  return (
    <main className="page-grid">
      <div className="main-col">
        <p className="crumbs">
          <Link href="/adviser">← School dashboard</Link>
        </p>
        <section className="hero">
          <div>
            <h1>
              School <span className="grad-text">settings</span>
            </h1>
            <p className="hero-sub">
              {cur.school.name} · {cur.school.state} · <span className="pill">{cur.school.status}</span>
            </p>
          </div>
        </section>

        <section className="side-card" id="code" aria-labelledby="code-h">
          <h2 id="code-h">Student sign-up</h2>
          <JoinCodeForm joinCode={cur.school.joinCode} />
          <DomainsForm domains={cur.school.studentDomains} />
        </section>

        <section className="side-card" aria-labelledby="ai-h">
          <h2 id="ai-h">AI-written plans</h2>
          <p className="muted">
            When this is on, Claude (Anthropic) words each student&apos;s plan. We send only scores and matched careers, never names, emails or the school
            name. It is processed outside Australia; under Anthropic&apos;s commercial terms, it isn&apos;t used to train models. When it&apos;s off, Bcome&apos;s templates write the
            plan, with the same careers and scores.
          </p>
          <AiToggle on={cur.school.allowAiPlans} />
        </section>

        <section className="side-card" aria-labelledby="advisers-h">
          <h2 id="advisers-h">Careers advisers</h2>
          <AdviserList
            me={cur.user.id}
            advisers={advisers.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}`, email: a.email, lastLoginAt: a.lastLoginAt }))}
            invites={invites
              .filter((i) => !i.acceptedAt && Date.parse(i.expiresAt) > now)
              .map((i) => ({ id: i.id, email: i.email, expiresAt: i.expiresAt }))}
          />
          <InviteForm />
        </section>

        <section className="side-card" aria-labelledby="audit-h">
          <h2 id="audit-h">Activity log</h2>
          <p className="small">The latest 100 sign-ins and changes at your school. Bcome keeps this log for about 13 months; ask us for a full copy.</p>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">What</th>
                  <th scope="col">Who</th>
                  <th scope="col">Network</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id}>
                    <td>{when(e.at)}</td>
                    <td>{EVENT_LABELS[e.event] ?? e.event}</td>
                    <td>{(e.actorId && names.get(e.actorId)) ?? (e.targetId && names.get(e.targetId)) ?? (e.actorId || e.targetId ? "Deleted account" : "—")}</td>
                    <td>{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside className="side-col">
        <section className="side-card">
          <div className="side-head">
            <span className="side-icon">
              <Icon name="user" size={22} />
            </span>
            <div>
              <h2>
                {cur.user.firstName} {cur.user.lastName}
              </h2>
              <p>
                {cur.user.username} · {cur.user.email}
              </p>
            </div>
          </div>
          <p className="small">
            <Icon name="shield" size={14} /> You&apos;ll be signed out after 15 minutes without activity.
          </p>
          <SignOutButton />
        </section>
      </aside>
    </main>
  );
}

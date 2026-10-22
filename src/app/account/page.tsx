import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon.tsx";
import { OccupationArt } from "@/components/OccupationArt.tsx";
import { StudentCalendar } from "@/components/StudentCalendar.tsx";
import { ActivityService } from "@/lib/activity/service.ts";
import { auth, requireStudent } from "@/lib/auth/server.ts";
import type { CareerFamily } from "@/lib/careers/types.ts";
import { AccountSecurity, DeleteAccount, YearLevelForm } from "./AccountForms.tsx";

export const metadata: Metadata = { title: "My profile | Bcome" };
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

interface SavedMatch {
  osca: string;
  title: string;
  family: CareerFamily;
  scores: { personalFit: { score: number } };
}

export default async function AccountPage() {
  const cur = await requireStudent("/account");
  const service = await auth();
  const store = service.store;
  const [assessments, devices] = await Promise.all([store.listAssessments(cur.user.id), store.listDevices(cur.user.id)]);
  const hub = await new ActivityService(store, service.now).hub(cur);
  const u = cur.user;
  return (
    <main className="page-grid">
      <div className="main-col">
        <section className="hero">
          <div>
            <h1>
              Hi <span className="grad-text">{u.firstName}</span>
            </h1>
            <p className="hero-sub">Your profile and every Career Profile you&apos;ve completed.</p>
          </div>
        </section>

        <section className="side-card" aria-labelledby="history">
          <div className="group-head">
            <h2 id="history">
              <Icon name="history" size={22} /> Your assessments
            </h2>
            <Link href="/" className="button primary">
              {assessments.length ? "Take it again" : "Start the questions"} <Icon name="arrowRight" size={18} />
            </Link>
          </div>
          {assessments.length === 0 ? (
            <p className="muted">You haven&apos;t completed the Career Profile yet. It takes about 15 minutes, and your results will be saved here.</p>
          ) : (
            <>
              <p className="muted">Interests change a lot through school. Doing it again every six months shows how your matches are shifting.</p>
              <ol className="history-list">
                {assessments.map((a, i) => {
                  const top = (a.matches as SavedMatch[]).slice(0, 3);
                  return (
                    <li key={a.id} className="history-item">
                      <div className="history-art">{top[0] && <OccupationArt family={top[0].family} />}</div>
                      <div>
                        <p className="small">
                          {fmt(a.completedAt)}
                          {a.yearLevel ? ` · Year ${a.yearLevel}` : ""}
                          {i === 0 ? " · Latest" : ""}
                        </p>
                        <h3>{a.topTitle ?? "Career Profile"}</h3>
                        <p className="muted" style={{ margin: 0 }}>
                          Holland code <strong>{a.hollandCode}</strong> · {top.map((m) => `${m.title} (${m.scores.personalFit.score}%)`).join(", ")}
                        </p>
                      </div>
                      <Link href={`/account/assessments/${a.id}`} className="button outline" style={{ width: "auto" }}>
                        View results
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>

        <StudentCalendar events={hub.events} today={hub.today} interested={hub.interested} />

        <AccountSecurity devices={devices.map((d) => ({ id: d.id, label: d.label, lastUsedAt: d.lastUsedAt }))} />
        <DeleteAccount />
      </div>

      <aside className="side-col" aria-label="Your details">
        <section className="side-card" aria-labelledby="progress-head">
          <div className="side-head">
            <span className="side-icon" style={{ background: "var(--tone-amber)", color: "#b45309" }}>
              <Icon name="trophy" size={22} />
            </span>
            <div>
              <h2 id="progress-head">Missions and portfolio</h2>
              <p>Your weekly missions and evidence</p>
            </div>
          </div>
          <dl className="kv details">
            <dt>Mission points</dt>
            <dd>{hub.points.total.toLocaleString("en-AU")}</dd>
            <dt>This week</dt>
            <dd>{hub.completed ? `Done (+${hub.completed.points})` : hub.mission ? "Mission waiting" : "—"}</dd>
            <dt>Streak</dt>
            <dd>
              {hub.points.streak} week{hub.points.streak === 1 ? "" : "s"}
            </dd>
            <dt>Portfolio</dt>
            <dd>
              {hub.evidence.length} entr{hub.evidence.length === 1 ? "y" : "ies"}
            </dd>
          </dl>
          <div className="button-row">
            <Link href="/" className="button primary small-btn">
              Go to Discover
            </Link>
            {hub.evidence.length > 0 && (
              <Link href="/account/cv" className="button secondary small-btn">
                <Icon name="download" size={16} /> Make my CV
              </Link>
            )}
          </div>
        </section>
        <section className="side-card">
          <div className="side-head">
            <span className="side-icon">
              <Icon name="user" size={22} />
            </span>
            <div>
              <h2>Your details</h2>
              <p>What Bcome keeps about you</p>
            </div>
          </div>
          <dl className="kv details">
            <dt>Name</dt>
            <dd>
              {u.firstName} {u.lastName}
            </dd>
            <dt>Username</dt>
            <dd>{u.username}</dd>
            <dt>School email</dt>
            <dd>{u.email}</dd>
            <dt>School</dt>
            <dd>{cur.school.name}</dd>
            <dt>Born</dt>
            <dd>{u.birthMonth && u.birthYear ? `${MONTHS[u.birthMonth - 1]} ${u.birthYear}` : "—"}</dd>
          </dl>
          <YearLevelForm current={u.yearLevel ?? 10} />
          <p className="small">
            To fix your name or email, ask your careers adviser. <Link href="/privacy">How we use your information</Link>
          </p>
        </section>
      </aside>
    </main>
  );
}

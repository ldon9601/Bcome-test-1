import { currentSession } from "@/lib/auth/server.ts";
import { questionBank } from "@/lib/data.ts";
import Discover from "./Discover.tsx";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cur = await currentSession();
  return <Discover bank={questionBank} account={cur ? { role: cur.user.role, firstName: cur.user.firstName } : null} />;
}

import type { Metadata } from "next";
import PlanView from "./PlanView.tsx";

export const metadata: Metadata = { title: "Your plan | Bcome" };

export default function PlanPage() {
  return (
    <main className="page">
      <PlanView />
    </main>
  );
}

import type { Metadata } from "next";
import PlanView from "./PlanView.tsx";

export const metadata: Metadata = { title: "Your Career Matches | Bcome" };

export default function PlanPage() {
  return <PlanView />;
}

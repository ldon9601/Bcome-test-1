import type { Metadata } from "next";
import JourneyView from "./JourneyView.tsx";

export const metadata: Metadata = { title: "Your Journey | Bcome" };

export default function JourneyPage() {
  return <JourneyView />;
}

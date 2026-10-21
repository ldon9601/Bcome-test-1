import type { Metadata } from "next";
import { questionBank } from "@/lib/data.ts";
import Questionnaire from "./Questionnaire.tsx";

export const metadata: Metadata = { title: "Questions | Bcome" };

export default function QuestionnairePage() {
  return (
    <main className="page">
      <Questionnaire bank={questionBank} />
    </main>
  );
}

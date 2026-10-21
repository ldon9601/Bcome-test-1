import { redirect } from "next/navigation";

/** The questionnaire now lives on the Discover (home) page. */
export default function QuestionnairePage() {
  redirect("/");
}

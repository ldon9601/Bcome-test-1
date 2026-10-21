import { questionBank } from "../data.ts";
import type { Labels } from "./analytics.ts";

const options = (id: string) =>
  Object.fromEntries(((questionBank.questions.find((q) => q.id === id) as { options?: { value: string; label: string }[] })?.options ?? []).map((o) => [o.value, o.label]));
const rows = (id: string) =>
  Object.fromEntries(((questionBank.questions.find((q) => q.id === id) as { rows?: { value: string; label: string }[] })?.rows ?? []).map((o) => [o.value, o.label]));

/** Labels for the dashboard, taken from the question bank so wording stays in one place. */
export const DASHBOARD_LABELS: Labels = {
  educationPaths: options("q35"),
  studyTolerance: options("q36"),
  subjects: rows("q34"),
};

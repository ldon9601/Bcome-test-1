import bankJson from "../../data/questions/riasec-au.json" with { type: "json" };
import occupationsJson from "../../data/occupations/occupations.json" with { type: "json" };
import jsaJson from "../../data/outlook/jsa-2025.json" with { type: "json" };
import type { OccupationData, JsaOutlookData } from "./careers/types.ts";
import type { ChoiceQuestion, QuestionBank } from "./questionnaire/types.ts";

/** Editable content lives in /data as JSON so careers experts can change it without touching code. */
export const questionBank = bankJson as unknown as QuestionBank;
export const occupationData = occupationsJson as unknown as OccupationData;
export const jsaOutlook = jsaJson as unknown as JsaOutlookData;

export const subjectLabels: Record<string, string> = Object.fromEntries(
  (questionBank.questions.find((q) => q.id === "subjects_enjoyed") as ChoiceQuestion).options.map((o) => [
    o.value,
    o.label,
  ]),
);

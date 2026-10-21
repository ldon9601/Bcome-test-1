import bankJson from "../../data/questions/riasec-au.json" with { type: "json" };
import occupationsJson from "../../data/occupations/occupations.json" with { type: "json" };
import jsaJson from "../../data/outlook/jsa-2025.json" with { type: "json" };
import earningsJson from "../../data/outlook/earnings.json" with { type: "json" };
import skillsJson from "../../data/skills/skills.json" with { type: "json" };
import qualificationsJson from "../../data/skills/qualifications.json" with { type: "json" };
import { SkillsGraph } from "./careers/skills.ts";
import type { EarningsData, JsaOutlookData, OccupationData, QualificationData, SkillsData } from "./careers/types.ts";
import type { ChoiceQuestion, QuestionBank } from "./questionnaire/types.ts";

/** Editable content lives in /data as JSON so careers experts can change it without touching code. */
export const questionBank = bankJson as unknown as QuestionBank;
export const occupationData = occupationsJson as unknown as OccupationData;
export const jsaOutlook = jsaJson as unknown as JsaOutlookData;
export const earningsData = earningsJson as unknown as EarningsData;
export const skillsData = skillsJson as unknown as SkillsData;
export const qualificationData = qualificationsJson as unknown as QualificationData;

export const skillsGraph = new SkillsGraph(skillsData.skills, qualificationData.qualifications, occupationData.occupations);

export const subjectLabels: Record<string, string> = Object.fromEntries(
  (questionBank.questions.find((q) => q.id === "subjects_enjoyed") as ChoiceQuestion).options.map((o) => [
    o.value,
    o.label,
  ]),
);

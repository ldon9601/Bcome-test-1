import bankJson from "../../data/questions/career-profile.json" with { type: "json" };
import occupationsJson from "../../data/occupations/occupations.json" with { type: "json" };
import jsaJson from "../../data/outlook/jsa-2025.json" with { type: "json" };
import earningsJson from "../../data/outlook/earnings.json" with { type: "json" };
import jsaProfilesJson from "../../data/outlook/jsa-occupation-profiles.json" with { type: "json" };
import offeringsJson from "../../data/courses/offerings.json" with { type: "json" };
import skillsJson from "../../data/skills/skills.json" with { type: "json" };
import qualificationsJson from "../../data/skills/qualifications.json" with { type: "json" };
import { SkillsGraph } from "./careers/skills.ts";
import type { CourseOfferingsData, EarningsData, JsaOutlookData, JsaProfileData, OccupationData, QualificationData, SkillsData } from "./careers/types.ts";
import type { ChoiceQuestion, QuestionBank } from "./questionnaire/types.ts";

/** Editable content lives in /data as JSON so careers experts can change it without touching code. */
export const questionBank = bankJson as unknown as QuestionBank;
export const occupationData = occupationsJson as unknown as OccupationData;
export const jsaOutlook = jsaJson as unknown as JsaOutlookData;
export const earningsData = earningsJson as unknown as EarningsData;
export const skillsData = skillsJson as unknown as SkillsData;
export const qualificationData = qualificationsJson as unknown as QualificationData;
export const jsaProfiles = jsaProfilesJson as unknown as JsaProfileData;
export const courseOfferings = offeringsJson as unknown as CourseOfferingsData;

// Each career carries its JSA occupation profile (joined on the ANZSCO unit group), so scoring,
// facts and plans can use JSA earnings and workforce figures without passing another dataset around.
for (const o of occupationData.occupations) o.jsaProfile = jsaProfiles.byUnitGroup[o.anzsco] ?? null;

export const skillsGraph = new SkillsGraph(skillsData.skills, qualificationData.qualifications, occupationData.occupations);

export const subjectLabels: Record<string, string> = Object.fromEntries(
  (questionBank.questions.find((q) => q.id === "current_subjects") as ChoiceQuestion).options.map((o) => [
    o.value,
    o.label,
  ]),
);

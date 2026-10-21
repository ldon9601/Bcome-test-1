import type { Occupation, Outlook } from "./types.ts";

export type TagTone = "green" | "blue" | "purple" | "pink" | "amber" | "teal";
export type TagIcon = "growth" | "demand" | "heart" | "hands" | "map" | "flex" | "team" | "spark" | "ai" | "money" | "clock" | "tools";

export interface CareerTag {
  label: string;
  icon: TagIcon;
  tone: TagTone;
}

/**
 * Short, factual highlights for career cards ("Strong growth", "High demand"…), derived from the
 * same data the scores use. Ordered by how useful they are to a student, top four kept.
 */
export function careerTags(occ: Occupation, outlook: Outlook, limit = 4): CareerTag[] {
  const p = occ.profile;
  const tags: CareerTag[] = [];
  if (outlook.band10 === "strong") tags.push({ label: "Strong growth", icon: "growth", tone: "green" });
  else if (outlook.band10 === "good") tags.push({ label: "Good growth", icon: "growth", tone: "green" });
  if (occ.market.shortage === "shortage") tags.push({ label: "High demand", icon: "demand", tone: "blue" });
  if (p.values.purpose >= 78) tags.push({ label: "Positive social impact", icon: "heart", tone: "pink" });
  if (occ.pathways.some((x) => x.route === "apprenticeship" || x.route === "traineeship" || x.route === "cadetship")) {
    tags.push({ label: "Earn while you learn", icon: "tools", tone: "amber" });
  }
  if (p.environment.physical >= 67) tags.push({ label: "Hands-on work", icon: "hands", tone: "amber" });
  if (p.values.creativity >= 78) tags.push({ label: "Creative work", icon: "spark", tone: "purple" });
  if (occ.market.ai.augmentation >= 78 && occ.market.ai.automation <= 56) tags.push({ label: "AI-enhanced", icon: "ai", tone: "purple" });
  const midPay = (occ.salary.experienced[0] + occ.salary.experienced[1]) / 2;
  if (midPay >= 120000) tags.push({ label: "High earning potential", icon: "money", tone: "teal" });
  if (occ.timeToQualify.years[1] <= 1) tags.push({ label: "Quick to qualify", icon: "clock", tone: "teal" });
  if (occ.market.regionalBreadth >= 89) tags.push({ label: "Jobs all over Australia", icon: "map", tone: "blue" });
  if (p.environment.flexibility >= 78) tags.push({ label: "Flexible work", icon: "flex", tone: "teal" });
  if (p.environment.teamwork >= 89) tags.push({ label: "Team-based", icon: "team", tone: "pink" });
  return tags.slice(0, limit);
}

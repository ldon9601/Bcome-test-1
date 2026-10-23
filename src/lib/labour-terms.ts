/** Definitions shown in the app (kept apart from the data so pages can import them cheaply). */

/** ANZSCO skill levels, as defined by the ABS and used by JSA. */
export const SKILL_LEVELS: Record<number, { short: string; definition: string }> = {
  1: { short: "Bachelor degree or higher", definition: "Commensurate with a bachelor degree or higher qualification. At least five years of relevant experience may substitute for the formal qualification." },
  2: { short: "Advanced diploma or diploma", definition: "Commensurate with an advanced diploma or diploma. At least three years of relevant experience may substitute for the formal qualification." },
  3: { short: "Certificate IV, or Certificate III with on-the-job training", definition: "Commensurate with a Certificate IV, or a Certificate III including at least two years of on-the-job training (most trade apprenticeships). At least three years of relevant experience may substitute." },
  4: { short: "Certificate II or III", definition: "Commensurate with a Certificate II or III. At least one year of relevant experience may substitute for the formal qualification." },
  5: { short: "Certificate I or secondary education", definition: "Commensurate with a Certificate I or finishing secondary school. Some jobs also need a short period of on-the-job training." },
};
export const SKILL_LEVEL_NOTE =
  "ANZSCO gives every occupation a skill level from 1 to 5, based on the range and complexity of its tasks and the qualification or experience usually needed to do them. Level 1 is the most complex. It describes the job, not the person doing it.";
export const ANZSIC_NOTE =
  "ANZSIC (the Australian and New Zealand Standard Industrial Classification) groups businesses by what they do. The code shown is the industry group that Bcome estimates employs the most people in this job; many jobs are found across several industries.";


/** Gen AI exposure bands (JSA Our Gen AI Transition scores, split into thirds by Bcome). */
export const AI_EXPOSURE: Record<"high" | "medium" | "low", { label: string; definition: string }> = {
  high: {
    label: "High",
    definition: "Gen AI could do a large share of this job's tasks. Expect the work to change a lot by 2035: routine tasks shrink, and specialist knowledge, judgement and people skills matter more.",
  },
  medium: {
    label: "Medium",
    definition: "Gen AI could do some of this job's tasks. By 2035, using AI tools well is likely to be a normal part of the job, alongside the parts only people do.",
  },
  low: {
    label: "Low",
    definition: "Most of this job is hands-on, physical or face-to-face work that Gen AI can't do. The core of the job is unlikely to change much because of AI by 2035.",
  },
};
export const AI_HELPER: Record<"high" | "medium" | "low", string> = {
  high: "AI tools could help a lot with the work",
  medium: "AI tools could help with some of the work",
  low: "AI tools are less useful in this work",
};
export const AI_EXPOSURE_NOTE =
  "Jobs and Skills Australia (Our Gen AI Transition, 2025) scored every task in each occupation for how much Gen AI could do it (automation) or help a person do it (augmentation), assuming it's fully taken up. Bcome ranks the 357 occupations by the automation score and splits them into thirds: high, medium and low exposure. JSA's modelling expects these changes to build up between now, 2035 and 2050. Exposure isn't the same as job losses: many exposed jobs change rather than disappear.";

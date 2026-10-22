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


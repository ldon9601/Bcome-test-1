/**
 * Checks the editable JSON content for mistakes before it reaches students.
 * Run after editing anything in /data:  npm run data:validate
 */
import { earningsData, jsaOutlook, occupationData, qualificationData, questionBank, skillsData, subjectLabels } from "../src/lib/data.ts";
import { RIASEC, WORK_VALUES, type ChoiceQuestion } from "../src/lib/questionnaire/types.ts";

const DRIVERS = ["ageing-population", "care-economy", "net-zero", "digital", "infrastructure", "housing", "population-growth", "defence"];
const ROUTES = ["university", "vet", "apprenticeship", "traineeship", "cadetship", "other"];

const isRange = (r: unknown): r is [number, number] =>
  Array.isArray(r) && r.length === 2 && r.every((n) => typeof n === "number" && n >= 0) && r[0] <= r[1];

export function validateData(): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);

  // Question bank
  const ids = new Set<string>();
  for (const q of questionBank.questions) {
    if (ids.has(q.id)) err(`Duplicate question id: ${q.id}`);
    ids.add(q.id);
    if (!questionBank.sections.some((s) => s.id === q.section)) err(`${q.id}: unknown section ${q.section}`);
    for (const ref of Object.keys(q.showIf?.answers ?? {})) {
      if (!questionBank.questions.some((other) => other.id === ref)) err(`${q.id}: showIf refers to unknown question ${ref}`);
    }
  }
  for (const t of RIASEC) {
    const tier1 = questionBank.questions.filter((q) => q.kind === "likert" && q.scale.type === "riasec" && q.scale.code === t && q.tier === 1).length;
    if (tier1 < 3) err(`RIASEC ${t}: needs at least 3 tier-1 items, has ${tier1}`);
  }
  for (const v of WORK_VALUES) {
    if (!questionBank.questions.some((q) => q.kind === "likert" && q.scale.type === "value" && q.scale.code === v)) err(`Work value ${v} has no question`);
  }
  const areaQ = questionBank.questions.find((q) => q.id === "apprenticeship_area") as ChoiceQuestion | undefined;
  const areas = new Set(areaQ?.options.map((o) => o.value) ?? []);

  // Skills and qualifications
  const clusters = new Set(skillsData.clusters.map((c) => c.id));
  const skillIds = new Set<string>();
  for (const s of skillsData.skills) {
    if (skillIds.has(s.id)) err(`Duplicate skill id: ${s.id}`);
    skillIds.add(s.id);
    if (!clusters.has(s.broader)) err(`skill ${s.id}: unknown cluster ${s.broader}`);
    if ((s.type === "core") !== s.id.startsWith("core-")) err(`skill ${s.id}: type and id prefix disagree`);
  }
  const qualIds = new Set<string>();
  for (const q of qualificationData.qualifications) {
    if (qualIds.has(q.id)) err(`Duplicate qualification id: ${q.id}`);
    qualIds.add(q.id);
    if (!(q.aqfLevel >= 1 && q.aqfLevel <= 10)) err(`qualification ${q.id}: AQF level must be 1–10`);
    if (!isRange(q.durationYears)) err(`qualification ${q.id}: durationYears must be [min, max]`);
    if (q.sector === "vet" && q.tgaCode !== q.id) err(`qualification ${q.id}: VET ids must be their training.gov.au code`);
    if (q.sector === "higher-ed" && !/^\d{2}(\d{2})?$/.test(q.ascedField ?? "")) err(`qualification ${q.id}: needs a 2- or 4-digit ASCED field`);
    for (const s of q.skills) if (!skillIds.has(s)) err(`qualification ${q.id}: unknown skill ${s}`);
  }

  // Occupations
  const oscaIds = new Set<string>();
  for (const o of occupationData.occupations) {
    const where = `occupation ${o.osca} (${o.title})`;
    if (oscaIds.has(o.osca)) err(`Duplicate OSCA code: ${o.osca}`);
    oscaIds.add(o.osca);
    const len = o.oscaLevel === "occupation" ? 6 : 4;
    if (!new RegExp(`^\\d{${len}}$`).test(o.osca)) err(`${where}: OSCA ${o.oscaLevel} codes have ${len} digits`);
    if (o.oscaUnitGroup !== o.osca.slice(0, 4)) err(`${where}: oscaUnitGroup must be the first 4 digits`);
    if (!/^\d{4}$/.test(o.anzsco)) err(`${where}: anzsco should be a 4-digit unit group`);
    if (!(o.skillLevel >= 1 && o.skillLevel <= 5)) err(`${where}: skillLevel must be 1–5`);
    if (!/^[RIASEC]{3}$/.test(o.riasec) || new Set(o.riasec).size !== 3) err(`${where}: riasec must be 3 distinct letters`);
    for (const v of o.values) if (!(WORK_VALUES as readonly string[]).includes(v)) err(`${where}: unknown value ${v}`);
    for (const s of [...o.subjects.helpful, ...o.subjects.oftenRequired]) if (!subjectLabels[s]) err(`${where}: unknown subject ${s}`);
    for (const d of o.drivers) if (!DRIVERS.includes(d)) err(`${where}: unknown driver ${d}`);
    for (const a of o.apprenticeshipAreas) if (!areas.has(a)) err(`${where}: unknown apprenticeship area ${a}`);
    if (!(o.industry in jsaOutlook.industries)) err(`${where}: industry "${o.industry}" not in JSA industry list`);
    if (o.skills.length < 3) err(`${where}: needs at least 3 specialist skills`);
    for (const s of o.skills) if (!skillIds.has(s) || !s.startsWith("sk-")) err(`${where}: unknown specialist skill ${s}`);
    for (const s of o.coreCompetencies) if (!skillIds.has(s) || !s.startsWith("core-")) err(`${where}: unknown core competency ${s}`);
    if (!o.pathways.length) err(`${where}: needs at least one pathway`);
    for (const p of o.pathways) {
      if (!ROUTES.includes(p.route)) err(`${where}: unknown route ${p.route}`);
      if (p.qualification && !qualIds.has(p.qualification)) err(`${where}: unknown qualification ${p.qualification}`);
      if (!isRange(p.years)) err(`${where}: pathway years must be [min, max]`);
    }
    if (!isRange(o.timeToQualify.years)) err(`${where}: timeToQualify.years must be [min, max]`);
    if (!["open", "moderate", "high"].includes(o.entryCompetitiveness)) err(`${where}: unknown entryCompetitiveness`);
    if (!isRange(o.salary.entry) || !isRange(o.salary.experienced)) err(`${where}: salary ranges must be [min, max]`);
    else if (o.salary.entry[0] > o.salary.experienced[0] || o.salary.entry[1] > o.salary.experienced[1]) err(`${where}: experienced pay should not be below entry pay`);
    else if (o.salary.entry[0] < 15000 || o.salary.experienced[1] > 1000000) err(`${where}: salary looks wrong (use whole dollars a year)`);
  }
  for (const code of Object.keys(earningsData.byOsca)) {
    if (!occupationData.occupations.some((o) => o.osca === code || o.oscaUnitGroup === code)) err(`earnings: ${code} matches no occupation`);
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateData();
  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join("\n"));
    process.exit(1);
  }
  console.log(
    `✓ ${questionBank.questions.length} questions, ${occupationData.occupations.length} occupations (OSCA), ` +
      `${skillsData.skills.length} skills, ${qualificationData.qualifications.length} qualifications, ` +
      `${Object.keys(jsaOutlook.occupations).length} occupation-level JSA projections, ${Object.keys(earningsData.byOsca).length} earnings records`,
  );
}

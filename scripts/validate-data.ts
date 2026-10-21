/**
 * Checks the editable JSON content for mistakes before it reaches students.
 * Run after editing anything in /data:  npm run data:validate
 */
import { jsaOutlook, occupationData, questionBank, subjectLabels } from "../src/lib/data.ts";
import { RIASEC, WORK_VALUES, type ChoiceQuestion } from "../src/lib/questionnaire/types.ts";

const DRIVERS = ["ageing-population", "care-economy", "net-zero", "digital", "infrastructure", "housing", "population-growth", "defence"];

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
    const items = questionBank.questions.filter((q) => q.kind === "likert" && q.scale.type === "riasec" && q.scale.code === t);
    const tier1 = items.filter((q) => q.kind === "likert" && q.tier === 1).length;
    if (tier1 < 3) err(`RIASEC ${t}: needs at least 3 tier-1 items, has ${tier1}`);
  }
  for (const v of WORK_VALUES) {
    if (!questionBank.questions.some((q) => q.kind === "likert" && q.scale.type === "value" && q.scale.code === v)) {
      err(`Work value ${v} has no question`);
    }
  }
  const areaQ = questionBank.questions.find((q) => q.id === "apprenticeship_area") as ChoiceQuestion | undefined;
  const areas = new Set(areaQ?.options.map((o) => o.value) ?? []);

  // Occupations
  const occIds = new Set<string>();
  for (const o of occupationData.occupations) {
    const where = `occupation ${o.id}`;
    if (occIds.has(o.id)) err(`Duplicate occupation id: ${o.id}`);
    occIds.add(o.id);
    if (!/^\d{4}$/.test(o.anzsco)) err(`${where}: anzsco should be a 4-digit unit group`);
    if (!(o.majorGroup >= 1 && o.majorGroup <= 8) || String(o.majorGroup) !== o.anzsco[0]) {
      err(`${where}: majorGroup ${o.majorGroup} doesn't match anzsco ${o.anzsco}`);
    }
    if (!(o.skillLevel >= 1 && o.skillLevel <= 5)) err(`${where}: skillLevel must be 1–5`);
    if (!/^[RIASEC]{3}$/.test(o.riasec) || new Set(o.riasec).size !== 3) err(`${where}: riasec must be 3 distinct letters`);
    for (const v of o.values) if (!(WORK_VALUES as readonly string[]).includes(v)) err(`${where}: unknown value ${v}`);
    for (const s of [...o.subjects.helpful, ...o.subjects.oftenRequired]) if (!subjectLabels[s]) err(`${where}: unknown subject ${s}`);
    for (const d of o.drivers) if (!DRIVERS.includes(d)) err(`${where}: unknown driver ${d}`);
    for (const a of o.apprenticeshipAreas) if (!areas.has(a)) err(`${where}: unknown apprenticeship area ${a}`);
    if (!(o.industry in jsaOutlook.industries)) err(`${where}: industry "${o.industry}" not in JSA industry list`);
    if (!o.pathways.university && !o.pathways.vet && !o.pathways.apprenticeship) {
      // Some jobs (e.g. truck driving) are entered by licence or on-the-job training; vet holds that.
      err(`${where}: needs at least one pathway`);
    }
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
    `✓ ${questionBank.questions.length} questions, ${occupationData.occupations.length} occupations, ` +
      `${Object.keys(jsaOutlook.occupations).length} occupation-level JSA projections loaded`,
  );
}

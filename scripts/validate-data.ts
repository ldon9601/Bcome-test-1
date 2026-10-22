/**
 * Checks the editable JSON content for mistakes before it reaches students.
 * Run after editing anything in /data:  npm run data:validate
 */
import { courseOfferings, earningsData, jsaOutlook, jsaProfiles, occupationData, qualificationData, questionBank, skillsData, subjectLabels } from "../src/lib/data.ts";
import { CAREER_FAMILIES } from "../src/lib/careers/types.ts";
import { RIASEC, SKILL_DIMS, STYLE_DIMS, SUBJECT_AREAS, VALUE_DIMS } from "../src/lib/questionnaire/types.ts";

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
  const numbered = questionBank.questions.filter((q) => q.number !== undefined);
  if (numbered.length !== 36) err(`The Career Profile should have 36 numbered questions, has ${numbered.length}`);
  numbered.forEach((q, i) => q.number !== i + 1 && err(`Question ${q.id} is numbered ${q.number}, expected ${i + 1}`));
  const likert = questionBank.questions.filter((q) => q.kind === "likert");
  for (const t of RIASEC) if (likert.filter((q) => q.dimension.type === "riasec" && q.dimension.code === t).length !== 2) err(`Interest ${t} needs 2 items`);
  for (const d of SKILL_DIMS) if (!likert.some((q) => q.dimension.type === "skill" && q.dimension.code === d)) err(`Skill ${d} has no question`);
  for (const d of VALUE_DIMS) if (!likert.some((q) => q.dimension.type === "value" && q.dimension.code === d)) err(`Value ${d} has no question`);
  for (const q of likert) if (!questionBank.scales[q.scaleId]) err(`${q.id}: unknown scale ${q.scaleId}`);

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
    if (!(CAREER_FAMILIES as readonly string[]).includes(o.family)) err(`${where}: unknown family ${o.family}`);
    if (!o.summary || o.summary.length > 120) err(`${where}: needs a one-sentence summary under 120 characters`);
    if (!/^\d{4}$/.test(o.anzsco)) err(`${where}: anzsco should be a 4-digit unit group`);
    if (!(o.skillLevel >= 1 && o.skillLevel <= 5)) err(`${where}: skillLevel must be 1–5`);
    if (!/^[RIASEC]{3}$/.test(o.riasec) || new Set(o.riasec).size !== 3) err(`${where}: riasec must be 3 distinct letters`);
    const inRange = (rec: Record<string, number> | undefined, keys: readonly string[], name: string) => {
      for (const k of keys) if (!(typeof rec?.[k] === "number" && rec[k] >= 0 && rec[k] <= 100)) err(`${where}: profile.${name}.${k} must be 0–100`);
    };
    inRange(o.profile?.interests, RIASEC, "interests");
    inRange(o.profile?.skills, SKILL_DIMS, "skills");
    inRange(o.profile?.values, VALUE_DIMS, "values");
    inRange(o.profile?.environment, STYLE_DIMS, "environment");
    for (const a of [...(o.subjectAreas?.helpful ?? []), ...(o.subjectAreas?.required ?? [])]) if (!(SUBJECT_AREAS as readonly string[]).includes(a)) err(`${where}: unknown subject area ${a}`);
    const m = o.market;
    if (!m || !["shortage", "no-shortage"].includes(m.shortage)) err(`${where}: market.shortage missing`);
    for (const [k, v] of Object.entries({ regionalBreadth: m?.regionalBreadth, graduateOutcome: m?.graduateOutcome, automation: m?.ai?.automation, augmentation: m?.ai?.augmentation })) {
      if (!(typeof v === "number" && v >= 0 && v <= 100)) err(`${where}: market ${k} must be 0–100`);
    }
    for (const k of ["employmentGrowth", "shortage", "regionalBreadth", "graduateOutcome", "ai", "salary", "profile"]) if (!o.evidence?.[k]) err(`${where}: evidence.${k} missing`);
    for (const s of [...o.subjects.helpful, ...o.subjects.oftenRequired]) if (!subjectLabels[s]) err(`${where}: unknown subject ${s}`);
    for (const d of o.drivers) if (!DRIVERS.includes(d)) err(`${where}: unknown driver ${d}`);
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

  // ANZSCO coding and JSA occupation profiles
  for (const o of occupationData.occupations) {
    const where = `occupation ${o.osca} (${o.title})`;
    if (!/^\d{4}$/.test(o.anzsco)) err(`${where}: anzsco must be a 4-digit unit group`);
    if (!jsaProfiles.byUnitGroup[o.anzsco]) err(`${where}: no JSA occupation profile for ANZSCO ${o.anzsco}`);
    else if (jsaProfiles.byUnitGroup[o.anzsco].title !== o.anzscoTitle) err(`${where}: anzscoTitle should be "${jsaProfiles.byUnitGroup[o.anzsco].title}"`);
    if (o.anzscoOccupation && !(new RegExp(`^${o.anzsco}\\d{2}$`).test(o.anzscoOccupation.code))) err(`${where}: anzscoOccupation ${o.anzscoOccupation.code} isn't in unit group ${o.anzsco}`);
  }
  for (const [code, p] of Object.entries(jsaProfiles.byUnitGroup)) {
    if (!p.url.startsWith("https://www.jobsandskills.gov.au/")) err(`JSA profile ${code}: url should be a jobsandskills.gov.au page`);
    for (const k of ["partTimePct", "femalePct"] as const) if (p[k] !== null && (p[k]! < 0 || p[k]! > 100)) err(`JSA profile ${code}: ${k} out of range`);
    if (p.medianWeeklyEarnings !== null && (p.medianWeeklyEarnings < 500 || p.medianWeeklyEarnings > 6000)) err(`JSA profile ${code}: weekly earnings look wrong`);
    const sum = Object.values(p.qualifications).reduce((a, b) => a + b, 0);
    if (sum > 100.5) err(`JSA profile ${code}: qualification shares add to more than 100%`);
  }

  // Course offerings (university ATARs and TAFE entry requirements)
  const quals = new Map(qualificationData.qualifications.map((q) => [q.id, q]));
  const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
  courseOfferings.university.forEach((u, i) => {
    const where = `university offering ${i} (${u.provider}: ${u.course})`;
    const q = quals.get(u.qualificationId);
    if (!q) err(`${where}: unknown qualification ${u.qualificationId}`);
    else if (q.sector !== "higher-ed") err(`${where}: ${u.qualificationId} isn't a higher-education qualification`);
    if (!courseOfferings.sources[u.source]) err(`${where}: unknown source ${u.source}`);
    if (!STATES.includes(u.state)) err(`${where}: unknown state ${u.state}`);
    if (u.atar.value !== null && (u.atar.value < 30 || u.atar.value > 99.95)) err(`${where}: ATAR ${u.atar.value} out of range`);
    if (u.atar.value !== null && !u.atar.kind) err(`${where}: say what kind of ATAR this is`);
  });
  courseOfferings.tafe.forEach((t, i) => {
    const where = `TAFE offering ${i} (${t.provider}: ${t.course})`;
    const q = quals.get(t.qualificationId);
    if (!q) err(`${where}: unknown qualification ${t.qualificationId}`);
    else if (q.sector !== "vet") err(`${where}: ${t.qualificationId} isn't a VET qualification`);
    if (!t.url.startsWith("https://")) err(`${where}: needs a source URL`);
    if (!t.requirements.length) err(`${where}: no entry requirements`);
  });
  for (const [id, src] of Object.entries(courseOfferings.sources)) if (!src.url.startsWith("https://")) err(`course source ${id}: needs a URL`);
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
      `${Object.keys(jsaOutlook.occupations).length} occupation-level JSA projections, ${Object.keys(earningsData.byOsca).length} earnings records, ` +
      `${Object.keys(jsaProfiles.byUnitGroup).length} JSA occupation profiles, ${courseOfferings.university.length} university and ${courseOfferings.tafe.length} TAFE course entries`,
  );
}

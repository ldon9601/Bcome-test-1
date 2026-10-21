import type { Occupation, Qualification, Skill } from "./types.ts";

/**
 * The skills graph: skills connect qualifications (what you learn) to occupations (what the
 * work needs), and occupations to each other (what transfers if you change career).
 */
export class SkillsGraph {
  readonly skills: Map<string, Skill>;
  readonly qualifications: Map<string, Qualification>;
  readonly occupations: Occupation[];

  constructor(skills: Skill[], qualifications: Qualification[], occupations: Occupation[]) {
    this.skills = new Map(skills.map((s) => [s.id, s]));
    this.qualifications = new Map(qualifications.map((q) => [q.id, q]));
    this.occupations = occupations;
  }

  label(id: string): string {
    return this.skills.get(id)?.prefLabel ?? id;
  }

  /** Share of specialist skills two occupations have in common (Jaccard, 0–1). */
  overlap(a: Occupation, b: Occupation): number {
    const A = new Set(a.skills);
    const shared = b.skills.filter((s) => A.has(s)).length;
    const union = new Set([...a.skills, ...b.skills]).size;
    return union ? shared / union : 0;
  }

  /** Other careers that use many of the same skills, most similar first. */
  related(occ: Occupation, limit = 3): { occupation: Occupation; shared: string[]; overlap: number }[] {
    return this.occupations
      .filter((o) => o.osca !== occ.osca)
      .map((o) => ({ occupation: o, shared: o.skills.filter((s) => occ.skills.includes(s)), overlap: this.overlap(occ, o) }))
      .filter((r) => r.shared.length >= 2)
      .sort((x, y) => y.overlap - x.overlap || x.occupation.title.localeCompare(y.occupation.title))
      .slice(0, limit);
  }

  /**
   * How portable this career's skills are: the share of its specialist skills that are also used
   * in at least one other career for which `isGrowing` is true. High portability means that if this
   * job changes, the skills still lead somewhere.
   */
  portability(occ: Occupation, isGrowing: (o: Occupation) => boolean): number {
    if (!occ.skills.length) return 0;
    const growing = this.occupations.filter((o) => o.osca !== occ.osca && isGrowing(o));
    const transferable = occ.skills.filter((s) => growing.some((o) => o.skills.includes(s)));
    return transferable.length / occ.skills.length;
  }

  /** Skills the occupation needs that a qualification builds. */
  skillsFromQualification(qualId: string, occ: Occupation): string[] {
    const q = this.qualifications.get(qualId);
    return q ? q.skills.filter((s) => occ.skills.includes(s)) : [];
  }
}

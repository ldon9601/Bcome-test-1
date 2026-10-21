import { computeOutlook } from "./outlook.ts";
import { careerTags } from "./tags.ts";
import type { JsaOutlookData, Occupation, QualificationData } from "./types.ts";

/** Lightweight career and course lists for browsing and search (no student data). */
export function careerCatalogue(occupations: Occupation[], jsa: JsaOutlookData) {
  return occupations
    .map((o) => {
      const outlook = computeOutlook(o, jsa);
      return {
        osca: o.osca,
        title: o.title,
        summary: o.summary,
        family: o.family,
        photo: (o as Occupation & { photo?: { src: string; credit?: string } }).photo,
        riasec: o.riasec,
        salary: o.salary,
        timeToQualify: o.timeToQualify,
        outlook: { band10: outlook.band10, summary: outlook.summary },
        tags: careerTags(o, outlook),
        routes: [...new Set(o.pathways.map((p) => p.route))],
        pathways: o.pathways.map((p) => ({ route: p.route, description: p.description, years: p.years })),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
export type CatalogueCareer = ReturnType<typeof careerCatalogue>[number];

export function courseCatalogue(quals: QualificationData, occupations: Occupation[]) {
  return quals.qualifications
    .map((q) => ({
      id: q.id,
      title: q.title,
      sector: q.sector,
      aqfLevel: q.aqfLevel,
      durationYears: q.durationYears,
      tgaCode: q.tgaCode,
      leadsTo: occupations.filter((o) => o.pathways.some((p) => p.qualification === q.id)).map((o) => ({ osca: o.osca, title: o.title, family: o.family })),
    }))
    .filter((q) => q.leadsTo.length)
    .sort((a, b) => a.title.localeCompare(b.title));
}
export type CatalogueCourse = ReturnType<typeof courseCatalogue>[number];

/** What the header search needs: titles, codes and where each result goes. */
export function searchIndex(careers: CatalogueCareer[], courses: CatalogueCourse[]) {
  return [
    ...careers.map((c) => ({ kind: "career" as const, id: c.osca, title: c.title, detail: c.summary, href: `/careers?career=${c.osca}` })),
    ...courses.map((q) => ({
      kind: "course" as const,
      id: q.id,
      title: q.title,
      detail: `${q.sector === "vet" ? "TAFE / VET" : "University"} · leads to ${q.leadsTo.map((o) => o.title).slice(0, 2).join(", ")}`,
      href: `/explore#${q.id}`,
    })),
  ];
}
export type SearchItem = ReturnType<typeof searchIndex>[number];

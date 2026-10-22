import { computeOutlook } from "./outlook.ts";
import { careerTags } from "./tags.ts";
import type { CourseOfferingsData, JsaOutlookData, Occupation, QualificationData } from "./types.ts";

/** Lightweight career and course lists for browsing and search (no student data). */
export function careerCatalogue(occupations: Occupation[], jsa: JsaOutlookData, offerings?: CourseOfferingsData) {
  return occupations
    .map((o) => {
      const outlook = computeOutlook(o, jsa);
      const quals = new Set(o.pathways.map((p) => p.qualification).filter(Boolean));
      const uni = offerings?.university.filter((u) => quals.has(u.qualificationId)) ?? [];
      const atars = uni.map((u) => u.atar.value).filter((v): v is number => v !== null);
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
        pathways: o.pathways.map((p) => ({ route: p.route, description: p.description, years: p.years, qualification: p.qualification ?? null })),
        anzsco: { unitGroup: o.anzsco, title: o.anzscoTitle, occupation: o.anzscoOccupation, profile: o.jsaProfile ?? null },
        courses: {
          universities: new Set(uni.map((u) => u.provider)).size,
          atarRange: atars.length ? ([Math.min(...atars), Math.max(...atars)] as [number, number]) : null,
          tafe: offerings?.tafe.some((t) => quals.has(t.qualificationId)) ?? false,
        },
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
export type CatalogueCareer = ReturnType<typeof careerCatalogue>[number];

export function courseCatalogue(quals: QualificationData, occupations: Occupation[], offerings?: CourseOfferingsData) {
  return quals.qualifications
    .map((q) => ({
      id: q.id,
      title: q.title,
      sector: q.sector,
      aqfLevel: q.aqfLevel,
      durationYears: q.durationYears,
      tgaCode: q.tgaCode,
      leadsTo: occupations.filter((o) => o.pathways.some((p) => p.qualification === q.id)).map((o) => ({ osca: o.osca, title: o.title, family: o.family })),
      university: (offerings?.university ?? []).filter((u) => u.qualificationId === q.id),
      tafe: (offerings?.tafe ?? []).filter((t) => t.qualificationId === q.id),
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
    // Specific university courses, so students can search by university name too.
    ...courses.flatMap((q) =>
      q.university.map((u, i) => ({
        kind: "course" as const,
        id: `${q.id}-${i}`,
        title: `${u.course}, ${u.provider}`,
        detail: `${u.state}${u.atar.display ? ` · ATAR ${u.atar.display}` : ""} · leads to ${q.leadsTo.map((o) => o.title).slice(0, 2).join(", ")}`,
        href: `/explore#${q.id}`,
      })),
    ),
  ];
}
export type SearchItem = ReturnType<typeof searchIndex>[number];

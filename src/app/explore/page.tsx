import type { Metadata } from "next";
import { courseCatalogue } from "@/lib/careers/catalogue.ts";
import { courseOfferings, occupationData, qualificationData } from "@/lib/data.ts";
import ExploreView from "./ExploreView.tsx";

export const metadata: Metadata = { title: "Explore Uni & TAFE | Bcome" };

export default function ExplorePage() {
  return <ExploreView courses={courseCatalogue(qualificationData, occupationData.occupations, courseOfferings)} sources={courseOfferings.sources} retrieved={courseOfferings.retrieved} />;
}

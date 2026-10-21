import type { Metadata } from "next";
import { careerCatalogue } from "@/lib/careers/catalogue.ts";
import { jsaOutlook, occupationData } from "@/lib/data.ts";
import CareerBrowser from "./CareerBrowser.tsx";

export const metadata: Metadata = { title: "Careers | Bcome" };

export default function CareersPage() {
  return <CareerBrowser careers={careerCatalogue(occupationData.occupations, jsaOutlook)} />;
}

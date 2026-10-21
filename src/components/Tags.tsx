import type { CareerTag } from "@/lib/careers/tags.ts";
import { Icon } from "./Icon.tsx";

export function Tags({ tags, limit }: { tags: CareerTag[]; limit?: number }) {
  return (
    <ul className="tags" aria-label="Highlights">
      {tags.slice(0, limit).map((t) => (
        <li key={t.label} className={`tag ${t.tone}`}>
          <Icon name={t.icon} size={14} />
          {t.label}
        </li>
      ))}
    </ul>
  );
}

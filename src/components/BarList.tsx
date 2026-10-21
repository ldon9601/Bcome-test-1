/** Simple labelled horizontal bars for dashboard breakdowns. */
export function BarList({
  items,
  total,
  colour = "var(--violet)",
  unit = "students",
  empty = "No assessments yet.",
}: {
  items: { key: string; label: string; count: number; colour?: string; note?: string }[];
  total: number;
  colour?: string;
  unit?: string;
  empty?: string;
}) {
  if (!items.length || total === 0) return <p className="muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="bar-list">
      {items.map((i) => (
        <li key={i.key}>
          <span className="bar-label">
            {i.label}
            {i.note && <span className="small"> {i.note}</span>}
          </span>
          <span className="bar" aria-hidden="true">
            <span style={{ width: `${(i.count / max) * 100}%`, background: i.colour ?? colour }} />
          </span>
          <span className="bar-value" aria-label={`${i.count} ${unit}, ${Math.round((i.count / total) * 100)}%`}>
            {i.count} <span className="small">({Math.round((i.count / total) * 100)}%)</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

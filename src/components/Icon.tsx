/** A small stroke icon set (24×24, inherits text colour). Drawn inline so the app needs no icon package. */

const PATHS: Record<string, string> = {
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M15.5 8.5l-2 5-5 2 2-5 5-2Z",
  briefcase: "M4 8h16v11H4z M9 8V5h6v3 M4 13h16",
  route: "M6 20V9a3 3 0 0 1 6 0v6a3 3 0 0 0 6 0V4 M4 6l2-2 2 2 M16 6l2-2 2 2",
  grad: "M2 9l10-5 10 5-10 5-10-5Z M6 11v5c3 2.5 9 2.5 12 0v-5 M22 9v5",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M20 20l-4-4",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  flame: "M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8Z",
  target: "M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 11a1 1 0 1 0 1 1 M12 12l8-8 M16 4h4v4",
  chevron: "M9 6l6 6-6 6",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  arrowLeft: "M19 12H5 M11 6l-6 6 6 6",
  bulb: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  chart: "M5 20V11 M10 20V5 M15 20v-7 M20 20V9",
  wrench: "M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-3-1-1-3 2.5-2.5Z",
  palette: "M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1.5-1.5-2 0-3h3a4 4 0 0 0 4-4c0-5-4-9-9-9Z M7.5 11.5h.01 M10 7.5h.01 M14.5 7.5h.01",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14c2 .7 3 2.6 3 6",
  clipboard: "M8 4h8v3H8z M6 5H5v16h14V5h-1 M9 12h6 M9 16h4",
  leaf: "M5 19C5 10 11 5 20 4c0 9-5 15-14 15Z M5 19c4-5 7-8 11-11",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4Z M8 6H4c0 3 2 4 4 4 M16 6h4c0 3-2 4-4 4 M12 13v4 M8 20h8 M9 17h6v3H9z",
  flag: "M5 21V4 M5 4h11l-2 4 2 4H5",
  badge: "M12 2l3 2.5 3.8-.3.8 3.7 3.1 2.2-1.5 3.5 1.5 3.5-3.1 2.2-.8 3.7-3.8-.3L12 22l-3-2.5-3.8.3-.8-3.7L1.3 14l1.5-3.5L1.3 7l3.1-2.2.8-3.7L9 4.5 12 2Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z M9 4v14 M15 6v14",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2",
  money: "M3 7h18v10H3z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z M6 10v4 M18 10v4",
  tools: "M14 6l4-2 2 2-2 4-4-4Z M15 7l-9 9 M4 18l2 2 M10 4L4 10l3 3 6-6",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z",
  ai: "M7 7h10v10H7z M10 10h4v4h-4z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4",
  hands: "M7 11V6a1.5 1.5 0 0 1 3 0v4 M10 9V4.5a1.5 1.5 0 0 1 3 0V10 M13 9.5V6a1.5 1.5 0 0 1 3 0v6 M16 10a1.5 1.5 0 0 1 3 0v3c0 4-3 7-7 7-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L7 13",
  growth: "M3 17l6-6 4 4 8-8 M15 7h6v6",
  demand: "M4 20h16 M6 16v-3 M10 16V9 M14 16V6 M18 16v-6",
  team: "M7 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M17 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M3 19c0-2.5 1.8-4.5 4-4.5 M21 19c0-2.5-1.8-4.5-4-4.5 M7.5 20c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5",
  flex: "M4 7h11 M4 17h7 M15 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z M11 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z M19 17h1",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z M4 19a2 2 0 0 1 2-2h13",
  building: "M4 21V5l8-2v18 M12 8h8v13 M7 8h2 M7 12h2 M7 16h2 M15 12h2 M15 16h2 M2 21h20",
  check: "M4 12l5 5L20 6",
  bookmark: "M6 3h12v18l-6-4-6 4V3Z",
  close: "M6 6l12 12 M18 6L6 18",
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z M12 1v3 M12 20v3 M4.2 4.2l2.1 2.1 M17.7 17.7l2.1 2.1 M1 12h3 M20 12h3 M4.2 19.8l2.1-2.1 M17.7 6.3l2.1-2.1",
  school: "M3 10l9-6 9 6 M5 10v10h14V10 M10 20v-5h4v5",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

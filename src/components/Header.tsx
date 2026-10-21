"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchItem } from "@/lib/careers/catalogue.ts";
import { Icon, type IconName } from "./Icon.tsx";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Discover", icon: "compass" },
  { href: "/plan", label: "Careers", icon: "briefcase" },
  { href: "/journey", label: "Journey", icon: "route" },
  { href: "/explore", label: "Explore Uni & TAFE", icon: "grad" },
];

function Search({ index }: { index: SearchItem[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return index
      .filter((i) => i.title.toLowerCase().includes(t) || i.detail.toLowerCase().includes(t))
      .sort((a, b) => Number(b.title.toLowerCase().startsWith(t)) - Number(a.title.toLowerCase().startsWith(t)))
      .slice(0, 7);
  }, [q, index]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    window.location.href = href;
  };

  return (
    <div className="search" ref={box}>
      <Icon name="search" size={18} />
      <input
        type="search"
        placeholder="Search careers, courses or skills…"
        aria-label="Search careers and courses"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
          if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          if (e.key === "Enter" && results[active]) go(results[active].href);
          if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="search-results"
      />
      {open && results.length > 0 && (
        <ul id="search-results" className="search-results" role="listbox">
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.id}`} role="option" aria-selected={i === active}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => go(r.href)}>
                <span className={`kind kind-${r.kind}`}>{r.kind === "career" ? "Career" : "Course"}</span>
                <span>
                  <strong>{r.title}</strong>
                  <span className="muted">{r.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentChip() {
  const [year, setYear] = useState<string | null>(null);
  useEffect(() => {
    try {
      const a = JSON.parse(sessionStorage.getItem("bcome:answers") ?? "{}");
      if (a.year_level) setYear(`Year ${a.year_level}`);
    } catch {
      // no saved answers yet
    }
  }, []);
  return (
    <Link href="/login" className="student-chip" aria-label="Your account">
      <span className="avatar" aria-hidden="true">
        <Icon name="user" size={20} />
      </span>
      <span className="who">
        <strong>Guest</strong>
        <span>{year ?? "Sign in to save"}</span>
      </span>
    </Link>
  );
}

export function Header({ searchIndex }: { searchIndex: SearchItem[] }) {
  const path = usePathname();
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Bcome home">
        <span className="brand-b">B</span>come
      </Link>
      <nav aria-label="Main">
        {NAV.map((n) => {
          const current = n.href === "/" ? path === "/" || path === "/questionnaire" : path?.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className="nav-link" aria-current={current ? "page" : undefined}>
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <Search index={searchIndex} />
      <StudentChip />
    </header>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ id, counts }: { id: string; counts: { tasks: number; issues: number; photos: number } }) {
  const path = usePathname();
  const base = `/projects/${id}`;
  const tabs = [
    { href: base, label: "Overview" }, { href: `${base}/timeline`, label: "Timeline" }, { href: `${base}/tasks`, label: "Tasks", n: counts.tasks },
    { href: `${base}/site`, label: "Site" }, { href: `${base}/photos`, label: "Photos", n: counts.photos }, { href: `${base}/issues`, label: "Issues", n: counts.issues }, { href: `${base}/team`, label: "Team" },
  ];
  return (
    <nav className="scroll-hide -mb-px flex gap-1 overflow-x-auto border-b border-line" aria-label="Project sections">
      {tabs.map((t) => {
        const active = t.href === base ? path === base : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("relative whitespace-nowrap px-4 py-3 text-sm transition", active ? "font-semibold text-river after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-river" : "text-muted hover:text-charcoal")}>
            {t.label}{t.n ? <span className="ml-1.5 rounded-full bg-stone-200/70 px-1.5 py-px text-[10px] tabular-nums">{t.n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

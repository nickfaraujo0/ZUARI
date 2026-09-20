"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Camera, ClipboardList, Home, Images, ListChecks, MoreHorizontal, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "./i18n";

const TABS = [
  { href: "/site", label: "Home", icon: Home }, { href: "/site/tasks", label: "Tasks", icon: ListChecks },
  { href: "/site/progress", label: "Progress", icon: Images }, { href: "/site/more", label: "More", icon: MoreHorizontal },
];
const ACTIONS = [
  { href: "/site/add-progress", label: "Add Progress", sub: "Photo, status and a note", icon: Camera },
  { href: "/site/report-issue", label: "Report Issue", sub: "Flag a snag or problem", icon: AlertTriangle },
  { href: "/site/site-update", label: "Site Update", sub: "Workforce, materials, work done", icon: ClipboardList },
];

export function SiteNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  const tr = useT();
  const [open, setOpen] = useState(false);
  if (/^\/site\/(add-progress|report-issue|site-update)/.test(path)) return null; // focused capture flows
  const tab = (t: (typeof TABS)[number]) => {
    const active = t.href === "/site" ? path === "/site" : path.startsWith(t.href);
    const Icon = t.icon;
    return (
      <Link key={t.href} href={t.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]", active ? "font-semibold text-river" : "text-muted")}>
        <Icon className="size-[22px]" />{tr(t.label)}
        {t.label === "More" && unread > 0 && <span className="absolute right-[26%] top-1.5 size-2 rounded-full bg-laterite" />}
      </Link>
    );
  };
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-river-deep/50 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-3xl bg-ivory p-5 pb-28" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quick actions">
            <div className="mb-4 flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{tr("Quick actions")}</p><button onClick={() => setOpen(false)} aria-label="Close" className="flex size-8 items-center justify-center rounded-full bg-white"><X className="size-4" /></button></div>
            <div className="space-y-3">
              {ACTIONS.map((a) => (
                <Link key={a.href} href={a.href} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 active:scale-[.99]">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-river text-ivory"><a.icon className="size-6" /></span>
                  <span><span className="block text-base font-semibold">{tr(a.label)}</span><span className="text-sm text-muted">{tr(a.sub)}</span></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
        <div className="flex items-end px-2">
          {tab(TABS[0])}{tab(TABS[1])}
          <div className="flex flex-1 justify-center">
            <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Close quick actions" : "Open quick actions"} aria-expanded={open} className="-mt-5 flex size-16 items-center justify-center rounded-full bg-river text-ivory shadow-lg ring-4 ring-ivory active:scale-95">
              <Plus className={cn("size-8 transition", open && "rotate-45")} />
            </button>
          </div>
          {tab(TABS[2])}{tab(TABS[3])}
        </div>
      </nav>
    </>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, ListChecks, TriangleAlert, Images, Users, HardHat, Package, Truck, Wallet, Receipt, FileText, BarChart3, Settings, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href?: string; label: string; icon: React.ComponentType<{ className?: string }> };
const GROUPS: { label: string; items: Item[] }[] = [
  { label: "", items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }] },
  { label: "Projects", items: [{ href: "/projects", label: "All Projects", icon: FolderKanban }] },
  { label: "Operations", items: [{ href: "/tasks", label: "Tasks", icon: ListChecks }, { label: "Workforce", icon: HardHat }, { label: "Materials", icon: Package }, { label: "Procurement", icon: Truck }] },
  { label: "Site", items: [{ href: "/photos", label: "Progress Photos", icon: Images }, { href: "/issues", label: "Issues", icon: TriangleAlert }] },
  { label: "Finance", items: [{ label: "Budget", icon: Wallet }, { label: "Expenses", icon: Receipt }] },
  { label: "Documents", items: [{ label: "Documents", icon: FileText }] },
  { label: "Insights", items: [{ label: "Analytics", icon: BarChart3 }] },
  { label: "Company", items: [{ href: "/team", label: "Team", icon: Users }, { label: "Settings", icon: Settings }] },
];

export function NavLinks({ onDark = true }: { onDark?: boolean }) {
  const path = usePathname();
  return (
    <nav className="space-y-5">
      {GROUPS.map((g, gi) => (
        <div key={gi}>
          {g.label && <p className={cn("mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.2em]", onDark ? "text-ivory/40" : "text-muted")}>{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = it.href && (path === it.href || (it.href !== "/dashboard" && path.startsWith(it.href)));
              const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px]";
              return (
                <li key={it.label}>
                  {it.href ? (
                    <Link href={it.href} aria-current={active ? "page" : undefined} className={cn(base, "transition", active ? "bg-ivory/12 font-medium text-ivory" : "text-ivory/70 hover:bg-ivory/8 hover:text-ivory")}>
                      <Icon className="size-4" />{it.label}
                    </Link>
                  ) : (
                    <span className={cn(base, "cursor-default text-ivory/35")} title="Coming soon"><Icon className="size-4" />{it.label}<span className="ml-auto rounded bg-ivory/10 px-1.5 py-px text-[9px] uppercase tracking-wider">Soon</span></span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Link href="/site" className="mt-2 flex items-center gap-3 rounded-lg border border-ivory/15 px-3 py-2 text-[13px] text-ivory/80 hover:bg-ivory/8"><Smartphone className="size-4" />Open ZUARI Site</Link>
    </nav>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, ListChecks, TriangleAlert, Images, Users, HardHat, Package, Truck, Wallet, Receipt, FileText, BarChart3, Settings, Smartphone, CalendarDays, MapPin, GanttChartSquare, Building2, Store, Banknote, FileBarChart, Ruler, ClipboardCheck, ShieldCheck, ReceiptText, ArrowDownUp, Sparkles, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "DIRECTOR" | "PROJECT_MANAGER" | "ACCOUNTANT";
type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: Role[] };
const MGR: Role[] = ["DIRECTOR", "PROJECT_MANAGER"], FIN: Role[] = ["DIRECTOR", "ACCOUNTANT"], ALL: Role[] = ["DIRECTOR", "PROJECT_MANAGER", "ACCOUNTANT"];
const GROUPS: { label: string; items: Item[] }[] = [
  { label: "", items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }] },
  { label: "Projects", items: [{ href: "/projects", label: "All Projects", icon: FolderKanban }, { href: "/timeline", label: "Timeline", icon: GanttChartSquare }, { href: "/calendar", label: "Calendar", icon: CalendarDays }, { href: "/map", label: "Map", icon: MapPin }] },
  { label: "Operations", items: [{ href: "/tasks", label: "Tasks", icon: ListChecks, roles: MGR }, { href: "/workforce", label: "Workforce", icon: HardHat, roles: MGR }, { href: "/contractors", label: "Contractors", icon: Building2 }, { href: "/materials", label: "Materials", icon: Package, roles: MGR }, { href: "/inventory", label: "Inventory", icon: Boxes }, { href: "/procurement", label: "Procurement", icon: Truck }, { href: "/suppliers", label: "Suppliers", icon: Store }] },
  { label: "Finance", items: [{ href: "/bills", label: "Contractor bills", icon: ReceiptText },
  { href: "/budget", label: "Budget", icon: Wallet, roles: FIN }, { href: "/expenses", label: "Expenses", icon: Receipt, roles: FIN }, { href: "/payments", label: "Payments", icon: Banknote, roles: FIN }] },
  { label: "Site", items: [{ href: "/photos", label: "Progress Photos", icon: Images, roles: MGR }, { href: "/inspections", label: "Inspections", icon: ClipboardCheck, roles: MGR }, { href: "/safety", label: "Safety", icon: ShieldCheck, roles: MGR }, { href: "/issues", label: "Issues", icon: TriangleAlert, roles: MGR }] },
  { label: "Documents", items: [{ href: "/documents", label: "Documents", icon: FileText }, { href: "/drawings", label: "Drawings", icon: Ruler, roles: MGR }] },
  { label: "Insights", items: [{ href: "/ask", label: "Ask ZUARI", icon: Sparkles }, { href: "/analytics", label: "Analytics", icon: BarChart3 }, { href: "/reports", label: "Reports", icon: FileBarChart, roles: MGR }, { href: "/exports", label: "Export & import", icon: ArrowDownUp }] },
  { label: "Company", items: [{ href: "/team", label: "Team", icon: Users, roles: MGR }, { href: "/settings", label: "Settings", icon: Settings, roles: ["DIRECTOR"] }] },
];

export function NavLinks({ role }: { role: string }) {
  const path = usePathname();
  return (
    <nav className="space-y-5">
      {GROUPS.map((g, gi) => {
        const items = g.items.filter((i) => (i.roles ?? ALL).includes(role as Role));
        if (!items.length) return null;
        return (
          <div key={gi}>
            {g.label && <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-ivory/40">{g.label}</p>}
            <ul className="space-y-0.5">
              {items.map((it) => {
                const Icon = it.icon, active = path === it.href || (it.href !== "/dashboard" && path.startsWith(it.href + "/")) || (it.href !== "/dashboard" && path === it.href);
                return <li key={it.href}><Link href={it.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition", active ? "bg-ivory/12 font-medium text-ivory" : "text-ivory/70 hover:bg-ivory/8 hover:text-ivory")}><Icon className="size-4" />{it.label}</Link></li>;
              })}
            </ul>
          </div>
        );
      })}
      <Link href="/site" className="mt-2 flex items-center gap-3 rounded-lg border border-ivory/15 px-3 py-2 text-[13px] text-ivory/80 hover:bg-ivory/8"><Smartphone className="size-4" />Open ZUARI Site</Link>
    </nav>
  );
}

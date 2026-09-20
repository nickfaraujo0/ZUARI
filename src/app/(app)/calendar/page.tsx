import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFinance, isManager, issueScope, projectScope, taskScope } from "@/lib/access";
import { Card, PageHeader, Select } from "@/components/ui";
import { addDays, cn, dayKey, monthKey, startOfToday } from "@/lib/utils";

export const metadata = { title: "Calendar" };
type Ev = { day: string; label: string; href: string; kind: "task" | "phase" | "issue" | "po" | "project" };
const STYLE: Record<Ev["kind"], string> = { task: "bg-river/10 text-river-deep", phase: "bg-sand-soft text-[#6b562d]", issue: "bg-red-50 text-red-800", po: "bg-teal/15 text-teal", project: "bg-laterite/15 text-laterite" };
const LEGEND: [Ev["kind"], string][] = [["task", "Task due"], ["phase", "Phase ends"], ["issue", "Issue due"], ["po", "Delivery expected"], ["project", "Project completion"]];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; project?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const today = startOfToday();
  const m = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : monthKey(today);
  const first = new Date(`${m}-01T00:00:00+05:30`);
  const wd = (new Date(first.getTime() + 5.5 * 3600e3).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(first, -wd), end = addDays(start, 42);
  const shift = (n: number) => { const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + (first.getUTCHours() >= 18 ? 1 : 0) + n, 1)); return d.toISOString().slice(0, 7); };
  const projects = await prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true, expectedEnd: true }, orderBy: { name: "asc" } });
  const ids = sp.project && projects.some((p) => p.id === sp.project) ? [sp.project] : projects.map((p) => p.id);
  const inRange = { gte: start, lt: end };
  const [tasks, phases, issues, pos] = await Promise.all([
    prisma.task.findMany({ where: { ...taskScope(u), projectId: { in: ids }, dueDate: inRange }, select: { id: true, title: true, dueDate: true, status: true, projectId: true } }),
    prisma.projectPhase.findMany({ where: { companyId: u.companyId, projectId: { in: ids }, endDate: inRange }, include: { project: { select: { name: true } } } }),
    prisma.issue.findMany({ where: { ...issueScope(u), projectId: { in: ids }, dueDate: inRange, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } }, select: { id: true, title: true, dueDate: true, projectId: true } }),
    isManager(u) || isFinance(u) ? prisma.purchaseOrder.findMany({ where: { companyId: u.companyId, projectId: { in: ids }, expectedDate: inRange, status: { in: ["APPROVED", "ORDERED"] } }, include: { supplier: { select: { name: true } } } }) : [],
  ]);
  const ev: Ev[] = [
    ...tasks.map((t) => ({ day: dayKey(t.dueDate!), label: `${t.status === "COMPLETED" || t.status === "VERIFIED" ? "✓ " : ""}${t.title}`, href: isManager(u) ? `/projects/${t.projectId}/tasks/${t.id}` : `/projects/${t.projectId}/tasks`, kind: "task" as const })),
    ...phases.map((p) => ({ day: dayKey(p.endDate), label: `${p.project.name}: ${p.name} ends`, href: `/projects/${p.projectId}/timeline`, kind: "phase" as const })),
    ...issues.map((i) => ({ day: dayKey(i.dueDate!), label: i.title, href: `/projects/${i.projectId}/issues`, kind: "issue" as const })),
    ...pos.map((o) => ({ day: dayKey(o.expectedDate!), label: `${o.number} · ${o.supplier.name}`, href: `/procurement/${o.id}`, kind: "po" as const })),
    ...projects.filter((p) => ids.includes(p.id) && p.expectedEnd >= start && p.expectedEnd < end).map((p) => ({ day: dayKey(p.expectedEnd), label: `${p.name} completion`, href: `/projects/${p.id}`, kind: "project" as const })),
  ];
  const byDay = new Map<string, Ev[]>();
  for (const e of ev) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const title = first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return (
    <>
      <PageHeader title="Calendar" sub="Deadlines, phase ends, deliveries and completions." actions={
        <form className="flex items-center gap-2"><input type="hidden" name="m" value={m} /><Select name="project" defaultValue={sp.project} placeholder="All projects" options={projects.map((p) => ({ value: p.id, label: p.name }))} className="h-9 w-48" /><button className="h-9 rounded-lg bg-river px-3 text-sm font-medium text-ivory">Filter</button></form>} />
      <Card>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-serif text-2xl font-semibold text-river-deep">{title}</h2>
          <div className="flex items-center gap-1"><Link href={`?m=${shift(-1)}${sp.project ? `&project=${sp.project}` : ""}`} aria-label="Previous month" className="flex size-9 items-center justify-center rounded-lg hover:bg-stone-100"><ChevronLeft className="size-4" /></Link><Link href={`?m=${monthKey(today)}${sp.project ? `&project=${sp.project}` : ""}`} className="rounded-lg px-3 py-1.5 text-sm hover:bg-stone-100">Today</Link><Link href={`?m=${shift(1)}${sp.project ? `&project=${sp.project}` : ""}`} aria-label="Next month" className="flex size-9 items-center justify-center rounded-lg hover:bg-stone-100"><ChevronRight className="size-4" /></Link></div>
        </div>
        <div className="overflow-x-auto"><div className="min-w-[860px]">
          <div className="grid grid-cols-7 border-y border-line bg-stone-50/60 text-center text-[11px] uppercase tracking-wider text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => addDays(start, i)).map((d) => {
              const k = dayKey(d), list = byDay.get(k) ?? [], inMonth = k.slice(0, 7) === m, isToday = d.getTime() === today.getTime();
              return (
                <div key={k} className={cn("min-h-[104px] border-b border-r border-line/70 p-1.5", !inMonth && "bg-stone-50/50")}>
                  <p className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs", isToday ? "bg-laterite font-semibold text-white" : inMonth ? "text-charcoal" : "text-muted/50")}>{Number(k.slice(8))}</p>
                  <ul className="space-y-1">{list.slice(0, 3).map((e, i) => <li key={i}><Link href={e.href} title={e.label} className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] leading-tight hover:brightness-95", STYLE[e.kind])}>{e.label}</Link></li>)}{list.length > 3 && <li className="px-1 text-[11px] text-muted">+{list.length - 3} more</li>}</ul>
                </div>);
            })}
          </div>
        </div></div>
        <div className="flex flex-wrap gap-4 border-t border-line px-5 py-3 text-xs text-muted">{LEGEND.map(([k, l]) => <span key={k} className="flex items-center gap-1.5"><span className={cn("size-3 rounded", STYLE[k])} />{l}</span>)}</div>
      </Card>
    </>
  );
}

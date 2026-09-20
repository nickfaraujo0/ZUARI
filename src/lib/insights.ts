import "server-only";
import { prisma } from "./db";
import { isFinance, isManager } from "./access";
import type { SessionUser } from "./auth";
import { portfolio } from "./queries";
import { stockFor } from "./materials";
import { financeFor } from "./finance";
import { startOfToday, formatINR, type Health } from "./utils";

export type Factor = { text: string; href: string };
export type Insight = { projectId: string; name: string; code: string; level: Health; progress: number; planned: number; factors: Factor[] };
const DAY = 864e5;

/** Explains each project's health with concrete, linked contributing factors (no AI involved). */
export async function insightsFor(u: SessionUser): Promise<Insight[]> {
  const projects = await portfolio(u);
  const ids = projects.map((p) => p.id), today = startOfToday(), month = new Date(today.getTime() - 30 * DAY);
  const [overdue, issues, fails, delays, fin] = await Promise.all([
    prisma.task.findMany({ where: { companyId: u.companyId, projectId: { in: ids }, dueDate: { lt: today }, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } }, select: { projectId: true, title: true, dueDate: true }, orderBy: { dueDate: "asc" } }),
    prisma.issue.findMany({ where: { companyId: u.companyId, projectId: { in: ids }, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] }, severity: { in: ["HIGH", "CRITICAL"] } }, select: { projectId: true, title: true, severity: true } }),
    prisma.inspection.findMany({ where: { companyId: u.companyId, projectId: { in: ids }, status: "FAILED", children: { none: { status: "PASSED" } } }, select: { projectId: true, title: true } }),
    prisma.delayLog.groupBy({ by: ["projectId", "cause"], where: { companyId: u.companyId, projectId: { in: ids }, date: { gte: month } }, _sum: { days: true } }),
    isFinance(u) ? financeFor(u.companyId, projects) : null,
  ]);
  const materials = isManager(u) ? await prisma.material.findMany({ where: { companyId: u.companyId, reorderLevel: { gt: 0 } } }) : [];
  const out: Insight[] = [];
  for (const p of projects) {
    const planned = Math.round(Math.max(0, Math.min(1, (today.getTime() - p.startDate.getTime()) / (p.expectedEnd.getTime() - p.startDate.getTime()))) * 100);
    const f: Factor[] = [], href = `/projects/${p.id}`;
    if (p.status === "ACTIVE" && p.progress < planned - 8) f.push({ text: `Progress is ${planned - p.progress} points behind the time elapsed (${p.progress}% done vs ${planned}% of the schedule used).`, href: `${href}/timeline` });
    for (const ph of p.phases.filter((x) => x.endDate < today && x.progress < 100).slice(0, 2)) f.push({ text: `${ph.name} was due ${Math.round((today.getTime() - ph.endDate.getTime()) / DAY)} days ago and is ${ph.progress}% complete.`, href: `${href}/timeline` });
    const od = overdue.filter((t) => t.projectId === p.id);
    if (od.length) f.push({ text: `${od.length} overdue task${od.length > 1 ? "s" : ""}, oldest: “${od[0].title}” (${Math.round((today.getTime() - od[0].dueDate!.getTime()) / DAY)} days late).`, href: `${href}/tasks` });
    const iss = issues.filter((i) => i.projectId === p.id);
    if (iss.length) f.push({ text: `${iss.length} serious open issue${iss.length > 1 ? "s" : ""}: ${iss.slice(0, 2).map((i) => `“${i.title}”`).join(", ")}.`, href: `${href}/issues` });
    const fl = fails.filter((i) => i.projectId === p.id);
    if (fl.length) f.push({ text: `${fl.length} failed inspection${fl.length > 1 ? "s" : ""} not yet cleared: ${fl.slice(0, 2).map((i) => i.title).join(", ")}.`, href: "/inspections" });
    const dl = delays.filter((d) => d.projectId === p.id), days = dl.reduce((s, d) => s + (d._sum.days ?? 0), 0);
    if (days >= 2) { const top = [...dl].sort((a, b) => (b._sum.days ?? 0) - (a._sum.days ?? 0))[0]; f.push({ text: `${days} day${days === 1 ? "" : "s"} lost to delays in the last 30 days, mostly ${top.cause.toLowerCase()}.`, href: `${href}/timeline` }); }
    if (materials.length) { const s = await stockFor(u.companyId, p.id), low = materials.filter((m) => s.has(m.id) && (s.get(m.id)!.stock ?? 0) <= m.reorderLevel); if (low.length) f.push({ text: `Low stock: ${low.slice(0, 3).map((m) => m.name).join(", ")}.`, href: "/materials" }); }
    const fi = fin?.get(p.id);
    if (fi && fi.budget && p.progress < 100 && (fi.spent + fi.committed) / fi.budget > (p.progress / 100) * 1.15 + 0.05) f.push({ text: `Spend and commitments (${formatINR(fi.spent + fi.committed)}) are running ahead of progress (${p.progress}% of ${formatINR(fi.budget)}).`, href: "/budget" });
    out.push({ projectId: p.id, name: p.name, code: p.code, level: p.health, progress: p.progress, planned, factors: f });
  }
  return out;
}

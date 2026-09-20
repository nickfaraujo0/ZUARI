import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFinance, issueScope, projectScope, taskScope } from "@/lib/access";
import { portfolio } from "@/lib/queries";
import { Bars, CHART, Donut, Legend } from "@/components/charts";
import { Card, CardHead, Chip, PageHeader, Progress, Stat } from "@/components/ui";
import { addDays, EXPENSE_CATEGORY, fmtShort, formatINR, SEVERITY, startOfToday } from "@/lib/utils";

export const metadata = { title: "Analytics" };
const IST = 5.5 * 3600e3, DAY = 864e5;

export default async function Analytics() {
  const u = await requireUser();
  const today = startOfToday();
  const monday = addDays(today, -((new Date(today.getTime() + IST).getUTCDay() + 6) % 7));
  const w0 = addDays(monday, -49);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(w0, i * 7));
  const bucket = <T,>(rows: T[], at: (r: T) => Date | null, w: (r: T) => number = () => 1) => weeks.map((s) => ({ label: fmtShort(s), value: Math.round(rows.reduce((n, r) => { const d = at(r); return d && d >= s && d < addDays(s, 7) ? n + w(r) : n; }, 0) * 10) / 10 }));
  const projects = await portfolio(u);
  const ids = projects.map((p) => p.id);
  const finance = isFinance(u);
  const [done, doneAll, photos, issues, resolved, att, statusCounts, open, expenses] = await Promise.all([
    prisma.task.findMany({ where: { ...taskScope(u), completedAt: { gte: w0 } }, select: { completedAt: true } }),
    prisma.task.findMany({ where: { ...taskScope(u), completedAt: { not: null }, dueDate: { not: null } }, select: { completedAt: true, dueDate: true } }),
    prisma.progressPhoto.findMany({ where: { companyId: u.companyId, projectId: { in: ids }, takenAt: { gte: w0 } }, select: { takenAt: true } }),
    prisma.issue.findMany({ where: { ...issueScope(u), createdAt: { gte: w0 } }, select: { createdAt: true } }),
    prisma.issue.findMany({ where: { ...issueScope(u), resolvedAt: { not: null } }, select: { createdAt: true, resolvedAt: true } }),
    prisma.attendance.findMany({ where: { companyId: u.companyId, projectId: { in: ids }, date: { gte: w0 }, status: { not: "ABSENT" } }, select: { date: true, status: true } }),
    prisma.task.groupBy({ by: ["status"], where: taskScope(u), _count: true }),
    prisma.issue.groupBy({ by: ["severity"], where: { ...issueScope(u), status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } }, _count: true }),
    finance ? prisma.expense.groupBy({ by: ["category"], where: { companyId: u.companyId, project: projectScope(u), status: { in: ["APPROVED", "PAID"] } }, _sum: { amount: true } }) : [],
  ]);
  const onTime = doneAll.length ? Math.round((doneAll.filter((t) => t.completedAt!.getTime() < t.dueDate!.getTime() + DAY).length / doneAll.length) * 100) : null;
  const avgResolve = resolved.length ? Math.round((resolved.reduce((s, i) => s + (i.resolvedAt!.getTime() - i.createdAt.getTime()), 0) / resolved.length / DAY) * 10) / 10 : null;
  const plan = (p: (typeof projects)[number]) => Math.round(Math.max(0, Math.min(1, (today.getTime() - p.startDate.getTime()) / (p.expectedEnd.getTime() - p.startDate.getTime()))) * 100);
  const catColors = ["#123C36", "#3F6868", "#7EA7A1", "#D6C3A0", "#9A6047", "#8a8f8d"];
  const cats = Object.entries(EXPENSE_CATEGORY).map(([k, l], i) => ({ label: l, value: Number(expenses.find((e) => e.category === k)?._sum.amount ?? 0), color: catColors[i] }));
  const spendTotal = cats.reduce((s, c) => s + c.value, 0);
  return (
    <>
      <PageHeader title="Analytics" sub="Schedule performance and site activity over the last 8 weeks." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="On-time completion" value={onTime == null ? "—" : `${onTime}%`} sub="tasks finished by their due date" /><Stat label="Avg. issue resolution" value={avgResolve == null ? "—" : `${avgResolve} d`} sub={`${resolved.length} resolved`} />
        <Stat label="Photos, last 8 weeks" value={photos.length} /><Stat label="Open issues" value={open.reduce((s, o) => s + o._count, 0)} tone={open.some((o) => o.severity === "CRITICAL" || o.severity === "HIGH") ? "amber" : undefined} />
      </div>
      <Card className="mb-6">
        <CardHead title="Schedule performance" sub="Planned progress (time elapsed) versus actual progress" />
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Project</th><th className="px-3 font-medium">Planned</th><th className="px-3 font-medium">Actual</th><th className="px-3 text-right font-medium">Variance</th><th className="px-5 font-medium">Verdict</th></tr></thead>
          <tbody>{projects.map((p) => { const pl = plan(p), v = p.progress - pl; return (
            <tr key={p.id} className="border-b border-line/70 last:border-0"><td className="px-5 py-3 font-medium">{p.name}</td><td className="px-3"><div className="flex w-36 items-center gap-2"><Progress value={pl} tone="teal" thin /><span className="w-9 text-xs tabular-nums">{pl}%</span></div></td><td className="px-3"><div className="flex w-36 items-center gap-2"><Progress value={p.progress} thin /><span className="w-9 text-xs tabular-nums">{p.progress}%</span></div></td><td className={`px-3 text-right tabular-nums ${v < -10 ? "font-medium text-red-700" : ""}`}>{v > 0 ? "+" : ""}{v} pts</td><td className="px-5"><Chip tone={v >= -5 ? "green" : v >= -15 ? "amber" : "red"} dot>{v >= 5 ? "Ahead" : v >= -5 ? "On schedule" : v >= -15 ? "Slipping" : "Behind"}</Chip></td></tr>); })}</tbody></table></div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><h2 className="mb-1 text-[15px] font-semibold">Tasks completed per week</h2><p className="mb-3 text-xs text-muted">Throughput of finished work</p><Bars data={bucket(done, (t) => t.completedAt)} /></Card>
        <Card className="p-5"><h2 className="mb-1 text-[15px] font-semibold">Progress photos per week</h2><p className="mb-3 text-xs text-muted">Evidence captured on site</p><Bars data={bucket(photos, (p) => p.takenAt)} color={CHART.committed} /></Card>
        <Card className="p-5"><h2 className="mb-1 text-[15px] font-semibold">Issues raised per week</h2><p className="mb-3 text-xs text-muted">New snags reported</p><Bars data={bucket(issues, (i) => i.createdAt)} color="#9A6047" /></Card>
        <Card className="p-5"><h2 className="mb-1 text-[15px] font-semibold">Worker-days on site per week</h2><p className="mb-3 text-xs text-muted">Half day counts as 0.5</p><Bars data={bucket(att, (a) => a.date, (a) => (a.status === "HALF" ? 0.5 : 1))} color={CHART.remaining} /></Card>
        <Card className="p-5"><h2 className="mb-4 text-[15px] font-semibold">Task status</h2>
          <div className="flex items-center gap-6"><Donut size={140} thickness={20} parts={[["NOT_STARTED", "Not started", "#D6C3A0"], ["IN_PROGRESS", "In progress", "#7EA7A1"], ["COMPLETED", "Completed", "#3F6868"], ["VERIFIED", "Verified", "#123C36"]].map(([k, l, c]) => ({ label: l, color: c, value: statusCounts.find((s) => s.status === k)?._count ?? 0 }))}><p className="text-xl font-semibold">{statusCounts.reduce((s, x) => s + x._count, 0)}</p><p className="text-[11px] text-muted">tasks</p></Donut>
            <Legend items={[["NOT_STARTED", "Not started", "#D6C3A0"], ["IN_PROGRESS", "In progress", "#7EA7A1"], ["COMPLETED", "Completed", "#3F6868"], ["VERIFIED", "Verified", "#123C36"]].map(([k, l, c]) => ({ label: l, color: c, value: String(statusCounts.find((s) => s.status === k)?._count ?? 0) }))} /></div></Card>
        <Card className="p-5"><h2 className="mb-4 text-[15px] font-semibold">Open issues by severity</h2>
          <Legend items={(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((k, i) => ({ label: SEVERITY[k], color: ["#c0392b", "#d99a1c", "#D6C3A0", "#8a8f8d"][i], value: String(open.find((o) => o.severity === k)?._count ?? 0) }))} /></Card>
        {finance && <Card className="p-5 lg:col-span-2"><h2 className="mb-4 text-[15px] font-semibold">Spend by category</h2>
          {spendTotal ? <div className="flex flex-wrap items-center gap-8"><Donut size={160} thickness={22} parts={cats}><p className="text-lg font-semibold">{formatINR(spendTotal)}</p><p className="text-[11px] text-muted">approved + paid</p></Donut><div className="min-w-56 flex-1"><Legend items={cats.filter((c) => c.value).map((c) => ({ label: c.label, color: c.color, value: formatINR(c.value) }))} /></div></div> : <p className="text-sm text-muted">No approved expenses yet.</p>}</Card>}
      </div>
    </>
  );
}

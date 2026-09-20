import Link from "next/link";
import { HardHat } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, projectScope, requireManagerPage } from "@/lib/access";
import { createWorker, updateWorker } from "@/actions/workforce";
import { ActionForm } from "@/components/forms";
import { AttendanceSheet } from "@/components/attendance-sheet";
import { Card, CardHead, Chip, EmptyState, Field, inputCls, PageHeader, Select, Stat } from "@/components/ui";
import { addDays, dayKey, fmtShort, inr, parseDate, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Workforce" };

export default async function Workforce({ searchParams }: { searchParams: Promise<{ project?: string; date?: string }> }) {
  const u = await requireUser();
  requireManagerPage(u);
  const sp = await searchParams;
  const today = startOfToday();
  const day = parseDate(sp.date) && parseDate(sp.date)! <= today ? parseDate(sp.date)! : today;
  const [projects, workers, contractors] = await Promise.all([
    prisma.project.findMany({ where: { ...projectScope(u), status: { in: ["ACTIVE", "PLANNING"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.worker.findMany({ where: { companyId: u.companyId }, include: { contractor: { select: { name: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.contractor.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pid = projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id;
  const active = workers.filter((w) => w.active);
  const [existing, week] = await Promise.all([
    pid ? prisma.attendance.findMany({ where: { companyId: u.companyId, projectId: pid, date: day } }) : [],
    prisma.attendance.findMany({ where: { companyId: u.companyId, projectId: { in: projects.map((p) => p.id) }, date: { gte: addDays(today, -6), lte: today } }, include: { worker: { select: { dailyRate: true } } } }),
  ]);
  const ex = Object.fromEntries(existing.map((a) => [a.workerId, { status: a.status, ot: a.overtimeHours }]));
  const presentToday = week.filter((a) => a.date.getTime() === today.getTime() && a.status !== "ABSENT").length;
  const labour = week.reduce((s, a) => s + Number(a.worker.dailyRate) * (a.status === "PRESENT" ? 1 : a.status === "HALF" ? 0.5 : 0), 0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const canEdit = isManager(u);
  return (
    <>
      <PageHeader title="Workforce" sub="Workers, trades and daily attendance across your sites." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active workers" value={active.length} sub={`${workers.length - active.length} inactive`} /><Stat label="Present today" value={presentToday} sub="across all sites" />
        <Stat label="Trades" value={new Set(active.map((w) => w.trade)).size} /><Stat label="Labour, last 7 days" value={inr(labour)} sub="from attendance × daily rate" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card>
            <CardHead title="Attendance" sub={fmtShort(day)} />
            <form className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-3">
              <label className="text-[11px] text-muted">Project<Select name="project" defaultValue={pid} options={projects.map((p) => ({ value: p.id, label: p.name }))} className="mt-1 h-9 w-56" /></label>
              <label className="text-[11px] text-muted">Date<input type="date" name="date" max={toInputDate(today)} defaultValue={toInputDate(day)} className={`${inputCls} mt-1 h-9 w-40`} /></label>
              <button className="h-9 rounded-lg bg-river px-4 text-sm font-medium text-ivory">Load</button>
            </form>
            <div className="p-5 pt-2">
              {!pid ? <EmptyState title="No active projects" /> : !active.length ? <EmptyState icon={<HardHat className="size-5" />} title="Add workers first" body="Add your workforce on the right, then mark daily attendance here or from ZUARI Site." /> : <AttendanceSheet projectId={pid} date={toInputDate(day)} workers={active} existing={ex} />}
            </div>
          </Card>
          <Card>
            <CardHead title="Last 7 days" sub="Worker-days on site (half day = 0.5)" />
            <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2 font-medium">Project</th>{days.map((d) => <th key={dayKey(d)} className="px-2 text-center font-medium">{fmtShort(d)}</th>)}</tr></thead>
              <tbody>{projects.map((p) => <tr key={p.id} className="border-b border-line/70 last:border-0"><td className="px-5 py-2.5 font-medium"><Link href={`/projects/${p.id}`} className="hover:underline">{p.name}</Link></td>{days.map((d) => { const v = week.filter((a) => a.projectId === p.id && a.date.getTime() === d.getTime()).reduce((s, a) => s + (a.status === "PRESENT" ? 1 : a.status === "HALF" ? 0.5 : 0), 0); return <td key={dayKey(d)} className={`px-2 text-center tabular-nums ${v ? "" : "text-muted/50"}`}>{v || "·"}</td>; })}</tr>)}</tbody></table></div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHead title="Workers" sub={`${active.length} active`} />
            <ul className="max-h-[520px] divide-y divide-line/70 overflow-y-auto border-t border-line/70">
              {workers.map((w) => (
                <li key={w.id} className={`px-5 py-3 ${w.active ? "" : "opacity-60"}`}>
                  <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{w.name}</p><p className="text-xs text-muted">{w.trade}{w.contractor ? ` · ${w.contractor.name}` : ""} · {inr(Number(w.dailyRate))}/day</p></div>{!w.active && <Chip>Inactive</Chip>}</div>
                  {canEdit && (
                    <details className="mt-1.5"><summary className="cursor-pointer text-xs font-medium text-river">Edit</summary>
                      <ActionForm action={updateWorker} submit="Save" size="sm" variant="secondary" className="mt-3 grid gap-3 rounded-lg border border-line bg-stone-50 p-3">
                        <input type="hidden" name="id" value={w.id} />
                        <Field label="Name"><input name="name" required defaultValue={w.name} className={inputCls} /></Field>
                        <Field label="Trade"><input name="trade" required defaultValue={w.trade} className={inputCls} /></Field>
                        <Field label="Daily rate (₹)"><input name="dailyRate" type="number" min={0} defaultValue={Number(w.dailyRate)} className={inputCls} /></Field>
                        <Field label="Phone"><input name="phone" defaultValue={w.phone ?? ""} className={inputCls} /></Field>
                        <Field label="Contractor"><Select name="contractorId" defaultValue={w.contractorId} placeholder="Direct employee" options={contractors.map((c) => ({ value: c.id, label: c.name }))} /></Field>
                        <Field label="Status"><Select name="active" defaultValue={String(w.active)} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} /></Field>
                      </ActionForm></details>
                  )}
                </li>
              ))}
              {!workers.length && <li className="px-5 py-8 text-center text-sm text-muted">No workers yet.</li>}
            </ul>
          </Card>
          {canEdit && (
            <Card className="p-5"><h2 className="mb-4 text-[15px] font-semibold">Add a worker</h2>
              <ActionForm action={createWorker} reset submit="Add worker" className="grid gap-3">
                <Field label="Name"><input name="name" required className={inputCls} /></Field>
                <Field label="Trade"><input name="trade" required className={inputCls} placeholder="Mason, Electrician, Helper…" /></Field>
                <Field label="Daily rate (₹)"><input name="dailyRate" type="number" min={0} required defaultValue={800} className={inputCls} /></Field>
                <Field label="Phone"><input name="phone" className={inputCls} /></Field>
                <Field label="Contractor"><Select name="contractorId" placeholder="Direct employee" options={contractors.map((c) => ({ value: c.id, label: c.name }))} /></Field>
              </ActionForm></Card>
          )}
        </div>
      </div>
    </>
  );
}

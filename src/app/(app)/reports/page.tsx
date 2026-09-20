import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, projectScope } from "@/lib/access";
import { Card, Field, inputCls, PageHeader, Select } from "@/components/ui";
import { addDays, fmtDay, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default async function Reports({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await requireUser();
  if (!isManager(u)) notFound();
  const projects = await prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } });
  const sp = await searchParams;
  const pid = projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id;
  const today = startOfToday();
  return (
    <>
      <PageHeader title="Reports" sub="Daily site reports are assembled automatically from what your team captured." />
      <Card className="max-w-2xl p-6">
        <h2 className="mb-1 text-[15px] font-semibold">Daily site report</h2><p className="mb-4 text-xs text-muted">Workforce, work completed, materials, issues and photos for one project and day.</p>
        <form action="/reports/daily" className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <Field label="Project"><Select name="project" required defaultValue={pid} options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
          <Field label="Date"><input type="date" name="date" required max={toInputDate(today)} defaultValue={toInputDate(today)} className={inputCls} /></Field>
          <button className="h-10 rounded-lg bg-river px-5 text-sm font-medium text-ivory">Generate</button>
        </form>
        {pid && <div className="mt-6 border-t border-line pt-4"><p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">Recent days</p><div className="flex flex-wrap gap-2">{Array.from({ length: 7 }, (_, i) => addDays(today, -i)).map((d) => <Link key={d.getTime()} href={`/reports/daily?project=${pid}&date=${toInputDate(d)}`} className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-stone-50">{fmtDay(d)}</Link>)}</div></div>}
      </Card>
    </>
  );
}

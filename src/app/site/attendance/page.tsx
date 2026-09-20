import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { AttendanceSheet } from "@/components/attendance-sheet";
import { SiteHeader } from "@/components/site-ui";
import { tFor } from "@/lib/i18n";
import { cn, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Attendance" };

export default async function SiteAttendance({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await requireUser();
  const tr = tFor(u.locale);
  const today = startOfToday();
  const projects = await prisma.project.findMany({ where: { ...projectScope(u), status: { not: "COMPLETED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const sp = await searchParams;
  const pid = projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id;
  const [workers, existing] = await Promise.all([
    prisma.worker.findMany({ where: { companyId: u.companyId, active: true }, include: { contractor: { select: { name: true } } }, orderBy: { name: "asc" } }),
    pid ? prisma.attendance.findMany({ where: { companyId: u.companyId, projectId: pid, date: today } }) : [],
  ]);
  return (
    <>
      <SiteHeader title={tr("Today's attendance")} back="/site/more" />
      <div className="space-y-4 p-5">
        {projects.length > 1 && <div className="flex gap-2 overflow-x-auto">{projects.map((p) => <Link key={p.id} href={`?project=${p.id}`} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset", p.id === pid ? "bg-river text-ivory ring-river" : "bg-white ring-line")}>{p.name}</Link>)}</div>}
        {!pid ? <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">You&apos;re not on an active project.</p>
          : !workers.length ? <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">No workers have been added yet. Ask your project manager to add the workforce.</p>
          : <AttendanceSheet loc={u.locale} mobile projectId={pid} date={toInputDate(today)} workers={workers} existing={Object.fromEntries(existing.map((a) => [a.workerId, { status: a.status, ot: a.overtimeHours }]))} />}
      </div>
    </>
  );
}

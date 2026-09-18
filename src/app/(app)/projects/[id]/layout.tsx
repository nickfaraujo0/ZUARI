import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/access";
import { healthOf } from "@/lib/services";
import { fmtDate, PROJECT_STATUS, startOfToday, TYPE_LABEL } from "@/lib/utils";
import { HealthChip } from "@/components/blocks";
import { ProjectTabs } from "@/components/project-tabs";
import { Photo } from "@/components/ui";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const [cover, tasks, photos, issues, overdue, severe] = await Promise.all([
    prisma.progressPhoto.findFirst({ where: { projectId: p.id }, orderBy: { takenAt: "desc" }, select: { id: true } }),
    prisma.task.count({ where: { projectId: p.id, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } } }),
    prisma.progressPhoto.count({ where: { projectId: p.id } }),
    prisma.issue.count({ where: { projectId: p.id, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { projectId: p.id, dueDate: { lt: startOfToday() }, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } } }),
    prisma.issue.count({ where: { projectId: p.id, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] }, severity: { in: ["HIGH", "CRITICAL"] } } }),
  ]);
  const health = healthOf({ status: p.status, progress: p.progress, expectedEnd: p.expectedEnd, overdue, severeIssues: severe });
  return (
    <>
      <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-river-deep via-river to-river-soft text-ivory">
        {cover && <Photo id={cover.id} className="absolute inset-0 size-full opacity-45" />}
        <div className="absolute inset-0 bg-gradient-to-r from-river-deep/90 via-river-deep/55 to-transparent" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 px-7 pb-6 pt-14">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <Link href="/projects" className="text-xs text-ivory/70 hover:text-ivory">Projects</Link><span className="text-ivory/40">/</span>
              <span className="font-mono text-xs text-ivory/70">{p.code}</span>
              <HealthChip health={health} />
              {p.status !== "ACTIVE" && <span className="rounded-full bg-ivory/15 px-2.5 py-0.5 text-xs">{PROJECT_STATUS[p.status]}</span>}
            </div>
            <h1 className="font-serif text-5xl font-semibold leading-none">{p.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ivory/80">
              <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{p.location}</span>
              <span>{TYPE_LABEL[p.type]} · {p.client}</span>
              <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{fmtDate(p.startDate)} → {fmtDate(p.expectedEnd)}</span>
            </p>
          </div>
          <div className="w-52">
            <p className="text-right text-5xl font-semibold tabular-nums leading-none">{p.progress}<span className="text-2xl text-ivory/60">%</span></p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ivory/20"><div className="h-full rounded-full bg-sand" style={{ width: `${p.progress}%` }} /></div>
            <p className="mt-1.5 text-right text-[11px] uppercase tracking-widest text-ivory/60">Overall progress</p>
          </div>
        </div>
      </div>
      <div className="rounded-b-2xl border border-t-0 border-line bg-white px-3"><ProjectTabs id={p.id} counts={{ tasks, issues, photos }} /></div>
      <div className="mt-6">{children}</div>
    </>
  );
}

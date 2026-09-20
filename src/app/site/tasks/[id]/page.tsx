import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { taskScope } from "@/lib/access";
import { TaskComments } from "@/components/comments";
import { SiteHeader } from "@/components/site-ui";
import { dueLabelT, tFor } from "@/lib/i18n";
import { Chip, Photo, Progress } from "@/components/ui";
import { fmtDate, fmtTime, PRIORITY, PRIORITY_TONE, TASK_STATUS, TASK_TONE } from "@/lib/utils";

export const metadata = { title: "Task" };

export default async function SiteTask({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const tr = tFor(u.locale);
  const t = await prisma.task.findFirst({ where: { id: (await params).id, ...taskScope(u) }, include: { project: { select: { name: true } }, phase: { select: { name: true } } } });
  if (!t) notFound();
  const updates = await prisma.progressUpdate.findMany({ where: { taskId: t.id, companyId: u.companyId }, include: { user: { select: { name: true } }, photos: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 10 });
  const comments = await prisma.taskComment.findMany({ where: { taskId: t.id, companyId: u.companyId }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <SiteHeader title={tr("Task")} back="/site/tasks" />
      <div className="space-y-5 p-5">
        <div>
          <div className="flex flex-wrap gap-2"><Chip tone={TASK_TONE[t.status]}>{tr(TASK_STATUS[t.status])}</Chip><Chip tone={PRIORITY_TONE[t.priority]}>{PRIORITY[t.priority]} priority</Chip></div>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-river-deep">{t.title}</h2>
          <p className="mt-1 text-sm text-muted">{t.project.name}{t.phase ? ` · ${t.phase.name}` : ""}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center gap-3"><Progress value={t.progress} className="flex-1" /><span className="font-semibold tabular-nums">{t.progress}%</span></div>
          <p className="mt-3 text-sm text-muted">{dueLabelT(tr, t.dueDate)}{t.dueDate ? ` · ${fmtDate(t.dueDate)}` : ""}</p>
        </div>
        {t.description && <p className="whitespace-pre-line text-[15px] leading-relaxed text-charcoal/85">{t.description}</p>}
        <Link href={`/site/add-progress?project=${t.projectId}&task=${t.id}`} className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-river text-base font-semibold text-ivory active:scale-[.98]"><Camera className="size-5" />{tr("Update this task")}</Link>
        {updates.length > 0 && (
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">{tr("History")}</h3>
            <ul className="space-y-3">{updates.map((up) => (
              <li key={up.id} className="rounded-2xl border border-line bg-white p-4">
                <p className="text-sm font-medium">{up.user.name} <span className="font-normal text-muted">· {fmtDate(up.createdAt)}, {fmtTime(up.createdAt)}</span></p>
                {up.statusAfter && up.statusAfter !== up.statusBefore && <p className="mt-1 text-sm text-river">Marked {TASK_STATUS[up.statusAfter]}</p>}
                {up.note && <p className="mt-1 text-sm text-charcoal/80">{up.note}</p>}
                {up.photos.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{up.photos.map((p) => <Photo key={p.id} id={p.id} className="size-20 shrink-0 rounded-xl" />)}</div>}
              </li>
            ))}</ul>
          </div>
        )}
        <TaskComments taskId={t.id} comments={comments} mobile />
      </div>
    </>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, requireProject } from "@/lib/access";
import { setProjectStatus } from "@/actions/projects";
import { ActionForm, AutoSelect } from "@/components/forms";
import { ActivityFeed, PhotoTile } from "@/components/blocks";
import { Avatar, Card, CardHead, Chip, LinkButton, Progress, Stat } from "@/components/ui";
import { dueLabel, formatINR, fmtDate, opts, PROJECT_STATUS, PRIORITY, PRIORITY_TONE, startOfToday, TASK_STATUS, TASK_TONE } from "@/lib/utils";

export const metadata = { title: "Project overview" };

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const [phases, upcoming, activity, photos, openIssues] = await Promise.all([
    prisma.projectPhase.findMany({ where: { projectId: p.id }, orderBy: { position: "asc" } }),
    prisma.task.findMany({ where: { projectId: p.id, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } }, include: { assignee: { select: { name: true } } }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 6 }),
    prisma.activityLog.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.progressPhoto.findMany({ where: { projectId: p.id }, include: { task: { select: { title: true } }, user: { select: { name: true } } }, orderBy: { takenAt: "desc" }, take: 4 }),
    prisma.issue.count({ where: { projectId: p.id, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
  ]);
  const left = Math.ceil((p.expectedEnd.getTime() - startOfToday().getTime()) / 864e5);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Progress" value={`${p.progress}%`} />
        <Stat label="Budget" value={formatINR(Number(p.budget))} />
        <Stat label="Completion" value={fmtDate(p.expectedEnd)} sub={left >= 0 ? `${left} days remaining` : `${-left} days past target`} tone={left < 0 && p.progress < 100 ? "red" : undefined} />
        <Stat label="Open issues" value={openIssues} tone={openIssues ? "amber" : undefined} />
        <Card className="flex flex-col justify-between p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Manager</p>
          <div className="mt-2 flex items-center gap-2.5">{p.manager && <Avatar name={p.manager.name} size={34} />}<span className="text-sm font-medium leading-tight">{p.manager?.name ?? "—"}</span></div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHead title="Construction phases" action={<Link href={`/projects/${p.id}/timeline`} className="text-xs font-medium text-river hover:underline">Open timeline</Link>} />
            <ul className="divide-y divide-line/70 border-t border-line/70">
              {phases.map((ph) => (
                <li key={ph.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-28 text-sm font-medium">{ph.name}</span>
                  <Progress value={ph.progress} tone={ph.progress >= 100 ? "teal" : "river"} className="flex-1" />
                  <span className="w-20 text-right text-xs text-muted">{ph.progress >= 100 ? "Complete" : `${ph.progress}%`}</span>
                </li>
              ))}
              {!phases.length && <li className="px-5 py-6 text-sm text-muted">No phases yet — add them on the Timeline tab.</li>}
            </ul>
          </Card>
          <Card>
            <CardHead title="Upcoming tasks" action={<Link href={`/projects/${p.id}/tasks`} className="text-xs font-medium text-river hover:underline">All tasks</Link>} />
            {upcoming.length === 0 ? <p className="px-5 pb-6 text-sm text-muted">No open tasks. Create one on the Tasks tab.</p> : (
              <ul className="divide-y divide-line/70 border-t border-line/70">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{t.title}</span><span className="text-xs text-muted">{t.assignee?.name ?? "Unassigned"}</span></span>
                    <Chip tone={PRIORITY_TONE[t.priority]}>{PRIORITY[t.priority]}</Chip>
                    <Chip tone={TASK_TONE[t.status]}>{TASK_STATUS[t.status]}</Chip>
                    <span className={`w-24 text-right text-xs ${t.dueDate && t.dueDate < startOfToday() ? "text-red-700" : "text-muted"}`}>{dueLabel(t.dueDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {photos.length > 0 && (
            <Card>
              <CardHead title="Latest photos" action={<Link href={`/projects/${p.id}/photos`} className="text-xs font-medium text-river hover:underline">Open gallery</Link>} />
              <div className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-4">{photos.map((ph) => <PhotoTile key={ph.id} p={ph} />)}</div>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card><CardHead title="Recent activity" /><ActivityFeed items={activity} empty="Nothing yet. Updates from site will appear here." /></Card>
          {isManager(u) && (
            <Card className="p-5">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Project status</p>
              <ActionForm action={setProjectStatus} hideSubmit><input type="hidden" name="projectId" value={p.id} /><AutoSelect name="status" defaultValue={p.status} options={opts(PROJECT_STATUS)} className="h-10 w-full text-sm" /></ActionForm>
              <LinkButton href={`/projects/${p.id}/edit`} variant="secondary" size="sm" className="mt-4">Edit project details</LinkButton>
              {p.description && <p className="mt-4 text-sm leading-relaxed text-muted">{p.description}</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

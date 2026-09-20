import Link from "next/link";
import { ArrowRight, CloudRain, Images, TriangleAlert } from "lucide-react";
import { forecast, tasksAtRisk } from "@/lib/weather";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueScope } from "@/lib/access";
import { portfolio } from "@/lib/queries";
import { addDays, dueLabel, formatINR, fmtDate, fmtShort, greeting, startOfToday, PRIORITY_TONE, PRIORITY, SEVERITY, SEVERITY_TONE } from "@/lib/utils";
import { ActivityFeed, HealthChip, PhotoTile } from "@/components/blocks";
import { Avatar, Card, CardHead, Chip, EmptyState, LinkButton, Photo, Progress, Stat } from "@/components/ui";

export const metadata = { title: "Overview" };

export default async function Dashboard() {
  const u = await requireUser();
  const today = startOfToday();
  const projects = await portfolio(u);
  const ids = projects.map((p) => p.id);
  const [dueToday, overdueTasks, openIssues, severeIssues, activity, photos] = await Promise.all([
    prisma.task.count({ where: { companyId: u.companyId, projectId: { in: ids }, dueDate: { gte: today, lt: addDays(today, 1) }, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } } }),
    prisma.task.findMany({ where: { companyId: u.companyId, projectId: { in: ids }, dueDate: { lt: today }, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } }, include: { project: { select: { id: true, name: true } }, assignee: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.issue.count({ where: { ...issueScope(u), status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
    prisma.issue.findMany({ where: { ...issueScope(u), status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] }, severity: { in: ["HIGH", "CRITICAL"] } }, include: { project: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 4 }),
    prisma.activityLog.findMany({ where: { companyId: u.companyId, projectId: { in: ids } }, include: { project: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 9 }),
    prisma.progressPhoto.findMany({ where: { companyId: u.companyId, projectId: { in: ids } }, include: { task: { select: { title: true } }, user: { select: { name: true } }, project: { select: { name: true } } }, orderBy: { takenAt: "desc" }, take: 6 }),
  ]);
  const placed = projects.filter((p) => p.latitude != null && p.longitude != null);
  const wx = await Promise.all(placed.map(async (p) => ({ p, days: await forecast(p.latitude!, p.longitude!) })));
  const wxTasks = placed.length ? await prisma.task.findMany({ where: { companyId: u.companyId, projectId: { in: placed.map((p) => p.id) }, weatherSensitive: true, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } }, select: { id: true, title: true, projectId: true, startDate: true, dueDate: true, weatherSensitive: true, status: true } }) : [];
  const alerts = wx.flatMap(({ p, days }) => (days ? tasksAtRisk(wxTasks.filter((t) => t.projectId === p.id), days).map((r) => ({ p, r })) : []));
  const active = projects.filter((p) => p.status === "ACTIVE");
  const avg = active.length ? Math.round(active.reduce((a, p) => a + p.progress, 0) / active.length) : 0;
  const attention = projects.filter((p) => p.health === "AT_RISK" || p.health === "DELAYED").length;
  const value = projects.reduce((a, p) => a + p.budget, 0);

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[44px] font-semibold leading-none text-river-deep">{greeting()}, {u.name.split(" ")[0]}.</h1>
          <p className="mt-2 text-sm text-muted">Here&apos;s what&apos;s happening across your projects.</p>
        </div>
        <p className="text-sm text-muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Active projects" value={active.length} sub={`${projects.length} total`} />
        <Stat label="Portfolio value" value={formatINR(value)} />
        <Stat label="Average progress" value={`${avg}%`} />
        <Stat label="Due today" value={dueToday} sub="tasks" />
        <Stat label="Overdue" value={overdueTasks.length} sub="tasks" tone={overdueTasks.length ? "red" : undefined} />
        <Stat label="Need attention" value={attention} sub={`${openIssues} open issue${openIssues === 1 ? "" : "s"}`} tone={attention ? "amber" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHead title="Projects" action={<Link href="/projects" className="text-xs font-medium text-river hover:underline">View all</Link>} />
            {projects.length === 0 ? (
              <EmptyState title="No projects yet" body="Create your first project to start planning, assigning and tracking site progress." action={u.role === "DIRECTOR" ? <LinkButton href="/projects/new">Create project</LinkButton> : undefined} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Project</th><th className="px-3 font-medium">Progress</th><th className="px-3 font-medium">Status</th><th className="px-3 font-medium">Manager</th><th className="px-3 font-medium">Next milestone</th></tr></thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id} className="border-b border-line/70 last:border-0 hover:bg-stone-50/60">
                        <td className="px-5 py-3">
                          <Link href={`/projects/${p.id}`} className="flex items-center gap-3">
                            <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-river/10">{p.cover && <Photo id={p.cover} className="size-11" />}</span>
                            <span><span className="block font-medium">{p.name}</span><span className="block text-xs text-muted">{p.location}</span></span>
                          </Link>
                        </td>
                        <td className="px-3"><div className="flex w-36 items-center gap-2"><Progress value={p.progress} /><span className="w-9 text-xs tabular-nums">{p.progress}%</span></div></td>
                        <td className="px-3"><HealthChip health={p.health} /></td>
                        <td className="px-3"><span className="flex items-center gap-2 text-[13px]">{p.manager && <Avatar name={p.manager.name} size={24} />}{p.manager?.name ?? "—"}</span></td>
                        <td className="px-3 text-[13px]">{p.nextMilestone ? <><span className="block">{p.nextMilestone.name}</span><span className="text-xs text-muted">by {fmtShort(p.nextMilestone.endDate)}</span></> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="Needs attention" sub="Overdue work and serious issues" />
            {overdueTasks.length + severeIssues.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted">Nothing overdue and no serious open issues. All clear.</p>
            ) : (
              <ul className="divide-y divide-line/70 border-t border-line/70">
                {severeIssues.map((i) => (
                  <li key={i.id}><Link href={`/projects/${i.project.id}/issues`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50">
                    <TriangleAlert className="size-4 shrink-0 text-amber-600" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{i.title}</span><span className="text-xs text-muted">{i.project.name}{i.area ? ` · ${i.area}` : ""}</span></span>
                    <Chip tone={SEVERITY_TONE[i.severity]}>{SEVERITY[i.severity]}</Chip>
                  </Link></li>
                ))}
                {overdueTasks.slice(0, 5).map((t) => (
                  <li key={t.id}><Link href={`/projects/${t.project.id}/tasks`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50">
                    <span className="size-2 shrink-0 rounded-full bg-red-500" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{t.title}</span><span className="text-xs text-muted">{t.project.name} · {t.assignee?.name ?? "Unassigned"}</span></span>
                    <Chip tone={PRIORITY_TONE[t.priority]}>{PRIORITY[t.priority]}</Chip>
                    <span className="w-24 text-right text-xs text-red-700">{dueLabel(t.dueDate)}</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </Card>
          {alerts.length > 0 && (
            <Card>
              <CardHead title="Weather alerts" sub="Rain forecast on weather-sensitive work" />
              <ul className="divide-y divide-line/70 border-t border-line/70">{alerts.slice(0, 6).map(({ p, r }) => <li key={r.task.id}><Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50"><CloudRain className="size-4 shrink-0 text-laterite" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.task.title}</span><span className="text-xs text-muted">{p.name} · rain on {r.days.slice(0, 3).map((d) => fmtShort(new Date(d + "T00:00:00+05:30"))).join(", ")}</span></span></Link></li>)}</ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card><CardHead title="Recent site activity" /><ActivityFeed items={activity} showProject empty="Activity from site and office appears here as work happens." /></Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHead title="Latest site photos" action={<Link href="/photos" className="flex items-center gap-1 text-xs font-medium text-river hover:underline">All photos <ArrowRight className="size-3" /></Link>} />
        {photos.length === 0 ? <EmptyState icon={<Images className="size-5" />} title="No progress photos yet" body="Photos captured on site by ZUARI Site appear here, tied to their project and task." /> : (
          <div className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-3 xl:grid-cols-6">{photos.map((p) => <PhotoTile key={p.id} p={p} showProject />)}</div>
        )}
      </Card>
      <p className="sr-only">{fmtDate(today)}</p>
    </>
  );
}

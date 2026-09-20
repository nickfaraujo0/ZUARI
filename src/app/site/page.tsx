import Link from "next/link";
import { AlertTriangle, Camera, ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope, taskScope } from "@/lib/access";
import { HomeBar, TaskCard } from "@/components/site-ui";
import { Photo } from "@/components/ui";
import { greeting } from "@/lib/utils";
import { tFor } from "@/lib/i18n";

export const metadata = { title: "Home" };

export default async function SiteHome() {
  const u = await requireUser();
  const [projects, tasks, unread] = await Promise.all([
    prisma.project.findMany({ where: projectScope(u), include: { photos: { where: u.role === "CONTRACTOR" ? { userId: u.id } : {}, orderBy: { takenAt: "desc" }, take: 1, select: { id: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ where: taskScope(u), include: { project: { select: { name: true } } }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 100 }),
    prisma.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  const open = tasks.filter((t) => t.status === "NOT_STARTED" || t.status === "IN_PROGRESS");
  const done = tasks.length - open.length;
  const tr = tFor(u.locale);
  const qa = [{ href: "/site/add-progress", label: "Add Progress", icon: Camera, primary: true }, { href: "/site/report-issue", label: "Report Issue", icon: AlertTriangle }, { href: "/site/site-update", label: "Site Update", icon: ClipboardList }];
  return (
    <>
      <HomeBar name={u.name} unread={unread} />
      <div className="px-5 pt-5">
        <h1 className="font-serif text-4xl font-semibold leading-tight text-river-deep">{tr(greeting())}, {u.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted">{u.title ?? "Site team"} · {u.company.name}</p>
      </div>

      <section className="mt-5 space-y-3 px-5">
        {projects.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-muted">You haven&apos;t been added to a project yet. Ask your project manager to add you.</p>}
        {projects.map((p) => (
          <div key={p.id} className="relative overflow-hidden rounded-2xl bg-river text-ivory shadow-card">
            {p.photos[0] && <Photo id={p.photos[0].id} className="absolute inset-0 size-full opacity-40" />}
            <div className="absolute inset-0 bg-gradient-to-t from-river-deep/90 to-river-deep/20" />
            <div className="relative p-5 pt-14">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ivory/70">{p.location}</p>
              <p className="font-serif text-3xl font-semibold leading-tight">{p.name}</p>
              <div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-ivory/25"><div className="h-full rounded-full bg-sand" style={{ width: `${p.progress}%` }} /></div><span className="text-sm font-semibold">{tr("{n}% complete", { n: p.progress })}</span></div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-5 grid grid-cols-3 gap-3 px-5">
        {[["Tasks", tasks.length], ["Completed", done], ["Remaining", open.length]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white p-3.5"><p className="text-3xl font-semibold leading-none tabular-nums">{v}</p><p className="mt-1.5 text-xs text-muted">{tr(String(l))}</p></div>
        ))}
      </section>

      <section className="mt-7 px-5">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">{tr("Quick actions")}</h2>
        <div className="grid grid-cols-3 gap-3">
          {qa.map((a) => (
            <Link key={a.href} href={a.href} className={`flex h-28 flex-col items-center justify-center gap-2.5 rounded-2xl border text-center text-sm font-semibold active:scale-[.97] ${a.primary ? "border-river bg-river text-ivory" : "border-line bg-white text-charcoal"}`}>
              <a.icon className="size-7" />{tr(a.label)}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-7 px-5">
        <div className="mb-3 flex items-baseline justify-between"><h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{tr("Today's tasks")}</h2><Link href="/site/tasks" className="text-sm font-medium text-river">{tr("See all")}</Link></div>
        <div className="space-y-3">
          {open.slice(0, 4).map((t) => <TaskCard key={t.id} t={t} loc={u.locale} showProject={projects.length > 1} />)}
          {open.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-white p-5 text-center text-sm text-muted">{tasks.length ? tr("All caught up — nice work.") : tr("No tasks assigned to you yet.")}</p>}
        </div>
      </section>
    </>
  );
}

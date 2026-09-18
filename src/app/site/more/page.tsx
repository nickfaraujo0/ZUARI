import Link from "next/link";
import { Bell, ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { logout } from "@/actions/auth";
import { SiteHeader } from "@/components/site-ui";
import { Avatar, Progress } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/utils";

export const metadata = { title: "More" };

export default async function More() {
  const u = await requireUser();
  const [projects, unread] = await Promise.all([
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true, progress: true, location: true } }),
    prisma.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  const row = "flex h-16 items-center gap-4 rounded-2xl border border-line bg-white px-4 text-base font-medium active:bg-stone-50";
  return (
    <>
      <SiteHeader title="More" />
      <div className="space-y-6 p-5">
        <div className="flex items-center gap-4"><Avatar name={u.name} size={64} /><div><p className="text-xl font-semibold">{u.name}</p><p className="text-sm text-muted">{ROLE_LABEL[u.role]} · {u.company.name}</p><p className="text-xs text-muted">{u.email}</p></div></div>
        <div className="space-y-3">
          <Link href="/site/notifications" className={row}><Bell className="size-5 text-river" />Notifications{unread > 0 && <span className="rounded-full bg-laterite px-2 py-0.5 text-xs text-white">{unread}</span>}<ChevronRight className="ml-auto size-5 text-muted" /></Link>
          {u.role !== "SITE_SUPERVISOR" && <Link href="/dashboard" className={row}><LayoutDashboard className="size-5 text-river" />Open Command Center<ChevronRight className="ml-auto size-5 text-muted" /></Link>}
        </div>
        <div><h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">My projects</h2>
          <div className="space-y-3">{projects.map((p) => <div key={p.id} className="rounded-2xl border border-line bg-white p-4"><p className="font-semibold">{p.name}</p><p className="mb-3 text-sm text-muted">{p.location}</p><div className="flex items-center gap-3"><Progress value={p.progress} className="flex-1" /><span className="text-sm tabular-nums">{p.progress}%</span></div></div>)}{!projects.length && <p className="text-sm text-muted">No projects yet.</p>}</div>
        </div>
        <form action={logout}><button className={`${row} w-full text-red-700`}><LogOut className="size-5" />Sign out</button></form>
      </div>
    </>
  );
}

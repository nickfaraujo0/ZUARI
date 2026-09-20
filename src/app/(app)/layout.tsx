import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncOverdueNotifications } from "@/lib/services";
import { maybeEscalate } from "@/lib/schedules";
import { isManager } from "@/lib/access";
import { SignOut } from "@/components/signout";
import { Avatar, Logo } from "@/components/ui";
import { NavLinks } from "@/components/nav";
import { ROLE_LABEL } from "@/lib/utils";
import { isSiteRole } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  if (isSiteRole(u.role)) redirect("/site"); // site roles use ZUARI Site
  await syncOverdueNotifications(u);
  if (isManager(u)) await maybeEscalate(u.companyId);
  const unread = await prisma.notification.count({ where: { userId: u.id, readAt: null } });
  return (
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden print:!hidden w-64 flex-col overflow-y-auto bg-river-deep px-3 py-6 lg:flex">
        <Link href="/dashboard" className="mb-8 px-3"><Logo dark size={30} /></Link>
        <NavLinks role={u.role} />
        <p className="mt-auto px-3 pt-8 text-[10px] uppercase tracking-[0.2em] text-ivory/35">{u.company.name}</p>
      </aside>
      <header className="sticky top-0 z-20 print:hidden flex h-16 items-center gap-3 border-b border-line bg-ivory/90 px-4 backdrop-blur lg:px-8">
        <details className="relative lg:hidden">
          <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-line bg-white" aria-label="Menu"><Menu className="size-4" /></summary>
          <div className="absolute left-0 top-11 max-h-[80dvh] w-64 overflow-y-auto rounded-xl bg-river-deep p-3 shadow-xl"><NavLinks role={u.role} /></div>
        </details>
        <form action="/search" className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input name="q" placeholder="Search projects, tasks, issues…" aria-label="Search" className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-river focus:ring-2 focus:ring-river/15" />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative flex size-9 items-center justify-center rounded-lg hover:bg-white">
            <Bell className="size-[18px]" />
            {unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-laterite px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
          </Link>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-white">
              <Avatar name={u.name} size={34} />
              <span className="hidden text-left leading-tight sm:block"><span className="block text-[13px] font-medium">{u.name}</span><span className="block text-[11px] text-muted">{ROLE_LABEL[u.role]}</span></span>
            </summary>
            <div className="absolute right-0 top-12 w-56 rounded-xl border border-line bg-white p-2 shadow-xl">
              <p className="truncate px-3 py-2 text-xs text-muted">{u.email}</p>
              <Link href="/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-stone-100">Profile &amp; password</Link>
              <SignOut className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100">Sign out</SignOut>
            </div>
          </details>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}

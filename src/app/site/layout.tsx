import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncOverdueNotifications } from "@/lib/services";
import { SiteNav } from "@/components/site-nav";

export const metadata = { title: { default: "ZUARI Site", template: "%s · ZUARI Site" } };

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  await syncOverdueNotifications(u);
  const unread = await prisma.notification.count({ where: { userId: u.id, readAt: null } });
  return (
    <div className="min-h-dvh bg-stone-200/50">
      <div className="relative mx-auto min-h-dvh max-w-[480px] bg-ivory pb-28 shadow-xl">{children}<SiteNav unread={unread} /></div>
    </div>
  );
}

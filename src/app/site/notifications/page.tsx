import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationList } from "@/components/notifications";
import { SiteHeader } from "@/components/site-ui";

export const metadata = { title: "Notifications" };

export default async function SiteNotifications() {
  const u = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return <><SiteHeader title="Notifications" back="/site/more" /><div className="p-5"><NotificationList items={items} mobile /></div></>;
}

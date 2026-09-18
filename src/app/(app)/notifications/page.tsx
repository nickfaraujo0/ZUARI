import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationList } from "@/components/notifications";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const u = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 60 });
  return <><PageHeader title="Notifications" /><div className="max-w-2xl"><NotificationList items={items} /></div></>;
}

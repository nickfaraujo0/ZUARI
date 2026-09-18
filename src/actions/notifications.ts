"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markAllRead() {
  const u = await requireUser();
  await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}
export async function markRead(id: string) {
  const u = await requireUser();
  await prisma.notification.updateMany({ where: { id, userId: u.id }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

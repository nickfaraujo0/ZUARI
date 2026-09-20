"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const sub = z.object({ endpoint: z.string().url().max(600).startsWith("https://"), keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }) });

export async function savePushSubscription(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const u = await requireUser();
  const p = sub.safeParse(raw);
  if (!p.success) return { ok: false, error: "Invalid subscription." };
  if ((await prisma.pushSubscription.count({ where: { userId: u.id } })) >= 10) return { ok: false, error: "Too many devices. Turn notifications off on one first." };
  await prisma.pushSubscription.upsert({ where: { endpoint: p.data.endpoint }, update: { userId: u.id, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth }, create: { userId: u.id, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth } });
  return { ok: true };
}
export async function removePushSubscription(endpoint: string) {
  const u = await requireUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: u.id } });
  return { ok: true };
}

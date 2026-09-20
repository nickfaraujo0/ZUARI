import "server-only";
import { prisma } from "./db";
import { appUrl } from "./mail";
import { sendPush } from "./push";
import { sendWhatsApp } from "./whatsapp";

// Only urgent or action-needed events are mirrored to WhatsApp (and only for users who opted in).
const WA_TYPES = new Set(["TASK_ASSIGNED", "ISSUE_REPORTED", "ISSUE_ASSIGNED", "SAFETY", "ESCALATION", "INSPECTION", "MATERIAL_REQUEST"]);

/** Fans an in-app notification out to web push and WhatsApp. Best effort: failures never affect the caller. */
export async function deliver(companyId: string, userIds: string[], n: { type: string; title: string; body?: string | null; href?: string | null }) {
  const users = await prisma.user.findMany({ where: { id: { in: userIds }, companyId, active: true }, select: { id: true, phone: true, waOptIn: true } });
  await Promise.allSettled([
    ...users.map((u) => sendPush(u.id, { title: n.title, body: n.body, url: n.href })),
    ...users.filter((u) => u.waOptIn && u.phone && WA_TYPES.has(n.type)).map((u) => sendWhatsApp(u.phone!, `ZUARI: ${n.title}${n.body ? `\n${n.body}` : ""}${n.href ? `\n${appUrl()}${n.href}` : ""}`)),
  ]);
}

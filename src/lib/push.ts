import "server-only";
import webpush from "web-push";
import { prisma } from "./db";

let ready = false;
function init() {
  if (ready) return true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@zuari.local", pub, priv);
  return (ready = true);
}
export const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** Sends a web push to every device the user enabled. Dead subscriptions are removed. Never throws. */
export async function sendPush(userId: string, msg: { title: string; body?: string | null; url?: string | null }) {
  if (!init()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: msg.title, body: msg.body ?? "", url: msg.url ?? "/" }), { TTL: 3600 }); ok++; }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } }); }
  }));
  return ok;
}

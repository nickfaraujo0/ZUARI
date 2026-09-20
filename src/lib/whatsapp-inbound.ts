import "server-only";
import { prisma } from "./db";
import { projectScope } from "./access";
import type { SessionUser } from "./auth";
import { phoneKey } from "./phone";
import { logActivity, notify, projectStewards } from "./services";
import { storeImage } from "./storage";
import { downloadMedia, sendWhatsApp } from "./whatsapp";

type Msg = { id?: string; from?: string; type?: string; text?: { body?: string }; image?: { id?: string; caption?: string } };
const HELP = "ZUARI on WhatsApp:\n• Send a photo (with a caption) or a text to log site progress.\n• Start with “issue:” to report a problem, e.g. “issue: water leakage floor 2”.\n• If you work on several projects, add the project code, e.g. “ZU-0001 slab shuttering done”.";
const PER_HOUR = 30;

/** Turns WhatsApp messages from registered staff into progress updates and issues. */
export async function handleInbound(body: unknown) {
  const entries = ((body as { entry?: { changes?: { value?: { messages?: Msg[] } }[] }[] })?.entry ?? []).flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []);
  for (const m of entries) { try { await one(m); } catch (e) { console.error("[wa:inbound]", e); } }
}

async function one(m: Msg) {
  if (!m.id || !m.from) return;
  try { await prisma.waInbound.create({ data: { id: m.id } }); } catch { return; } // Meta retries deliveries: process each once
  const key = phoneKey(m.from);
  const users = key ? await prisma.user.findMany({ where: { phoneKey: key, active: true } }) : [];
  if (users.length !== 1) return void (await sendWhatsApp(m.from, users.length ? "This number is linked to more than one ZUARI account. Please contact your manager." : "This number isn't registered in ZUARI. Ask your manager to add your phone number to your profile."));
  const u = users[0];
  await prisma.waInbound.update({ where: { id: m.id }, data: { userId: u.id } });
  if ((await prisma.waInbound.count({ where: { userId: u.id, createdAt: { gt: new Date(Date.now() - 3600e3) } } })) > PER_HOUR) return; // flood guard
  if (u.role === "ACCOUNTANT") return void (await sendWhatsApp(m.from, "Site updates by WhatsApp aren't available for your role."));

  const text = (m.type === "text" ? m.text?.body : m.type === "image" ? m.image?.caption : "")?.trim() ?? "";
  if (m.type !== "text" && m.type !== "image") return void (await sendWhatsApp(m.from, "Please send a photo or a text message.\n\n" + HELP));
  if (/^help\b/i.test(text)) return void (await sendWhatsApp(m.from, HELP));

  const projects = await prisma.project.findMany({ where: { ...projectScope(u as unknown as SessionUser), status: { not: "COMPLETED" } }, select: { id: true, name: true, code: true, managerId: true } });
  const codeM = text.match(/\bZU-\d{4}\b/i);
  const project = codeM ? projects.find((p) => p.code.toLowerCase() === codeM[0].toLowerCase()) : projects.length === 1 ? projects[0] : undefined;
  if (!project) return void (await sendWhatsApp(m.from, projects.length ? `Which project? Start your message with its code: ${projects.map((p) => `${p.code} (${p.name})`).join(", ")}` : "You aren't on any active project yet."));
  const clean = text.replace(codeM?.[0] ?? "", "").replace(/^[\s:,-]+/, "").trim();

  let photo: { key: string; mime: string; size: number } | null = null;
  if (m.type === "image" && m.image?.id) { const buf = await downloadMedia(m.image.id); if (buf) { try { photo = await storeImage(buf, u.companyId, project.id); } catch { /* unsupported image: continue without it */ } } }

  const issue = clean.match(/^issue\s*[:\-]\s*([\s\S]+)$/i);
  if (issue) {
    const title = issue[1].trim().slice(0, 140);
    if (title.length < 3) return void (await sendWhatsApp(m.from, "Add a short title after “issue:”"));
    await prisma.issue.create({ data: { companyId: u.companyId, projectId: project.id, title, severity: "MEDIUM", reporterId: u.id, photos: photo ? { create: [{ companyId: u.companyId, projectId: project.id, userId: u.id, storageKey: photo.key, mime: photo.mime, size: photo.size }] } : undefined } });
    await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "ISSUE", message: "New issue reported", detail: `${title} (via WhatsApp)` });
    await notify(u.companyId, await projectStewards(u.companyId, project.managerId), { type: "ISSUE_REPORTED", title: "Issue reported", body: `${title} — ${project.name}`, href: `/projects/${project.id}/issues` }, u.id);
    return void (await sendWhatsApp(m.from, `Issue logged in ${project.name}. Your manager has been notified.`));
  }
  if (!clean && !photo) return void (await sendWhatsApp(m.from, "Add a photo or a short description.\n\n" + HELP));
  await prisma.progressUpdate.create({ data: { companyId: u.companyId, projectId: project.id, userId: u.id, note: clean || null, photos: photo ? { create: [{ companyId: u.companyId, projectId: project.id, userId: u.id, storageKey: photo.key, mime: photo.mime, size: photo.size }] } : undefined } });
  await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: photo ? "PHOTOS" : "NOTE", message: photo ? `${u.name} uploaded 1 progress photo` : `${u.name} posted a progress note`, detail: `${project.name} (via WhatsApp)` });
  await notify(u.companyId, await projectStewards(u.companyId, project.managerId), { type: "PROGRESS", title: "Progress submitted", body: `${u.name} · ${project.name}`, href: `/projects/${project.id}/photos` }, u.id);
  await sendWhatsApp(m.from, `Progress recorded for ${project.name}.`);
}

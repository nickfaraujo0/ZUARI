"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj } from "@/lib/action";
import { assertManager, assertOperations, assertProject, UserError } from "@/lib/access";
import { logActivity, notify, projectStewards } from "@/lib/services";
import { parseDate, startOfToday } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const KIND_TEXT = { INCIDENT: "incident", NEAR_MISS: "near miss", HAZARD: "hazard" } as const;

/** Everyone on site, including contractors, can report a safety event. */
export const reportSafety = action(async (u, fd) => {
  assertOperations(u);
  const d = z.object({ projectId: cuid("Project"), kind: z.enum(["INCIDENT", "NEAR_MISS", "HAZARD"]), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"), description: z.string().min(5, "Describe what happened").max(1500), block: z.string().max(60).optional(), floor: z.string().max(60).optional(), area: z.string().max(80).optional(), injuredCount: z.coerce.number().int().min(0).max(500).default(0), actionsTaken: z.string().max(1000).optional() }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const s = await prisma.safetyIncident.create({ data: { ...d, companyId: u.companyId, projectId: p.id, reportedById: u.id } });
  await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "SAFETY", message: `Safety ${KIND_TEXT[d.kind]} reported${d.injuredCount ? ` — ${d.injuredCount} injured` : ""}`, detail: `${d.description.slice(0, 80)} — ${p.name}` });
  if (d.kind === "INCIDENT" || d.injuredCount > 0 || d.severity === "HIGH" || d.severity === "CRITICAL")
    await notify(u.companyId, await projectStewards(u.companyId, p.managerId), { type: "SAFETY", title: d.injuredCount ? "Safety incident with injuries" : `Safety ${KIND_TEXT[d.kind]} reported`, body: `${d.description.slice(0, 90)} — ${p.name}`, href: "/safety" }, u.id);
  void s; refresh();
  return { message: "Safety report submitted" };
});

export const closeSafety = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ id: cuid("Report"), actionsTaken: z.string().max(1000).optional() }).parse(obj(fd));
  const s = await prisma.safetyIncident.findFirst({ where: { id: d.id, companyId: u.companyId } });
  if (!s) throw new UserError("Report not found.");
  await assertProject(u, s.projectId);
  await prisma.safetyIncident.update({ where: { id: s.id }, data: { closed: true, closedAt: new Date(), actionsTaken: d.actionsTaken ?? s.actionsTaken } });
  refresh();
});

export const logToolbox = action(async (u, fd) => {
  assertOperations(u);
  if (u.role === "CONTRACTOR") throw new UserError("Toolbox talks are logged by your supervisor.");
  const d = z.object({ projectId: cuid("Project"), topic: z.string().min(3, "What was the topic?").max(120), notes: z.string().max(1000).optional(), date: dateStr("Date").optional() }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const day = d.date ? parseDate(d.date)! : startOfToday();
  if (day.getTime() > startOfToday().getTime()) throw new UserError("The date can't be in the future.");
  const ids = [...fd.keys()].filter((k) => k.startsWith("w_")).map((k) => k.slice(2));
  const workers = await prisma.worker.findMany({ where: { companyId: u.companyId, id: { in: ids } }, select: { id: true } });
  if (!workers.length) throw new UserError("Select at least one attendee.");
  await prisma.toolboxTalk.create({ data: { companyId: u.companyId, projectId: p.id, topic: d.topic, notes: d.notes, date: day, conductedById: u.id, attendees: { create: workers.map((w) => ({ workerId: w.id })) } } });
  await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "SAFETY", message: `Toolbox talk: ${d.topic}`, detail: `${workers.length} attended — ${p.name}` });
  refresh(); return { message: `Toolbox talk recorded (${workers.length} attendees)` };
});

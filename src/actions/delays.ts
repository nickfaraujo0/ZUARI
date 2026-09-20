"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj, optId } from "@/lib/action";
import { assertManager, assertOperations, assertProject, UserError } from "@/lib/access";
import { logActivity } from "@/lib/services";
import { forecast, HEAVY_MM } from "@/lib/weather";
import { parseDate, startOfToday } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const CAUSES = ["WEATHER", "MATERIAL", "APPROVAL", "LABOUR", "DESIGN", "EQUIPMENT", "OTHER"] as const;

export const addDelay = action(async (u, fd) => {
  assertOperations(u);
  const d = z.object({ projectId: cuid("Project"), date: dateStr("Date"), cause: z.enum(CAUSES), days: z.coerce.number().min(0.25, "Enter the days lost").max(60).default(1), note: z.string().max(400).optional(), phaseId: optId }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const day = parseDate(d.date)!;
  if (day.getTime() > startOfToday().getTime()) throw new UserError("The date can't be in the future.");
  if (d.phaseId && !(await prisma.projectPhase.findFirst({ where: { id: d.phaseId, projectId: p.id } }))) throw new UserError("That phase isn't part of this project.");
  try { await prisma.delayLog.create({ data: { companyId: u.companyId, projectId: p.id, phaseId: d.phaseId, date: day, cause: d.cause, days: d.days, note: d.note, createdById: u.id } }); }
  catch (e) { if ((e as { code?: string }).code === "P2002") throw new UserError("That cause is already logged for this date."); throw e; }
  await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "DELAY", message: `${u.name} logged a delay (${d.cause.toLowerCase()})`, detail: `${d.days} day${d.days === 1 ? "" : "s"} — ${p.name}` });
  refresh(); return { message: "Delay logged" };
});

export const deleteDelay = action(async (u, fd) => {
  assertManager(u);
  const { id } = z.object({ id: cuid("Delay") }).parse(obj(fd));
  const r = await prisma.delayLog.deleteMany({ where: { id, companyId: u.companyId } });
  if (!r.count) throw new UserError("Delay not found.");
  refresh();
});

/** Books recorded heavy-rain days as weather delays. Rainfall comes from the weather service, never from the client. */
export const logWeatherDelays = action(async (u, fd) => {
  assertManager(u);
  const { projectId } = z.object({ projectId: cuid("Project") }).parse(obj(fd));
  const p = await assertProject(u, projectId);
  if (p.latitude == null || p.longitude == null) throw new UserError("Add the project's coordinates first (Edit project).");
  const days = await forecast(p.latitude, p.longitude);
  if (!days) throw new UserError("The weather service is unavailable. Try again later.");
  const wet = days.filter((x) => x.past && x.rain >= HEAVY_MM);
  const r = await prisma.delayLog.createMany({ data: wet.map((x) => ({ companyId: u.companyId, projectId: p.id, date: parseDate(x.date)!, cause: "WEATHER" as const, days: 1, note: `Heavy rain: ${Math.round(x.rain)} mm recorded`, source: "WEATHER", createdById: u.id })), skipDuplicates: true });
  refresh(); return { message: r.count ? `${r.count} weather delay${r.count > 1 ? "s" : ""} logged` : "No new heavy-rain days to log" };
});

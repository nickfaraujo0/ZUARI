"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj } from "@/lib/action";
import { assertManager, assertProject, UserError } from "@/lib/access";
import { dailyText } from "@/lib/daily";
import { sendWhatsApp, waEnabled } from "@/lib/whatsapp";
import { parseDate } from "@/lib/utils";

/** Sends the day's summary to yourself or to opted-in project members over WhatsApp. */
export const shareReportWhatsApp = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ projectId: cuid("Project"), date: dateStr("Date"), audience: z.enum(["me", "team"]) }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const people = d.audience === "me" ? await prisma.user.findMany({ where: { id: u.id }, select: { phone: true } }) : await prisma.user.findMany({ where: { companyId: u.companyId, active: true, waOptIn: true, memberships: { some: { projectId: p.id } } }, select: { phone: true } });
  const phones = [...new Set(people.map((x) => x.phone).filter((x): x is string => !!x))];
  if (!phones.length) throw new UserError(d.audience === "me" ? "Add your phone number in Profile first." : "No project member has opted in to WhatsApp with a phone number.");
  const text = await dailyText(u.companyId, p, parseDate(d.date)!);
  for (const ph of phones) await sendWhatsApp(ph, text);
  return { message: waEnabled() ? `Sent to ${phones.length} ${phones.length === 1 ? "person" : "people"} on WhatsApp` : `WhatsApp isn't configured yet, so ${phones.length} message(s) were written to the server log instead` };
});

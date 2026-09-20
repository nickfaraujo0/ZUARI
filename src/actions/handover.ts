"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj } from "@/lib/action";
import { assertManager, assertProject, UserError } from "@/lib/access";
import { parseDate } from "@/lib/utils";

export const addWarranty = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ projectId: cuid("Project"), item: z.string().min(2, "What is covered?").max(120), provider: z.string().max(100).optional(), startDate: dateStr("Start date"), endDate: dateStr("End date"), notes: z.string().max(400).optional() }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const s = parseDate(d.startDate)!, e = parseDate(d.endDate)!;
  if (e <= s) throw new UserError("The end date must be after the start date.");
  await prisma.warranty.create({ data: { companyId: u.companyId, projectId: p.id, item: d.item, provider: d.provider, startDate: s, endDate: e, notes: d.notes } });
  revalidatePath("/", "layout"); return { message: "Warranty added" };
});
export const deleteWarranty = action(async (u, fd) => {
  assertManager(u);
  const r = await prisma.warranty.deleteMany({ where: { id: z.object({ id: cuid("Warranty") }).parse(obj(fd)).id, companyId: u.companyId } });
  if (!r.count) throw new UserError("Warranty not found.");
  revalidatePath("/", "layout");
});

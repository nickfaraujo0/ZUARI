"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj, optId } from "@/lib/action";
import { assertManager, assertOperations, assertProject, UserError } from "@/lib/access";
import { logActivity } from "@/lib/services";
import { parseDate, startOfToday } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const worker = z.object({ name: z.string().min(2, "Name is required").max(80), trade: z.string().min(2, "Trade is required").max(60), phone: z.string().max(30).optional(), dailyRate: z.coerce.number().min(0).max(100000), contractorId: optId });

async function checkContractor(companyId: string, id?: string) {
  if (id && !(await prisma.contractor.findFirst({ where: { id, companyId } }))) throw new UserError("Choose a contractor from your company.");
}
export const createWorker = action(async (u, fd) => {
  assertManager(u);
  const d = worker.parse(obj(fd));
  await checkContractor(u.companyId, d.contractorId);
  await prisma.worker.create({ data: { ...d, companyId: u.companyId } });
  refresh(); return { message: "Worker added" };
});
export const updateWorker = action(async (u, fd) => {
  assertManager(u);
  const d = worker.extend({ id: cuid("Worker"), active: z.enum(["true", "false"]) }).parse(obj(fd));
  await checkContractor(u.companyId, d.contractorId);
  const r = await prisma.worker.updateMany({ where: { id: d.id, companyId: u.companyId }, data: { name: d.name, trade: d.trade, phone: d.phone ?? null, dailyRate: d.dailyRate, contractorId: d.contractorId ?? null, active: d.active === "true" } });
  if (!r.count) throw new UserError("Worker not found.");
  refresh(); return { message: "Saved" };
});

/** Attendance sheet for one project and day. A worker can be on only one site per day. */
export const markAttendance = action(async (u, fd) => {
  assertOperations(u);
  const d = z.object({ projectId: cuid("Project"), date: dateStr("Date") }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  const day = parseDate(d.date)!;
  if (day.getTime() > startOfToday().getTime()) throw new UserError("You can't mark attendance for a future date.");
  const rows = [...fd.entries()].filter(([k]) => k.startsWith("s_")).map(([k, v]) => ({ id: k.slice(2), status: String(v), ot: Math.max(0, Math.min(16, Number(fd.get(`o_${k.slice(2)}`)) || 0)) }));
  const workers = new Set((await prisma.worker.findMany({ where: { companyId: u.companyId, active: true, id: { in: rows.map((r) => r.id) } }, select: { id: true } })).map((w) => w.id));
  const elsewhere = await prisma.attendance.findMany({ where: { companyId: u.companyId, date: day, projectId: { not: project.id }, workerId: { in: [...workers] } }, select: { workerId: true } });
  const blocked = new Set(elsewhere.map((e) => e.workerId));
  let present = 0, half = 0, skipped = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      if (!workers.has(r.id)) continue;
      if (blocked.has(r.id)) { skipped++; continue; }
      if (r.status === "") { await tx.attendance.deleteMany({ where: { workerId: r.id, date: day, projectId: project.id } }); continue; }
      if (!["PRESENT", "HALF", "ABSENT"].includes(r.status)) continue;
      if (r.status === "PRESENT") present++; else if (r.status === "HALF") half++;
      await tx.attendance.upsert({ where: { workerId_date: { workerId: r.id, date: day } }, update: { status: r.status as "PRESENT", overtimeHours: r.ot, markedById: u.id, projectId: project.id }, create: { companyId: u.companyId, projectId: project.id, workerId: r.id, date: day, status: r.status as "PRESENT", overtimeHours: r.ot, markedById: u.id } });
    }
    await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "ATTENDANCE", message: `${u.name} recorded attendance`, detail: `${present} present${half ? `, ${half} half day` : ""} · ${d.date}` }, tx);
  });
  refresh();
  return { message: `Attendance saved: ${present} present${half ? `, ${half} half day` : ""}${skipped ? ` · ${skipped} skipped (already on another site today)` : ""}` };
});

"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, obj, optDate, optId } from "@/lib/action";
import { assertManager, assertProject, taskScope, UserError } from "@/lib/access";
import { logActivity, notify, recomputeProgress } from "@/lib/services";
import { qtyData, taskData } from "@/lib/task";
import { isSiteRole } from "@/lib/roles";
import { inspectionGate } from "@/lib/inspections";
import { parseDate, TASK_STATUS } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

const refresh = () => revalidatePath("/", "layout");
const P = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const S = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "VERIFIED"] as const;

const fields = z.object({
  title: z.string().min(2, "Task title is required").max(140),
  description: z.string().max(2000).optional(),
  phaseId: optId,
  assigneeId: optId,
  priority: z.enum(P).default("MEDIUM"),
  startDate: optDate,
  dueDate: optDate,
  status: z.enum(S).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  weatherSensitive: z.string().optional().transform((v) => v === "on"),
  quantityTotal: z.coerce.number().positive("Quantity must be above zero").optional(),
  quantityUnit: z.string().max(20).optional(),
  quantityDone: z.coerce.number().min(0).optional(),
});

/** Status change from the task table; quantity tasks keep quantity and progress in step. */
function statusData(t: { progress: number; completedAt: Date | null; quantityTotal: number | null; quantityDone: number }, status: (typeof S)[number]) {
  const base = taskData(status, undefined, t);
  if (!t.quantityTotal) return base;
  const done = status === "COMPLETED" || status === "VERIFIED" ? t.quantityTotal : status === "NOT_STARTED" ? 0 : t.quantityDone;
  return { ...base, quantityDone: done, progress: Math.round((done / t.quantityTotal) * 100) };
}

async function resolveRefs(u: SessionUser, projectId: string, d: z.infer<typeof fields>) {
  if (d.phaseId && !(await prisma.projectPhase.findFirst({ where: { id: d.phaseId, projectId, companyId: u.companyId } }))) throw new UserError("That phase isn't part of this project.");
  if (d.assigneeId) {
    const a = await prisma.user.findFirst({ where: { id: d.assigneeId, companyId: u.companyId, active: true } });
    if (!a) throw new UserError("That person isn't in your company.");
    // Assigning someone to work on a project makes them a project member.
    await prisma.projectMember.upsert({ where: { projectId_userId: { projectId, userId: a.id } }, update: {}, create: { companyId: u.companyId, projectId, userId: a.id } });
    return a;
  }
  return null;
}
const dates = (d: z.infer<typeof fields>) => {
  const start = parseDate(d.startDate), due = parseDate(d.dueDate);
  if (start && due && due < start) throw new UserError("Due date can't be before the start date.");
  return { startDate: start, dueDate: due };
};

export const createTask = action(async (u, fd) => {
  assertManager(u);
  const d = fields.extend({ projectId: cuid("Project") }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const assignee = await resolveRefs(u, p.id, d);
  const t = await prisma.task.create({
    data: { companyId: u.companyId, projectId: p.id, title: d.title, description: d.description, phaseId: d.phaseId, assigneeId: assignee?.id, createdById: u.id, priority: d.priority, weatherSensitive: d.weatherSensitive, quantityTotal: d.quantityTotal, quantityUnit: d.quantityTotal ? d.quantityUnit : undefined, ...dates(d) },
  });
  await recomputeProgress(p.id);
  await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "TASK_CREATED", message: assignee ? `${t.title} assigned to ${assignee.name}` : `Task created: ${t.title}`, detail: p.name });
  await notify(u.companyId, [assignee?.id], { type: "TASK_ASSIGNED", title: "New task assigned", body: t.title, href: `/site/tasks/${t.id}` }, u.id);
  refresh();
  return { message: "Task created" };
});

export const updateTask = action(async (u, fd) => {
  assertManager(u);
  const d = fields.extend({ taskId: cuid("Task") }).parse(obj(fd));
  const t = await prisma.task.findFirst({ where: { id: d.taskId, companyId: u.companyId } });
  if (!t) throw new UserError("Task not found.");
  const p = await assertProject(u, t.projectId);
  const assignee = await resolveRefs(u, p.id, d);
  if (d.status === "VERIFIED" && t.status !== "VERIFIED") { const g = await inspectionGate(u.companyId, t.id); if (g) throw new UserError(g); }
  await prisma.task.update({
    where: { id: t.id },
    data: { title: d.title, description: d.description ?? null, phaseId: d.phaseId ?? null, assigneeId: assignee?.id ?? null, priority: d.priority, ...dates(d), ...(d.quantityTotal ? qtyData(d.quantityTotal, d.status === "COMPLETED" || d.status === "VERIFIED" ? d.quantityTotal : (d.quantityDone ?? t.quantityDone), { status: d.status ?? t.status, completedAt: t.completedAt }) : { ...taskData(d.status ?? t.status, d.progress, t), quantityDone: 0 }), weatherSensitive: d.weatherSensitive, quantityTotal: d.quantityTotal ?? null, quantityUnit: d.quantityTotal ? (d.quantityUnit ?? null) : null },
  });
  await recomputeProgress(p.id);
  if (assignee && assignee.id !== t.assigneeId) {
    await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "TASK_ASSIGNED", message: `${d.title} assigned to ${assignee.name}` });
    await notify(u.companyId, [assignee.id], { type: "TASK_ASSIGNED", title: "New task assigned", body: d.title, href: `/site/tasks/${t.id}` }, u.id);
  }
  refresh();
  return { message: "Task saved" };
});

/** Inline status / priority changes from the task table. */
export const quickTask = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ taskId: cuid("Task"), status: z.enum(S).optional(), priority: z.enum(P).optional() }).parse(obj(fd));
  const t = await prisma.task.findFirst({ where: { id: d.taskId, companyId: u.companyId } });
  if (!t) throw new UserError("Task not found.");
  const p = await assertProject(u, t.projectId);
  if (d.status === "VERIFIED" && t.status !== "VERIFIED") { const g = await inspectionGate(u.companyId, t.id); if (g) throw new UserError(g); }
  await prisma.task.update({ where: { id: t.id }, data: { ...(d.priority ? { priority: d.priority } : {}), ...(d.status ? statusData(t, d.status) : {}) } });
  if (d.status && d.status !== t.status) {
    await recomputeProgress(p.id);
    await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "TASK_STATUS", message: `${t.title} marked ${TASK_STATUS[d.status]}`, detail: `by ${u.name}` });
  }
  refresh();
});

export const deleteTask = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ taskId: cuid("Task") }).parse(obj(fd));
  const t = await prisma.task.findFirst({ where: { id: d.taskId, companyId: u.companyId } });
  if (!t) throw new UserError("Task not found.");
  await assertProject(u, t.projectId);
  await prisma.task.delete({ where: { id: t.id } });
  await recomputeProgress(t.projectId);
  refresh();
});

export const addComment = action(async (u, fd) => {
  const d = z.object({ taskId: cuid("Task"), body: z.string().min(1, "Write a comment first").max(1000) }).parse(obj(fd));
  const t = await prisma.task.findFirst({ where: { id: d.taskId, ...taskScope(u) }, include: { project: { select: { managerId: true } }, assignee: { select: { id: true, role: true } } } });
  if (!t) throw new UserError("Task not found.");
  await prisma.taskComment.create({ data: { companyId: u.companyId, taskId: t.id, userId: u.id, body: d.body } });
  const n = { type: "COMMENT", title: `${u.name} commented`, body: `${t.title}: ${d.body.slice(0, 80)}` };
  await notify(u.companyId, [t.assignee?.id], { ...n, href: isSiteRole(t.assignee?.role ?? "") ? `/site/tasks/${t.id}` : `/projects/${t.projectId}/tasks/${t.id}` }, u.id);
  if (t.project.managerId !== t.assignee?.id) await notify(u.companyId, [t.project.managerId], { ...n, href: `/projects/${t.projectId}/tasks/${t.id}` }, u.id);
  refresh();
  return { message: "Comment added" };
});

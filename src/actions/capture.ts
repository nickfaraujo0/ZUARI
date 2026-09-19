"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, files, obj, optDate, optId } from "@/lib/action";
import { assertProject, isManager, taskScope, UserError } from "@/lib/access";
import { logActivity, notify, projectStewards, recomputeProgress } from "@/lib/services";
import { storeFiles } from "@/lib/storage";
import { taskData } from "@/lib/task";
import { parseDate, TASK_STATUS } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

/** ADD PROGRESS: photo(s) + task status + note → one ProgressUpdate, structured as project evidence. */
export const submitProgress = action(async (u, fd) => {
  const d = z.object({
    projectId: cuid("Project"), clientId: z.string().max(64).optional(), taskId: optId, note: z.string().max(2000).optional(),
    status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "VERIFIED"]).optional(),
    progress: z.coerce.number().int().min(0).max(100).optional(),
  }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  // Idempotency: an offline retry of an already-received submission is acknowledged, not duplicated.
  if (d.clientId && (await prisma.progressUpdate.findFirst({ where: { companyId: u.companyId, clientId: d.clientId }, select: { id: true } }))) return { message: "Progress submitted" };
  const upload = files(fd);

  // Supervisors can only touch tasks assigned to them.
  const task = d.taskId ? await prisma.task.findFirst({ where: { id: d.taskId, projectId: project.id, ...taskScope(u) } }) : null;
  if (d.taskId && !task) throw new UserError("That task isn't assigned to you.");
  if (d.status === "VERIFIED" && !isManager(u)) throw new UserError("Only managers can verify a task.");
  const change = task && d.status ? taskData(d.status, d.progress, task) : task && d.progress != null ? taskData(task.status === "NOT_STARTED" ? "IN_PROGRESS" : task.status, d.progress, task) : null;
  const statusChanged = !!change && change.status !== task!.status;
  if (!upload.length && !d.note && !change) throw new UserError("Add a photo, a note or a status change.");

  const stored = await storeFiles(upload, u.companyId, project.id);
  const wasDone = task && (task.status === "COMPLETED" || task.status === "VERIFIED");

  await prisma.$transaction(async (tx) => {
    await tx.progressUpdate.create({
      data: {
        clientId: d.clientId, companyId: u.companyId, projectId: project.id, taskId: task?.id, userId: u.id, note: d.note,
        statusBefore: task?.status, statusAfter: change?.status, progress: change?.progress,
        photos: { create: stored.map((s) => ({ companyId: u.companyId, projectId: project.id, taskId: task?.id, userId: u.id, storageKey: s.key, mime: s.mime, size: s.size })) },
      },
    });
    if (task && change) await tx.task.update({ where: { id: task.id }, data: change });
    if (change) await recomputeProgress(project.id, tx);

    const where = task?.title ?? project.name;
    if (statusChanged) await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "TASK_STATUS", message: `${task!.title} marked ${TASK_STATUS[change!.status]}`, detail: `by ${u.name}` }, tx);
    if (stored.length) await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "PHOTOS", message: `${u.name} uploaded ${plural(stored.length, "progress photo")}`, detail: where }, tx);
    if (!stored.length && d.note && !statusChanged) await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "NOTE", message: `${u.name} posted a progress note`, detail: where }, tx);

    const stewards = await projectStewards(u.companyId, project.managerId);
    if (change?.status === "COMPLETED" && !wasDone) await notify(u.companyId, stewards, { type: "TASK_COMPLETED", title: "Task completed", body: `${task!.title} — ${project.name}`, href: `/projects/${project.id}/tasks` }, u.id, tx);
    else await notify(u.companyId, stewards, { type: "PROGRESS", title: "Progress submitted", body: `${u.name} · ${where}`, href: `/projects/${project.id}/photos` }, u.id, tx);
  });
  refresh();
  return { message: "Progress submitted" };
});

export const reportIssue = action(async (u, fd) => {
  const d = z.object({
    projectId: cuid("Project"), clientId: z.string().max(64).optional(), taskId: optId, area: z.string().max(120).optional(),
    title: z.string().min(3, "Give the issue a short title").max(140),
    description: z.string().max(2000).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    assigneeId: optId, dueDate: optDate,
  }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  // Idempotency: an offline retry of an already-received submission is acknowledged, not duplicated.
  if (d.clientId && (await prisma.issue.findFirst({ where: { companyId: u.companyId, clientId: d.clientId }, select: { id: true } }))) return { message: "Issue reported" };
  if (d.taskId && !(await prisma.task.findFirst({ where: { id: d.taskId, projectId: project.id, ...taskScope(u) } }))) throw new UserError("That task isn't available to you.");
  // Only managers may assign at creation time.
  const assignee = d.assigneeId && isManager(u) ? await prisma.user.findFirst({ where: { id: d.assigneeId, companyId: u.companyId, active: true } }) : null;
  const stored = await storeFiles(files(fd), u.companyId, project.id);

  await prisma.$transaction(async (tx) => {
    await tx.issue.create({
      data: {
        clientId: d.clientId, companyId: u.companyId, projectId: project.id, taskId: d.taskId, area: d.area, title: d.title, description: d.description, severity: d.severity,
        reporterId: u.id, assigneeId: assignee?.id, status: assignee ? "ASSIGNED" : "OPEN", dueDate: parseDate(d.dueDate),
        photos: { create: stored.map((s) => ({ companyId: u.companyId, projectId: project.id, taskId: d.taskId, userId: u.id, storageKey: s.key, mime: s.mime, size: s.size })) },
      },
    });
    await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "ISSUE", message: "New issue reported", detail: `${d.title}${d.area ? ` — ${d.area}` : ""}` }, tx);
    await notify(u.companyId, await projectStewards(u.companyId, project.managerId), { type: "ISSUE_REPORTED", title: `${d.severity === "CRITICAL" || d.severity === "HIGH" ? "Urgent issue" : "Issue"} reported`, body: `${d.title} — ${project.name}`, href: `/projects/${project.id}/issues` }, u.id, tx);
    if (assignee) await notify(u.companyId, [assignee.id], { type: "ISSUE_ASSIGNED", title: "Issue assigned to you", body: d.title, href: `/projects/${project.id}/issues` }, u.id, tx);
  });
  refresh();
  return { message: "Issue reported" };
});

export const submitSiteUpdate = action(async (u, fd) => {
  const d = z.object({
    projectId: cuid("Project"), clientId: z.string().max(64).optional(), workCompleted: z.string().max(2000).optional(), workPlanned: z.string().max(2000).optional(),
    workforceCount: z.coerce.number().int().min(0).max(100000).default(0), materialsReceived: z.string().max(1000).optional(), notes: z.string().max(2000).optional(),
  }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  // Idempotency: an offline retry of an already-received submission is acknowledged, not duplicated.
  if (d.clientId && (await prisma.siteReport.findFirst({ where: { companyId: u.companyId, clientId: d.clientId }, select: { id: true } }))) return { message: "Site update submitted" };
  const upload = files(fd);
  if (!d.workCompleted && !d.workPlanned && !d.workforceCount && !d.materialsReceived && !d.notes && !upload.length) throw new UserError("Add at least one detail to the site update.");
  const stored = await storeFiles(upload, u.companyId, project.id);
  await prisma.$transaction(async (tx) => {
    await tx.siteReport.create({
      data: {
        clientId: d.clientId, companyId: u.companyId, projectId: project.id, userId: u.id, workCompleted: d.workCompleted, workPlanned: d.workPlanned, workforceCount: d.workforceCount, materialsReceived: d.materialsReceived, notes: d.notes,
        photos: { create: stored.map((s) => ({ companyId: u.companyId, projectId: project.id, userId: u.id, storageKey: s.key, mime: s.mime, size: s.size })) },
      },
    });
    await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "SITE_UPDATE", message: `${u.name} submitted a site update`, detail: d.workforceCount ? `${d.workforceCount} workers on site` : project.name }, tx);
  });
  refresh();
  return { message: "Site update submitted" };
});

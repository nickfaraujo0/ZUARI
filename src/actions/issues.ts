"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, obj, optDate, optId } from "@/lib/action";
import { assertManager, assertProject, UserError } from "@/lib/access";
import { logActivity, notify } from "@/lib/services";
import { ISSUE_STATUS, parseDate } from "@/lib/utils";

export const updateIssue = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({
    issueId: cuid("Issue"), status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(), assigneeId: optId, dueDate: optDate,
  }).parse(obj(fd));
  const i = await prisma.issue.findFirst({ where: { id: d.issueId, companyId: u.companyId } });
  if (!i) throw new UserError("Issue not found.");
  await assertProject(u, i.projectId);
  const assignee = d.assigneeId ? await prisma.user.findFirst({ where: { id: d.assigneeId, companyId: u.companyId, active: true } }) : null;
  if (d.assigneeId && !assignee) throw new UserError("That person isn't in your company.");
  if (assignee) await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: i.projectId, userId: assignee.id } }, update: {}, create: { companyId: u.companyId, projectId: i.projectId, userId: assignee.id } });

  let status = d.status ?? i.status;
  if (assignee && status === "OPEN") status = "ASSIGNED";
  const closing = status === "RESOLVED" || status === "CLOSED";
  await prisma.issue.update({
    where: { id: i.id },
    data: { status, severity: d.severity ?? i.severity, assigneeId: d.assigneeId !== undefined || fd.has("assigneeId") ? (assignee?.id ?? null) : i.assigneeId, dueDate: fd.has("dueDate") ? parseDate(d.dueDate) : i.dueDate, resolvedAt: closing ? (i.resolvedAt ?? new Date()) : null },
  });
  if (status !== i.status) await logActivity({ companyId: u.companyId, projectId: i.projectId, actorId: u.id, type: "ISSUE", message: `Issue ${ISSUE_STATUS[status].toLowerCase()}: ${i.title}`, detail: `by ${u.name}` });
  if (assignee && assignee.id !== i.assigneeId) await notify(u.companyId, [assignee.id], { type: "ISSUE_ASSIGNED", title: "Issue assigned to you", body: i.title, href: `/projects/${i.projectId}/issues` }, u.id);
  revalidatePath("/", "layout");
});

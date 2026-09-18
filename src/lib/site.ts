import "server-only";
import { prisma } from "./db";
import { projectScope, taskScope } from "./access";
import type { SessionUser } from "./auth";

/** Projects + the tasks this person may act on, shaped for the capture forms. */
export async function captureOptions(u: SessionUser) {
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({ where: { ...projectScope(u), status: { not: "COMPLETED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.task.findMany({ where: { ...taskScope(u), status: { in: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] } }, select: { id: true, title: true, status: true, progress: true, projectId: true }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 150 }),
  ]);
  return projects.map((p) => ({ ...p, tasks: tasks.filter((t) => t.projectId === p.id) }));
}

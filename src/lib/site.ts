import "server-only";
import { prisma } from "./db";
import { projectScope, taskScope } from "./access";
import type { SessionUser } from "./auth";

/** Projects + the tasks this person may act on, shaped for the capture forms. */
export async function captureOptions(u: SessionUser) {
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({ where: { ...projectScope(u), status: { not: "COMPLETED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.task.findMany({ where: { ...taskScope(u), status: { in: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] } }, select: { id: true, title: true, status: true, progress: true, projectId: true, quantityTotal: true, quantityDone: true, quantityUnit: true }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 150 }),
  ]);
  return projects.map((p) => ({ ...p, tasks: tasks.filter((t) => t.projectId === p.id) }));
}

/** Previously used block / floor / area values, offered as suggestions so naming stays consistent. */
export async function locationSuggestions(u: SessionUser) {
  const rows = await prisma.progressUpdate.findMany({ where: { companyId: u.companyId, project: projectScope(u), OR: [{ block: { not: null } }, { floor: { not: null } }, { locationArea: { not: null } }] }, select: { block: true, floor: true, locationArea: true }, orderBy: { createdAt: "desc" }, take: 300 });
  const uniq = (k: "block" | "floor" | "locationArea") => [...new Set(rows.map((r) => r[k]).filter((x): x is string => !!x))].slice(0, 30);
  return { block: uniq("block"), floor: uniq("floor"), area: uniq("locationArea") };
}

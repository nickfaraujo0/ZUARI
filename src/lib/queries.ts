import "server-only";
import { prisma } from "./db";
import { projectScope } from "./access";
import type { SessionUser } from "./auth";
import { healthOf } from "./services";
import { startOfToday } from "./utils";

const OPEN = ["OPEN", "ASSIGNED", "IN_PROGRESS"] as const;

/** All projects the user can see, with the derived signals the UI needs (health, overdue, cover, next milestone). */
export async function portfolio(u: SessionUser) {
  const projects = await prisma.project.findMany({
    where: projectScope(u),
    include: { manager: { select: { id: true, name: true } }, phases: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const ids = projects.map((p) => p.id);
  const [overdue, issues, covers] = await Promise.all([
    prisma.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, dueDate: { lt: startOfToday() }, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } }, _count: true }),
    prisma.issue.findMany({ where: { projectId: { in: ids }, status: { in: [...OPEN] } }, select: { projectId: true, severity: true } }),
    prisma.progressPhoto.findMany({ where: { projectId: { in: ids } }, orderBy: { takenAt: "desc" }, distinct: ["projectId"], select: { id: true, projectId: true } }),
  ]);
  return projects.map((p) => {
    const od = overdue.find((o) => o.projectId === p.id)?._count ?? 0;
    const my = issues.filter((i) => i.projectId === p.id);
    const severe = my.filter((i) => i.severity === "HIGH" || i.severity === "CRITICAL").length;
    return {
      ...p, budget: Number(p.budget), overdue: od, openIssues: my.length, severeIssues: severe,
      cover: covers.find((c) => c.projectId === p.id)?.id ?? null,
      nextMilestone: p.phases.find((ph) => ph.progress < 100) ?? null,
      health: healthOf({ status: p.status, progress: p.progress, expectedEnd: p.expectedEnd, overdue: od, severeIssues: severe }),
    };
  });
}
export type PortfolioProject = Awaited<ReturnType<typeof portfolio>>[number];

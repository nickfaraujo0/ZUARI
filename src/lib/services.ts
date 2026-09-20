import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { isSiteRole } from "./roles";
import { addDays, startOfToday, type Health } from "./utils";

type Tx = Prisma.TransactionClient | typeof prisma;

export const logActivity = (
  a: { companyId: string; projectId?: string | null; actorId?: string | null; type: string; message: string; detail?: string | null; createdAt?: Date },
  db: Tx = prisma,
) => db.activityLog.create({ data: { ...a, projectId: a.projectId ?? null, actorId: a.actorId ?? null, detail: a.detail ?? null } });

export async function notify(
  companyId: string,
  userIds: (string | null | undefined)[],
  n: { type: string; title: string; body?: string; href?: string; dedupeKey?: string },
  exceptUserId?: string,
  db: Tx = prisma,
) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x && x !== exceptUserId))];
  if (!ids.length) return;
  const r = await db.notification.createMany({ data: ids.map((userId) => ({ companyId, userId, ...n })), skipDuplicates: true });
  // Mirror new notifications to web push / WhatsApp (best effort, never blocks or fails the caller).
  if (r.count > 0) void import("./delivery").then((m) => m.deliver(companyId, ids, n)).catch(() => {});
}

/** Who should hear about project events: the manager plus all directors. */
export async function projectStewards(companyId: string, managerId?: string | null) {
  const dirs = await prisma.user.findMany({ where: { companyId, role: "DIRECTOR", active: true }, select: { id: true } });
  return [managerId, ...dirs.map((d) => d.id)];
}

/**
 * Phase progress = mean of its tasks (or the stored value if it has none).
 * Project progress = mean across phases (plus a bucket for phase-less tasks).
 */
export async function recomputeProgress(projectId: string, db: Tx = prisma) {
  const [phases, loose] = await Promise.all([
    db.projectPhase.findMany({ where: { projectId }, include: { tasks: { select: { progress: true } } } }),
    db.task.findMany({ where: { projectId, phaseId: null }, select: { progress: true } }),
  ]);
  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const groups: number[] = [];
  for (const ph of phases) {
    const v = ph.tasks.length ? mean(ph.tasks.map((t) => t.progress)) : ph.progress;
    if (v !== ph.progress) await db.projectPhase.update({ where: { id: ph.id }, data: { progress: v } });
    groups.push(v);
  }
  if (loose.length) groups.push(mean(loose.map((t) => t.progress)));
  const progress = groups.length ? mean(groups) : 0;
  await db.project.update({ where: { id: projectId }, data: { progress } });
  return progress;
}

export async function nextProjectCode(companyId: string) {
  const n = await prisma.project.count({ where: { companyId } });
  return `ZU-${String(n + 1).padStart(4, "0")}`;
}

/** Overdue tasks generate one notification per task (deduplicated). Cheap; runs on layout load. */
export async function syncOverdueNotifications(u: { id: string; companyId: string; role: string }) {
  if (u.role === "ACCOUNTANT") return;
  const where: Prisma.TaskWhereInput =
    isSiteRole(u.role)
      ? { assigneeId: u.id }
      : u.role === "PROJECT_MANAGER"
        ? { project: { managerId: u.id } }
        : { companyId: u.companyId };
  const overdue = await prisma.task.findMany({
    where: { ...where, companyId: u.companyId, dueDate: { lt: startOfToday() }, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
    select: { id: true, title: true, projectId: true },
    take: 25,
  });
  if (!overdue.length) return;
  await prisma.notification.createMany({
    data: overdue.map((t) => ({
      companyId: u.companyId, userId: u.id, type: "TASK_OVERDUE", title: "Task overdue", body: t.title,
      href: isSiteRole(u.role) ? `/site/tasks/${t.id}` : `/projects/${t.projectId}/tasks`, dedupeKey: `overdue:${t.id}`,
    })),
    skipDuplicates: true,
  });
}

// ── Project health (drives “needs attention”) ──────────────────
export type HealthInput = { status: string; progress: number; expectedEnd: Date; overdue: number; severeIssues: number };
export function healthOf(p: HealthInput): Health {
  if (p.status === "COMPLETED" || p.progress >= 100) return "DONE";
  if (p.status === "ON_HOLD") return "PAUSED";
  if (p.expectedEnd < startOfToday() || p.overdue >= 3) return "DELAYED";
  if (p.overdue >= 1 || p.severeIssues >= 1) return "AT_RISK";
  return "ON_TRACK";
}
export const inDays = (n: number) => addDays(startOfToday(), n);

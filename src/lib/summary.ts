import "server-only";
import { prisma } from "./db";
import { isFinance } from "./access";
import type { SessionUser } from "./auth";
import { insightsFor } from "./insights";
import { appUrl, sendMail } from "./mail";
import { formatINR, HEALTH, startOfToday } from "./utils";

const DAY = 864e5;

/** Plain-text weekly summary for everything the user can see. */
export async function weeklySummary(u: SessionUser) {
  const since = new Date(startOfToday().getTime() - 7 * DAY);
  const ins = await insightsFor(u), ids = ins.map((i) => i.projectId);
  const scope = { companyId: u.companyId, projectId: { in: ids } };
  const [done, photos, opened, resolved, delays, safety, spend] = await Promise.all([
    prisma.task.groupBy({ by: ["projectId"], where: { ...scope, completedAt: { gte: since } }, _count: true }),
    prisma.progressPhoto.groupBy({ by: ["projectId"], where: { ...scope, takenAt: { gte: since } }, _count: true }),
    prisma.issue.groupBy({ by: ["projectId"], where: { ...scope, createdAt: { gte: since } }, _count: true }),
    prisma.issue.groupBy({ by: ["projectId"], where: { ...scope, resolvedAt: { gte: since } }, _count: true }),
    prisma.delayLog.groupBy({ by: ["projectId"], where: { ...scope, date: { gte: since } }, _sum: { days: true } }),
    prisma.safetyIncident.groupBy({ by: ["projectId"], where: { ...scope, createdAt: { gte: since } }, _count: true }),
    isFinance(u) ? prisma.expense.aggregate({ where: { companyId: u.companyId, projectId: { in: ids }, status: { in: ["APPROVED", "PAID"] }, date: { gte: since } }, _sum: { amount: true } }) : null,
  ]);
  const n = <T extends { projectId: string; _count?: number }>(rows: T[], id: string) => rows.find((r) => r.projectId === id)?._count ?? 0;
  const lines: string[] = [`ZUARI weekly summary — week ending ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}`, ""];
  for (const i of ins) {
    const dl = delays.find((d) => d.projectId === i.projectId)?._sum.days ?? 0;
    lines.push(`${i.name} (${i.code}) — ${i.progress}% complete, ${HEALTH[i.level]}`, `  This week: ${n(done, i.projectId)} tasks completed · ${n(photos, i.projectId)} photos · ${n(opened, i.projectId)} issues raised, ${n(resolved, i.projectId)} resolved${dl ? ` · ${dl} delay days` : ""}${n(safety, i.projectId) ? ` · ${n(safety, i.projectId)} safety report(s)` : ""}`);
    for (const f of i.factors.slice(0, 3)) lines.push(`  ! ${f.text}`);
    lines.push("");
  }
  if (spend) lines.push(`Spend approved or paid this week: ${formatINR(Number(spend._sum.amount ?? 0))}`, "");
  if (!ins.length) lines.push("No projects yet.");
  return lines.join("\n").trim();
}

export async function sendWeeklySummaries() {
  const dirs = await prisma.user.findMany({ where: { role: "DIRECTOR", active: true }, select: { id: true, companyId: true, name: true, email: true, role: true } });
  let sent = 0;
  for (const d of dirs) {
    const text = await weeklySummary(d as unknown as SessionUser);
    await sendMail({ to: d.email, subject: "Your ZUARI weekly summary", text: `${text}\n\nOpen ZUARI: ${appUrl()}/ask` }).then(() => sent++).catch((e) => console.error("[summary]", e));
  }
  return { directors: dirs.length, sent };
}

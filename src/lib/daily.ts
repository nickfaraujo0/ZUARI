import "server-only";
import { prisma } from "./db";
import { fmtDate, num } from "./utils";

/** Short text version of the daily site report, for WhatsApp. */
export async function dailyText(companyId: string, project: { id: string; name: string; code: string; progress: number }, day: Date) {
  const range = { gte: day, lt: new Date(day.getTime() + 864e5) }, pj = { companyId, projectId: project.id };
  const [att, done, updates, photos, raised, received, reports] = await Promise.all([
    prisma.attendance.findMany({ where: { ...pj, date: day, status: { not: "ABSENT" } }, select: { status: true } }),
    prisma.task.findMany({ where: { ...pj, completedAt: range }, select: { title: true }, take: 5 }),
    prisma.progressUpdate.count({ where: { ...pj, createdAt: range } }),
    prisma.progressPhoto.count({ where: { ...pj, takenAt: range } }),
    prisma.issue.findMany({ where: { ...pj, createdAt: range }, select: { title: true, severity: true }, take: 4 }),
    prisma.materialTxn.findMany({ where: { ...pj, createdAt: range, type: "RECEIVED" }, include: { material: { select: { name: true, unit: true } } }, take: 4 }),
    prisma.siteReport.findMany({ where: { ...pj, createdAt: range }, select: { workforceCount: true, workCompleted: true } }),
  ]);
  const workers = att.length ? att.reduce((s, a) => s + (a.status === "HALF" ? 0.5 : 1), 0) : Math.max(0, ...reports.map((r) => r.workforceCount));
  const L = [`Daily site report — ${project.name} (${project.code})`, fmtDate(day), `Overall progress: ${project.progress}%`, "", `Workforce: ${num(workers)} worker-days`, `Progress updates: ${updates} · Photos: ${photos}`];
  if (done.length) L.push("", "Completed:", ...done.map((t) => `• ${t.title}`));
  const notes = reports.map((r) => r.workCompleted).filter(Boolean);
  if (notes.length) L.push("", "Work done:", ...notes.map((n) => `• ${n!.split("\n")[0]}`));
  if (received.length) L.push("", "Materials received:", ...received.map((t) => `• ${num(t.quantity)} ${t.material.unit} ${t.material.name}`));
  if (raised.length) L.push("", "Issues raised:", ...raised.map((i) => `• ${i.title} (${i.severity.toLowerCase()})`));
  return L.join("\n");
}

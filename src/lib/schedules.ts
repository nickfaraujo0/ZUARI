import "server-only";
import { prisma } from "./db";
import { appUrl, sendMail } from "./mail";
import { notify } from "./services";
import { startOfToday } from "./utils";

const HOUR = 3600e3, DAY = 864e5;
const directorsOf = async (companyId: string) => (await prisma.user.findMany({ where: { companyId, role: "DIRECTOR", active: true }, select: { id: true } })).map((u) => u.id);

/**
 * Escalation rules, each notifying at most once per record (deduplicated):
 *  - High/Critical issue still Open after the company's threshold → Directors + project manager
 *  - High/Urgent task overdue by more than N days → Directors + project manager
 *  - Expense waiting for approval more than 3 days → Directors
 *  - Warranty ending within 30 days → Directors + project manager
 */
export async function runEscalations(companyId?: string) {
  const companies = await prisma.company.findMany({ where: companyId ? { id: companyId } : {}, select: { id: true, escalateIssueHours: true, escalateTaskDays: true } });
  const out = { issues: 0, tasks: 0, expenses: 0, warranties: 0 };
  for (const c of companies) {
    const dirs = await directorsOf(c.id);
    const issues = await prisma.issue.findMany({ where: { companyId: c.id, status: "OPEN", severity: { in: ["HIGH", "CRITICAL"] }, createdAt: { lt: new Date(Date.now() - c.escalateIssueHours * HOUR) } }, include: { project: { select: { name: true, managerId: true } } }, take: 50 });
    for (const i of issues) { out.issues++; await notify(c.id, [...dirs, i.project.managerId], { type: "ESCALATION", title: `Unanswered ${i.severity.toLowerCase()} issue`, body: `${i.title} — ${i.project.name}, open ${Math.floor((Date.now() - i.createdAt.getTime()) / HOUR)} h`, href: `/projects/${i.projectId}/issues`, dedupeKey: `esc-issue:${i.id}` }); }
    const tasks = await prisma.task.findMany({ where: { companyId: c.id, priority: { in: ["HIGH", "URGENT"] }, status: { in: ["NOT_STARTED", "IN_PROGRESS"] }, dueDate: { lt: new Date(startOfToday().getTime() - c.escalateTaskDays * DAY) } }, include: { project: { select: { name: true, managerId: true } } }, take: 50 });
    for (const t of tasks) { out.tasks++; await notify(c.id, [...dirs, t.project.managerId], { type: "ESCALATION", title: "Overdue priority task", body: `${t.title} — ${t.project.name}`, href: `/projects/${t.projectId}/tasks`, dedupeKey: `esc-task:${t.id}` }); }
    const exps = await prisma.expense.findMany({ where: { companyId: c.id, status: "PENDING", createdAt: { lt: new Date(Date.now() - 3 * DAY) } }, take: 50 });
    for (const e of exps) { out.expenses++; await notify(c.id, dirs, { type: "ESCALATION", title: "Expense waiting for approval", body: `${e.description} — ${Math.floor((Date.now() - e.createdAt.getTime()) / DAY)} days`, href: "/expenses?status=PENDING", dedupeKey: `esc-exp:${e.id}` }); }
    const warr = await prisma.warranty.findMany({ where: { companyId: c.id, notifiedAt: null, endDate: { gte: startOfToday(), lte: new Date(startOfToday().getTime() + 30 * DAY) } }, include: { project: { select: { name: true, managerId: true } } } });
    for (const w of warr) { out.warranties++; await notify(c.id, [...dirs, w.project.managerId], { type: "ESCALATION", title: "Warranty expiring soon", body: `${w.item} — ${w.project.name}`, href: `/projects/${w.projectId}/handover`, dedupeKey: `warranty:${w.id}` }); await prisma.warranty.update({ where: { id: w.id }, data: { notifiedAt: new Date() } }); }
  }
  return out;
}

const last = new Map<string, number>();
/** Cheap opportunistic run (at most once a minute per company) so escalations fire even without a scheduler. */
export async function maybeEscalate(companyId: string) {
  if (Date.now() - (last.get(companyId) ?? 0) < 60_000) return;
  last.set(companyId, Date.now());
  await runEscalations(companyId).catch((e) => console.error("[escalate]", e));
}

/** Emails each opted-in user their unread notifications for the period. Users with nothing unread get nothing. */
export async function sendDigests(kind: "DAILY" | "WEEKLY") {
  const since = new Date(Date.now() - (kind === "DAILY" ? DAY : 7 * DAY));
  const users = await prisma.user.findMany({ where: { digest: kind, active: true }, select: { id: true, name: true, email: true, role: true } });
  let sent = 0;
  for (const u of users) {
    const items = await prisma.notification.findMany({ where: { userId: u.id, readAt: null, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 25 });
    if (!items.length) continue;
    const home = ["SITE_ENGINEER", "SITE_SUPERVISOR", "CONTRACTOR"].includes(u.role) ? "/site" : "/dashboard";
    await sendMail({ to: u.email, subject: `ZUARI ${kind === "DAILY" ? "daily" : "weekly"} digest: ${items.length} unread`, text: `Hi ${u.name},\n\nYou have ${items.length} unread notification${items.length > 1 ? "s" : ""}:\n\n${items.map((n) => `• ${n.title}${n.body ? ` — ${n.body}` : ""}`).join("\n")}\n\nOpen ZUARI: ${appUrl()}${home}\n\nChange or stop these emails under Profile.` }).then(() => sent++).catch((e) => console.error("[digest]", e));
  }
  return { users: users.length, sent };
}

import "server-only";
import { prisma } from "./db";

export type Fin = { budget: number; planned: number; spent: number; paid: number; pending: number; committed: number; remaining: number; byCategory: Record<string, { planned: number; spent: number }> };

/**
 * Budget = project budget. Spent = approved + paid expenses. Committed = open purchase-order value not yet invoiced.
 * Remaining = budget − spent − committed.
 */
export async function financeFor(companyId: string, projects: { id: string; budget: unknown }[]): Promise<Map<string, Fin>> {
  const ids = projects.map((p) => p.id);
  const [lines, exps, pos] = await Promise.all([
    prisma.budgetLine.findMany({ where: { companyId, projectId: { in: ids } } }),
    prisma.expense.findMany({ where: { companyId, projectId: { in: ids } }, select: { projectId: true, category: true, amount: true, status: true, poId: true } }),
    prisma.purchaseOrder.findMany({ where: { companyId, projectId: { in: ids }, status: { in: ["APPROVED", "ORDERED", "DELIVERED"] } }, include: { lines: true } }),
  ]);
  const out = new Map<string, Fin>();
  for (const p of projects) {
    const f: Fin = { budget: Number(p.budget), planned: 0, spent: 0, paid: 0, pending: 0, committed: 0, remaining: 0, byCategory: {} };
    const cat = (c: string) => (f.byCategory[c] ??= { planned: 0, spent: 0 });
    for (const l of lines.filter((x) => x.projectId === p.id)) { f.planned += Number(l.amount); cat(l.category).planned += Number(l.amount); }
    const mine = exps.filter((e) => e.projectId === p.id);
    for (const e of mine) {
      const a = Number(e.amount);
      if (e.status === "PENDING") f.pending += a; else { f.spent += a; cat(e.category).spent += a; if (e.status === "PAID") f.paid += a; }
    }
    for (const po of pos.filter((x) => x.projectId === p.id)) {
      const total = po.lines.reduce((s, l) => s + l.quantity * Number(l.rate), 0);
      const invoiced = mine.filter((e) => e.poId === po.id).reduce((s, e) => s + Number(e.amount), 0);
      f.committed += Math.max(0, total - invoiced);
    }
    f.remaining = f.budget - f.spent - f.committed;
    out.set(p.id, f);
  }
  return out;
}

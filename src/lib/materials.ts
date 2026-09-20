import "server-only";
import { prisma } from "./db";

/** Stock is derived from the ledger: received − consumed ± adjustments. */
export async function stockFor(companyId: string, projectId: string) {
  const rows = await prisma.materialTxn.groupBy({ by: ["materialId", "type"], where: { companyId, projectId }, _sum: { quantity: true } });
  const m = new Map<string, { received: number; consumed: number; adjust: number; stock: number }>();
  for (const r of rows) {
    const e = m.get(r.materialId) ?? { received: 0, consumed: 0, adjust: 0, stock: 0 };
    const q = r._sum.quantity ?? 0;
    if (r.type === "RECEIVED") e.received += q; else if (r.type === "CONSUMED") e.consumed += q; else e.adjust += q;
    e.stock = e.received - e.consumed + e.adjust;
    m.set(r.materialId, e);
  }
  return m;
}

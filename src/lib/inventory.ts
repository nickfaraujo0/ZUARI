import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { UserError } from "./errors";

export const INV_CATEGORIES = ["Power tools", "Hand tools", "Scaffolding", "Formwork & props", "Machinery", "Ladders & access", "Safety gear", "Survey & testing", "Other"] as const;
export const WRITE_OFF_REASONS = { LOST: "Lost", DAMAGED: "Damaged", RETIRED: "Retired / scrapped", OTHER: "Other" } as const;
export const INV_KIND = { RECEIPT: "Received", TRANSFER: "Transfer", WRITE_OFF: "Written off", ADJUSTMENT: "Stock count" } as const;

/** A location is a warehouse or a project site: exactly one of the two. Encoded as "w:<id>" / "p:<id>" in forms and URLs. */
export type Loc = { warehouseId: string | null; projectId: string | null };
export const locKey = (l: Loc) => (l.warehouseId ? `w:${l.warehouseId}` : `p:${l.projectId}`);
export function parseLoc(s: string): Loc {
  const [t, id] = (s ?? "").split(":");
  if (!id || (t !== "w" && t !== "p")) throw new UserError("Choose a location.");
  return t === "w" ? { warehouseId: id, projectId: null } : { warehouseId: null, projectId: id };
}
const where = (l: Loc) => (l.warehouseId ? { warehouseId: l.warehouseId } : { projectId: l.projectId });

type Db = Prisma.TransactionClient | typeof prisma;
/** Units of an item currently at a location: the sum of its ledger rows. */
export async function balanceAt(db: Db, companyId: string, itemId: string, loc: Loc) {
  const r = await db.inventoryTxn.aggregate({ where: { companyId, itemId, ...where(loc) }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}

/** Checks the location belongs to the company and returns its display name. */
export async function verifyLoc(companyId: string, loc: Loc, opts: { activeOnly?: boolean } = {}) {
  if (loc.warehouseId) {
    const w = await prisma.warehouse.findFirst({ where: { id: loc.warehouseId, companyId, ...(opts.activeOnly ? { active: true } : {}) } });
    if (!w) throw new UserError("That warehouse isn't available.");
    return w.name;
  }
  const p = await prisma.project.findFirst({ where: { id: loc.projectId!, companyId } });
  if (!p) throw new UserError("That project isn't available.");
  return p.name;
}

/** Stock per item and location. Key: `${itemId}|w:<id>` or `${itemId}|p:<id>`. */
export async function stockMap(companyId: string, filter: { projectIds?: string[]; warehouseIds?: string[]; itemId?: string } = {}) {
  const or: Prisma.InventoryTxnWhereInput[] = [];
  if (filter.projectIds) or.push({ projectId: { in: filter.projectIds } });
  if (filter.warehouseIds) or.push({ warehouseId: { in: filter.warehouseIds } });
  const rows = await prisma.inventoryTxn.groupBy({ by: ["itemId", "warehouseId", "projectId"], where: { companyId, ...(filter.itemId ? { itemId: filter.itemId } : {}), ...(or.length ? { OR: or } : {}) }, _sum: { quantity: true } });
  const m = new Map<string, number>();
  for (const r of rows) { const q = r._sum.quantity ?? 0; if (Math.abs(q) > 1e-9) m.set(`${r.itemId}|${locKey(r)}`, q); }
  return m;
}

/** Equipment currently at a project site, most numerous first. */
export async function siteEquipment(companyId: string, projectId: string, take = 8) {
  const [stock, items] = await Promise.all([stockMap(companyId, { projectIds: [projectId] }), prisma.inventoryItem.findMany({ where: { companyId } })]);
  return items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, category: i.category, qty: stock.get(`${i.id}|p:${projectId}`) ?? 0 })).filter((x) => x.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, take);
}

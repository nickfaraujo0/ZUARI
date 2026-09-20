// Demo inventory: warehouses, equipment, and a dated history of receipts, transfers, write-offs and a stock count.
import type { PrismaClient } from "@prisma/client";
import { logActivity } from "../src/lib/services";

type Ctx = { prisma: PrismaClient; co: string; U: Record<string, string>; day: (n: number) => Date; at: (daysAgo: number, h: number, m?: number) => Date };

export async function seedInventory({ prisma, co, U, day }: Ctx) {
  const P = Object.fromEntries((await prisma.project.findMany({ where: { companyId: co } })).map((p) => [p.name, p]));
  const DONA = "Dona Paula Villa", CAND = "Candolim Residence", PAN = "Panaji Commercial Centre";
  const W: Record<string, string> = {};
  for (const [name, address, contact] of [["Bambolim Warehouse", "Bambolim Industrial Estate, Goa", "Store: Rajan Naik"], ["Ponda Store", "Ponda, Goa", "Store: Dilip Kamat"], ["Verna Yard", "Verna Industrial Estate, Goa", "Yard: Suraj Gawde"]] as const)
    W[name] = (await prisma.warehouse.create({ data: { companyId: co, name, address, contact } })).id;
  const I: Record<string, string> = {};
  for (const [name, category, unit, cost] of [
    ["Drill machine (18 V)", "Power tools", "nos", 6500], ["Angle grinder 4\"", "Power tools", "nos", 3800], ["Rotary hammer", "Power tools", "nos", 14500],
    ["Concrete vibrator (needle)", "Machinery", "nos", 22000], ["Concrete mixer (half bag)", "Machinery", "nos", 65000], ["Plate compactor", "Machinery", "nos", 48000], ["Welding machine", "Machinery", "nos", 24000], ["Generator 5 kVA", "Machinery", "nos", 58000],
    ["Scaffold frame (H-frame)", "Scaffolding", "nos", 1400], ["Scaffold cross brace", "Scaffolding", "nos", 220], ["Scaffold plank (steel)", "Scaffolding", "nos", 950],
    ["Adjustable steel prop", "Formwork & props", "nos", 650], ["Shuttering plate 2×1 m", "Formwork & props", "nos", 1800],
    ["Aluminium ladder 3 m", "Ladders & access", "nos", 3200], ["Safety harness", "Safety gear", "nos", 1800], ["Laser level", "Survey & testing", "nos", 18500], ["Wheelbarrow", "Hand tools", "nos", 2600],
  ] as const) I[name] = (await prisma.inventoryItem.create({ data: { companyId: co, name, category, unit, unitCost: cost } })).id;

  type L = { w?: string; p?: string };
  const loc = (l: L) => (l.w ? { warehouseId: W[l.w], projectId: null } : { warehouseId: null, projectId: P[l.p!].id });
  const label = (l: L) => l.w ?? l.p!;
  const by = U.priya;
  const tx = (item: string, l: L, quantity: number, kind: "RECEIPT" | "WRITE_OFF" | "ADJUSTMENT", ago: number, note: string, user = by) =>
    prisma.inventoryTxn.create({ data: { companyId: co, itemId: I[item], ...loc(l), quantity, kind, date: day(-ago), note, createdById: user } });
  let n = 0;
  const transfer = async (from: L, to: L, ago: number, lines: [string, number][], o: { vehicle?: string; driver?: string; note?: string; user?: string } = {}) => {
    const t = await prisma.inventoryTransfer.create({ data: { companyId: co, number: `TR-${new Date().getFullYear()}-${String(++n).padStart(4, "0")}`, date: day(-ago), fromWarehouseId: loc(from).warehouseId, fromProjectId: loc(from).projectId, toWarehouseId: loc(to).warehouseId, toProjectId: loc(to).projectId, vehicle: o.vehicle, driver: o.driver, note: o.note, createdById: o.user ?? by, createdAt: day(-ago) } });
    await prisma.inventoryTxn.createMany({ data: lines.flatMap(([item, q]) => [{ companyId: co, itemId: I[item], ...loc(from), quantity: -q, kind: "TRANSFER" as const, transferId: t.id, date: day(-ago), note: o.note, createdById: o.user ?? by }, { companyId: co, itemId: I[item], ...loc(to), quantity: q, kind: "TRANSFER" as const, transferId: t.id, date: day(-ago), note: o.note, createdById: o.user ?? by }]) });
    for (const pn of [from.p, to.p].filter((x): x is string => !!x)) await logActivity({ companyId: co, projectId: P[pn].id, actorId: o.user ?? by, type: "INVENTORY", message: `${lines.map(([i, q]) => `${q} × ${i}`).slice(0, 2).join(", ")}${lines.length > 2 ? " …" : ""} moved ${label(from)} → ${label(to)}`, detail: t.number, createdAt: day(-ago) });
    return t;
  };

  const B = { w: "Bambolim Warehouse" }, PO = { w: "Ponda Store" }, V = { w: "Verna Yard" };
  // Opening stock
  for (const [item, q] of [["Drill machine (18 V)", 40], ["Angle grinder 4\"", 20], ["Rotary hammer", 6], ["Scaffold frame (H-frame)", 400], ["Scaffold cross brace", 600], ["Scaffold plank (steel)", 300], ["Adjustable steel prop", 500], ["Shuttering plate 2×1 m", 120], ["Aluminium ladder 3 m", 25], ["Safety harness", 60], ["Laser level", 3], ["Wheelbarrow", 30]] as const) await tx(item, B, q, "RECEIPT", 260, "Opening stock");
  for (const [item, q] of [["Concrete mixer (half bag)", 6], ["Concrete vibrator (needle)", 10], ["Plate compactor", 2], ["Welding machine", 4], ["Generator 5 kVA", 3], ["Adjustable steel prop", 200], ["Scaffold frame (H-frame)", 150]] as const) await tx(item, PO, q, "RECEIPT", 260, "Opening stock");
  for (const [item, q] of [["Shuttering plate 2×1 m", 200], ["Adjustable steel prop", 300], ["Scaffold plank (steel)", 100]] as const) await tx(item, V, q, "RECEIPT", 255, "Opening stock");

  await transfer(B, { p: PAN }, 200, [["Adjustable steel prop", 150], ["Shuttering plate 2×1 m", 60], ["Scaffold frame (H-frame)", 100], ["Scaffold plank (steel)", 60]], { vehicle: "GA-07-T-2210", driver: "Anand Fal Desai", note: "Foundation and basement works", user: U.rohan });
  await transfer(PO, { p: PAN }, 150, [["Concrete mixer (half bag)", 2], ["Concrete vibrator (needle)", 4], ["Generator 5 kVA", 1], ["Adjustable steel prop", 100]], { vehicle: "GA-07-T-3308", driver: "Suresh Velip", note: "Structure works", user: U.rohan });
  await transfer(B, { p: DONA }, 170, [["Scaffold frame (H-frame)", 120], ["Scaffold cross brace", 200], ["Scaffold plank (steel)", 80], ["Drill machine (18 V)", 8], ["Angle grinder 4\"", 4], ["Aluminium ladder 3 m", 6]], { vehicle: "GA-07-T-4821", driver: "Ramesh Gaonkar", note: "Masonry and external scaffolding" });
  await transfer(B, { p: CAND }, 120, [["Scaffold frame (H-frame)", 80], ["Scaffold cross brace", 120], ["Scaffold plank (steel)", 50], ["Drill machine (18 V)", 6], ["Angle grinder 4\"", 4], ["Safety harness", 20]], { vehicle: "GA-07-T-4821", driver: "Ramesh Gaonkar", user: U.priya });
  await transfer(V, { p: PAN }, 12, [["Shuttering plate 2×1 m", 100], ["Adjustable steel prop", 120]], { vehicle: "GA-07-T-2210", driver: "Anand Fal Desai", note: "Ground floor slab shuttering", user: U.rohan });
  await transfer({ p: CAND }, { p: DONA }, 8, [["Drill machine (18 V)", 2], ["Angle grinder 4\"", 1]], { vehicle: "GA-07-T-4821", driver: "Ramesh Gaonkar", note: "Borrowed for tile fixing" });
  // The scenario from the brief: 10 drills from Bambolim to Dona Paula.
  await transfer(B, { p: DONA }, 20, [["Drill machine (18 V)", 10], ["Angle grinder 4\"", 4]], { vehicle: "GA-07-T-4821", driver: "Ramesh Gaonkar", note: "For finishing works" });
  await transfer({ p: DONA }, B, 2, [["Scaffold frame (H-frame)", 120], ["Scaffold cross brace", 200], ["Scaffold plank (steel)", 80]], { vehicle: "GA-07-T-2210", driver: "Anand Fal Desai", note: "External scaffolding dismantled: returned to warehouse" });

  await tx("Scaffold plank (steel)", { p: PAN }, -2, "WRITE_OFF", 30, "Lost: taken by a sub-contractor", U.rohan);
  await tx("Drill machine (18 V)", { p: DONA }, -1, "WRITE_OFF", 5, "Damaged: motor burnt out", U.priya);
  await tx("Safety harness", B, -2, "ADJUSTMENT", 10, "Stock count: 58 counted, 2 missing", U.nick);
  console.log("  ✓ Inventory (3 warehouses, 17 items, 8 dated transfers)");
}

"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj } from "@/lib/action";
import { assertManager, UserError } from "@/lib/access";
import { balanceAt, INV_CATEGORIES, locKey, parseLoc, verifyLoc, WRITE_OFF_REASONS, type Loc } from "@/lib/inventory";
import { logActivity, notify, projectStewards } from "@/lib/services";
import { num, parseDate, startOfToday } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const LINES = 8;
const day = (s: string) => { const d = parseDate(s)!; if (d.getTime() > startOfToday().getTime()) throw new UserError("The date can't be in the future."); return d; };

const wh = z.object({ name: z.string().min(2, "Name the warehouse").max(80), address: z.string().max(200).optional(), contact: z.string().max(100).optional() });
export const createWarehouse = action(async (u, fd) => {
  assertManager(u);
  const d = wh.parse(obj(fd));
  if (await prisma.warehouse.findFirst({ where: { companyId: u.companyId, name: { equals: d.name, mode: "insensitive" } } })) throw new UserError("A warehouse with that name already exists.");
  await prisma.warehouse.create({ data: { ...d, companyId: u.companyId } });
  refresh(); return { message: "Warehouse added" };
});
export const updateWarehouse = action(async (u, fd) => {
  assertManager(u);
  const d = wh.extend({ id: cuid("Warehouse"), active: z.enum(["true", "false"]) }).parse(obj(fd));
  if (d.active === "false") {
    const held = await prisma.inventoryTxn.groupBy({ by: ["itemId"], where: { companyId: u.companyId, warehouseId: d.id }, _sum: { quantity: true } });
    if (held.some((h) => (h._sum.quantity ?? 0) > 1e-9)) throw new UserError("Move the stock out of this warehouse before deactivating it.");
  }
  const r = await prisma.warehouse.updateMany({ where: { id: d.id, companyId: u.companyId }, data: { name: d.name, address: d.address ?? null, contact: d.contact ?? null, active: d.active === "true" } });
  if (!r.count) throw new UserError("Warehouse not found.");
  refresh(); return { message: "Saved" };
});

const item = z.object({ name: z.string().min(2, "Name the item").max(80), category: z.enum(INV_CATEGORIES), unit: z.string().min(1).max(20).default("nos"), unitCost: z.coerce.number().min(0).max(1e8).optional(), notes: z.string().max(300).optional() });
export const createItem = action(async (u, fd) => {
  assertManager(u);
  const d = item.parse(obj(fd));
  if (await prisma.inventoryItem.findFirst({ where: { companyId: u.companyId, name: { equals: d.name, mode: "insensitive" } } })) throw new UserError("That item already exists.");
  await prisma.inventoryItem.create({ data: { ...d, companyId: u.companyId } });
  refresh(); return { message: "Item added" };
});
export const updateItem = action(async (u, fd) => {
  assertManager(u);
  const d = item.extend({ id: cuid("Item"), active: z.enum(["true", "false"]) }).parse(obj(fd));
  const r = await prisma.inventoryItem.updateMany({ where: { id: d.id, companyId: u.companyId }, data: { name: d.name, category: d.category, unit: d.unit, unitCost: d.unitCost ?? null, notes: d.notes ?? null, active: d.active === "true" } });
  if (!r.count) throw new UserError("Item not found.");
  refresh(); return { message: "Saved" };
});

async function getItem(companyId: string, id: string) {
  const i = await prisma.inventoryItem.findFirst({ where: { id, companyId } });
  if (!i) throw new UserError("Choose an item from the catalogue.");
  return i;
}
const involved = async (companyId: string, locs: Loc[], text: string, detail: string, actorId: string, actorName: string, type = "INVENTORY") => {
  for (const pid of new Set(locs.map((l) => l.projectId).filter((x): x is string => !!x))) {
    const p = await prisma.project.findUnique({ where: { id: pid } });
    if (!p) continue;
    await logActivity({ companyId, projectId: pid, actorId, type, message: text, detail });
    await notify(companyId, await projectStewards(companyId, p.managerId), { type, title: "Equipment movement", body: `${text}${detail ? ` — ${detail}` : ""}`, href: `/inventory/at/${locKey({ warehouseId: null, projectId: pid }).replace(":", "-")}` }, actorId);
  }
  void actorName;
};

/** New stock arriving (a purchase, or opening balance). */
export const receiveStock = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ itemId: cuid("Item"), at: z.string(), quantity: z.coerce.number({ error: "Enter a quantity" }).positive("Quantity must be above zero").max(1e6), date: dateStr("Date"), note: z.string().max(300).optional() }).parse(obj(fd));
  const it = await getItem(u.companyId, d.itemId), loc = parseLoc(d.at), name = await verifyLoc(u.companyId, loc, { activeOnly: true });
  await prisma.inventoryTxn.create({ data: { companyId: u.companyId, itemId: it.id, ...loc, quantity: d.quantity, kind: "RECEIPT", date: day(d.date), note: d.note, createdById: u.id } });
  await involved(u.companyId, [loc], `${u.name} received ${num(d.quantity)} ${it.name}`, name, u.id, u.name);
  refresh(); return { message: `${num(d.quantity)} ${it.unit} of ${it.name} added at ${name}` };
});

/** A dispatch between two locations. Every item is checked against the source's stock inside one serializable transaction. */
export const createTransfer = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ from: z.string(), to: z.string(), date: dateStr("Date"), vehicle: z.string().max(40).optional(), driver: z.string().max(80).optional(), note: z.string().max(300).optional() }).parse(obj(fd));
  const from = parseLoc(d.from), to = parseLoc(d.to);
  if (locKey(from) === locKey(to)) throw new UserError("Choose two different locations.");
  const [fromName, toName] = await Promise.all([verifyLoc(u.companyId, from), verifyLoc(u.companyId, to, { activeOnly: true })]);
  const date = day(d.date);
  const want = new Map<string, number>();
  for (let i = 0; i < LINES; i++) {
    const id = String(fd.get(`item_${i}`) ?? ""), q = Number(fd.get(`qty_${i}`));
    if (!id && !q) continue;
    if (!id || !(q > 0)) throw new UserError(`Line ${i + 1}: choose an item and a quantity above zero.`);
    want.set(id, (want.get(id) ?? 0) + q);
  }
  if (!want.size) throw new UserError("Add at least one item to move.");
  const items = new Map((await prisma.inventoryItem.findMany({ where: { companyId: u.companyId, id: { in: [...want.keys()] } } })).map((i) => [i.id, i]));
  for (const id of want.keys()) if (!items.get(id)?.active) throw new UserError("One of the items isn't in the active catalogue.");

  let transfer;
  for (let attempt = 0; attempt < 3 && !transfer; attempt++) {
    try {
      transfer = await prisma.$transaction(async (tx) => {
        for (const [id, q] of want) {
          const have = await balanceAt(tx, u.companyId, id, from), it = items.get(id)!;
          if (q > have + 1e-9) throw new UserError(`Only ${num(have)} ${it.unit} of ${it.name} at ${fromName}. You tried to move ${num(q)}.`);
        }
        const number = `TR-${new Date().getFullYear()}-${String((await tx.inventoryTransfer.count({ where: { companyId: u.companyId } })) + 1 + attempt).padStart(4, "0")}`;
        const t = await tx.inventoryTransfer.create({ data: { companyId: u.companyId, number, date, fromWarehouseId: from.warehouseId, fromProjectId: from.projectId, toWarehouseId: to.warehouseId, toProjectId: to.projectId, vehicle: d.vehicle, driver: d.driver, note: d.note, createdById: u.id } });
        await tx.inventoryTxn.createMany({ data: [...want].flatMap(([itemId, q]) => [
          { companyId: u.companyId, itemId, ...from, quantity: -q, kind: "TRANSFER" as const, transferId: t.id, date, note: d.note, createdById: u.id },
          { companyId: u.companyId, itemId, ...to, quantity: q, kind: "TRANSFER" as const, transferId: t.id, date, note: d.note, createdById: u.id },
        ]) });
        return t;
      }, { isolationLevel: "Serializable" });
    } catch (e) { if (["P2034", "P2002"].includes((e as { code?: string }).code ?? "") && attempt < 2) continue; throw e; }
  }
  const summary = [...want].map(([id, q]) => `${num(q)} × ${items.get(id)!.name}`).join(", ");
  await involved(u.companyId, [from, to], `${summary} moved ${fromName} → ${toName}`, transfer!.number, u.id, u.name);
  refresh(); redirect(`/inventory/transfers/${transfer!.id}`);
});

/** Loss, damage or retirement: removes units from a location, with the reason on record. */
export const writeOff = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ itemId: cuid("Item"), at: z.string(), quantity: z.coerce.number({ error: "Enter a quantity" }).positive("Quantity must be above zero"), reason: z.enum(["LOST", "DAMAGED", "RETIRED", "OTHER"]), date: dateStr("Date"), note: z.string().max(300).optional() }).parse(obj(fd));
  const it = await getItem(u.companyId, d.itemId), loc = parseLoc(d.at), name = await verifyLoc(u.companyId, loc);
  const date = day(d.date);
  await prisma.$transaction(async (tx) => {
    const have = await balanceAt(tx, u.companyId, it.id, loc);
    if (d.quantity > have + 1e-9) throw new UserError(`Only ${num(have)} ${it.unit} of ${it.name} at ${name}.`);
    await tx.inventoryTxn.create({ data: { companyId: u.companyId, itemId: it.id, ...loc, quantity: -d.quantity, kind: "WRITE_OFF", date, note: `${WRITE_OFF_REASONS[d.reason]}${d.note ? `: ${d.note}` : ""}`, createdById: u.id } });
  }, { isolationLevel: "Serializable" });
  await involved(u.companyId, [loc], `${num(d.quantity)} ${it.name} written off (${WRITE_OFF_REASONS[d.reason].toLowerCase()})`, name, u.id, u.name);
  refresh(); return { message: `${num(d.quantity)} ${it.unit} of ${it.name} written off at ${name}` };
});

/** Stock count: sets a location's quantity to what was physically counted; the difference is logged. */
export const adjustCount = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ itemId: cuid("Item"), at: z.string(), counted: z.coerce.number({ error: "Enter the counted quantity" }).min(0).max(1e6), date: dateStr("Date"), note: z.string().max(300).optional() }).parse(obj(fd));
  const it = await getItem(u.companyId, d.itemId), loc = parseLoc(d.at), name = await verifyLoc(u.companyId, loc);
  const date = day(d.date);
  const diff = await prisma.$transaction(async (tx) => {
    const diff = d.counted - (await balanceAt(tx, u.companyId, it.id, loc));
    if (Math.abs(diff) > 1e-9) await tx.inventoryTxn.create({ data: { companyId: u.companyId, itemId: it.id, ...loc, quantity: diff, kind: "ADJUSTMENT", date, note: `Stock count: ${num(d.counted)} counted${d.note ? ` — ${d.note}` : ""}`, createdById: u.id } });
    return diff;
  }, { isolationLevel: "Serializable" });
  if (Math.abs(diff) > 1e-9) await involved(u.companyId, [loc], `Stock count corrected ${it.name} by ${diff > 0 ? "+" : ""}${num(diff)}`, name, u.id, u.name);
  refresh(); return { message: Math.abs(diff) < 1e-9 ? "The count already matches the records." : `Recorded ${diff > 0 ? "+" : ""}${num(diff)} ${it.unit}: ${name} now has ${num(d.counted)}` };
});

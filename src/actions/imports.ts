"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, files, obj } from "@/lib/action";
import { assertManager, UserError } from "@/lib/access";
import { parseCsv } from "@/lib/csv";

const MAX_ROWS = 500;
const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");
type Row = Record<string, string>;
type Handler = (co: string, rows: Row[]) => Promise<{ ok: number; errors: string[] }>;

async function run<T extends { name: string }>(rows: Row[], existing: string[], build: (r: Row) => T | string, insert: (items: T[]) => Promise<unknown>) {
  const seen = new Set(existing.map((n) => n.toLowerCase())), items: T[] = [], errors: string[] = [];
  rows.forEach((r, i) => { const b = build(r); if (typeof b === "string") return errors.push(`Row ${i + 2}: ${b}`); const k = b.name.toLowerCase(); if (seen.has(k)) return errors.push(`Row ${i + 2}: “${b.name}” already exists`); seen.add(k); items.push(b); });
  if (items.length) await insert(items);
  return { ok: items.length, errors };
}
const HANDLERS: Record<string, Handler> = {
  workers: async (co, rows) => {
    const cons = new Map((await prisma.contractor.findMany({ where: { companyId: co } })).map((c) => [c.name.toLowerCase(), c.id]));
    return run(rows, (await prisma.worker.findMany({ where: { companyId: co }, select: { name: true } })).map((w) => w.name), (r) => { if (!r.name) return "name is required"; if (!r.trade) return "trade is required"; const rate = Number(r.daily_rate || 0); if (!(rate >= 0) || rate > 100000) return "daily_rate must be a number"; const cid = r.contractor ? cons.get(r.contractor.toLowerCase()) : undefined; if (r.contractor && !cid) return `unknown contractor “${r.contractor}”`; return { name: r.name, trade: r.trade, dailyRate: rate, phone: r.phone || null, contractorId: cid ?? null, companyId: co }; }, (data) => prisma.worker.createMany({ data }));
  },
  materials: async (co, rows) => run(rows, (await prisma.material.findMany({ where: { companyId: co }, select: { name: true } })).map((m) => m.name), (r) => { if (!r.name) return "name is required"; if (!r.unit) return "unit is required"; const lvl = Number(r.reorder_level || 0); if (!(lvl >= 0)) return "reorder_level must be a number"; return { name: r.name, unit: r.unit, category: r.category || null, reorderLevel: lvl, companyId: co }; }, (data) => prisma.material.createMany({ data })),
  suppliers: async (co, rows) => run(rows, (await prisma.supplier.findMany({ where: { companyId: co }, select: { name: true } })).map((m) => m.name), (r) => r.name ? { name: r.name, category: r.category || null, contactName: r.contact || null, phone: r.phone || null, email: r.email || null, gstin: r.gstin || null, address: r.address || null, companyId: co } : "name is required", (data) => prisma.supplier.createMany({ data })),
  contractors: async (co, rows) => run(rows, (await prisma.contractor.findMany({ where: { companyId: co }, select: { name: true } })).map((m) => m.name), (r) => !r.name ? "name is required" : !r.trade ? "trade is required" : { name: r.name, trade: r.trade, contactName: r.contact || null, phone: r.phone || null, email: r.email || null, gstin: r.gstin || null, companyId: co }, (data) => prisma.contractor.createMany({ data })),
};

export const importCsv = action(async (u, fd) => {
  assertManager(u);
  const { kind } = z.object({ kind: z.enum(["workers", "materials", "suppliers", "contractors"]) }).parse(obj(fd));
  const file = files(fd, "file")[0];
  if (!file) throw new UserError("Choose a CSV file.");
  if (file.size > 1_000_000) throw new UserError("The file must be under 1 MB.");
  const table = parseCsv(await file.text());
  if (table.length < 2) throw new UserError("The file needs a header row and at least one data row.");
  if (table.length - 1 > MAX_ROWS) throw new UserError(`Import at most ${MAX_ROWS} rows at a time.`);
  const head = table[0].map(norm);
  const rows = table.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
  const { ok, errors } = await HANDLERS[kind](u.companyId, rows);
  revalidatePath("/", "layout");
  if (!ok && errors.length) throw new UserError(`Nothing imported. ${errors.slice(0, 4).join("; ")}${errors.length > 4 ? `; and ${errors.length - 4} more` : ""}`);
  return { message: `Imported ${ok} ${kind}${errors.length ? `. Skipped ${errors.length}: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "…" : ""}` : "."}` };
});

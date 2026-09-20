import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireManagerPage } from "@/lib/access";
import { INV_CATEGORIES, stockMap } from "@/lib/inventory";
import { createItem, createWarehouse, updateItem, updateWarehouse } from "@/actions/inventory";
import { ActionForm } from "@/components/forms";
import { Card, CardHead, Chip, Field, inputCls, PageHeader, Select } from "@/components/ui";
import { formatINR, num } from "@/lib/utils";

export const metadata = { title: "Inventory setup" };
const active = [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }];
const cats = INV_CATEGORIES.map((c) => ({ value: c, label: c }));

export default async function ManageInventory() {
  const u = await requireUser();
  requireManagerPage(u);
  const [warehouses, items, stock] = await Promise.all([prisma.warehouse.findMany({ where: { companyId: u.companyId }, orderBy: [{ active: "desc" }, { name: "asc" }] }), prisma.inventoryItem.findMany({ where: { companyId: u.companyId }, orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }] }), stockMap(u.companyId)]);
  const totalOf = (id: string) => [...stock].filter(([k]) => k.startsWith(`${id}|`)).reduce((s, [, q]) => s + q, 0);
  const inWh = (id: string) => [...stock].filter(([k]) => k.endsWith(`|w:${id}`)).length;
  return (
    <>
      <PageHeader title="Items & warehouses" sub="The catalogue of reusable equipment, and the places you store it." actions={<Link href="/inventory" className="text-sm text-river hover:underline">← Inventory</Link>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHead title="Warehouses" sub={`${warehouses.filter((w) => w.active).length} active`} />
            <ul className="divide-y divide-line/70 border-t border-line/70">{warehouses.map((w) => (
              <li key={w.id} className={`px-5 py-3 ${w.active ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><Link href={`/inventory/at/w-${w.id}`} className="text-sm font-medium hover:underline">{w.name}</Link><p className="text-xs text-muted">{[w.address, w.contact].filter(Boolean).join(" · ") || "No details"} · {inWh(w.id)} item types held</p></div>{!w.active && <Chip>Inactive</Chip>}</div>
                <details className="mt-1"><summary className="cursor-pointer text-xs font-medium text-river">Edit</summary>
                  <ActionForm action={updateWarehouse} submit="Save" size="sm" variant="secondary" className="mt-2 grid gap-3 rounded-lg border border-line bg-stone-50 p-3"><input type="hidden" name="id" value={w.id} /><Field label="Name"><input name="name" required defaultValue={w.name} className={inputCls} /></Field><Field label="Address"><input name="address" defaultValue={w.address ?? ""} className={inputCls} /></Field><Field label="Contact / storekeeper"><input name="contact" defaultValue={w.contact ?? ""} className={inputCls} /></Field><Field label="Status"><Select name="active" defaultValue={String(w.active)} options={active} /></Field></ActionForm></details></li>))}
              {!warehouses.length && <li className="px-5 py-6 text-sm text-muted">No warehouses yet.</li>}</ul>
            <ActionForm action={createWarehouse} reset submit="Add warehouse" size="sm" className="grid gap-3 border-t border-line bg-stone-50/60 p-5"><Field label="New warehouse"><input name="name" required className={inputCls} placeholder="Bambolim Warehouse" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Address"><input name="address" className={inputCls} /></Field><Field label="Contact"><input name="contact" className={inputCls} /></Field></div></ActionForm>
          </Card>
        </div>
        <Card>
          <CardHead title="Item catalogue" sub={`${items.filter((i) => i.active).length} active`} />
          <ul className="max-h-[640px] divide-y divide-line/70 overflow-y-auto border-t border-line/70">{items.map((i) => (
            <li key={i.id} className={`px-5 py-2.5 ${i.active ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-2 text-sm"><span className="flex-1"><Link href={`/inventory/items/${i.id}`} className="font-medium hover:underline">{i.name}</Link> <span className="text-xs text-muted">· {i.category} · {i.unit}{i.unitCost ? ` · ${formatINR(Number(i.unitCost))} each` : ""}</span></span><span className="text-xs tabular-nums text-muted">{num(totalOf(i.id))} in total</span>{!i.active && <Chip>Inactive</Chip>}</div>
              <details className="mt-1"><summary className="cursor-pointer text-xs font-medium text-river">Edit</summary>
                <ActionForm action={updateItem} submit="Save" size="sm" variant="secondary" className="mt-2 grid gap-3 rounded-lg border border-line bg-stone-50 p-3 sm:grid-cols-2"><input type="hidden" name="id" value={i.id} /><Field label="Name" className="sm:col-span-2"><input name="name" required defaultValue={i.name} className={inputCls} /></Field><Field label="Category"><Select name="category" defaultValue={i.category} options={cats} /></Field><Field label="Unit"><input name="unit" defaultValue={i.unit} className={inputCls} /></Field><Field label="Unit cost (₹, optional)"><input name="unitCost" type="number" min={0} step="any" defaultValue={i.unitCost ? Number(i.unitCost) : ""} className={inputCls} /></Field><Field label="Status"><Select name="active" defaultValue={String(i.active)} options={active} /></Field><Field label="Notes" className="sm:col-span-2"><input name="notes" defaultValue={i.notes ?? ""} className={inputCls} /></Field></ActionForm></details></li>))}
            {!items.length && <li className="px-5 py-6 text-sm text-muted">No items yet.</li>}</ul>
          <ActionForm action={createItem} reset submit="Add item" size="sm" className="grid gap-3 border-t border-line bg-stone-50/60 p-5 sm:grid-cols-2"><Field label="New item" className="sm:col-span-2"><input name="name" required className={inputCls} placeholder="Drill machine (18 V)" /></Field><Field label="Category"><Select name="category" defaultValue="Power tools" options={cats} /></Field><Field label="Unit"><input name="unit" defaultValue="nos" className={inputCls} placeholder="nos, sets, m…" /></Field><Field label="Unit cost (₹, optional)"><input name="unitCost" type="number" min={0} step="any" className={inputCls} /></Field><Field label="Notes"><input name="notes" className={inputCls} /></Field></ActionForm>
        </Card>
      </div>
    </>
  );
}

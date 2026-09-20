import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Truck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager } from "@/lib/access";
import { parseLoc } from "@/lib/inventory";
import { Card, CardHead, EmptyState, inputCls, PageHeader } from "@/components/ui";
import { fmtDate, num, parseDate } from "@/lib/utils";

export const metadata = { title: "Transfer log" };
const CSV_URL = "/api/export/inventory-transfers";

export default async function Transfers({ searchParams }: { searchParams: Promise<{ item?: string; at?: string; from?: string; to?: string }> }) {
  const u = await requireUser();
  if (!isManager(u) && u.role !== "ACCOUNTANT") notFound();
  const sp = await searchParams;
  let loc: ReturnType<typeof parseLoc> | null = null; try { loc = sp.at ? parseLoc(sp.at) : null; } catch { loc = null; }
  const f = parseDate(sp.from), t = parseDate(sp.to);
  const where: Prisma.InventoryTransferWhereInput = {
    companyId: u.companyId, ...(f || t ? { date: { ...(f ? { gte: f } : {}), ...(t ? { lte: t } : {}) } } : {}), ...(sp.item ? { txns: { some: { itemId: sp.item } } } : {}),
    ...(loc ? { OR: loc.warehouseId ? [{ fromWarehouseId: loc.warehouseId }, { toWarehouseId: loc.warehouseId }] : [{ fromProjectId: loc.projectId }, { toProjectId: loc.projectId }] } : {}),
  };
  const [list, items, warehouses, projects] = await Promise.all([
    prisma.inventoryTransfer.findMany({ where, include: { fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } }, fromProject: { select: { name: true } }, toProject: { select: { name: true } }, createdBy: { select: { name: true } }, txns: { where: { quantity: { gt: 0 } }, include: { item: { select: { name: true, unit: true } } } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 200 }),
    prisma.inventoryItem.findMany({ where: { companyId: u.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: { companyId: u.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { companyId: u.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Transfer log" sub="Every movement of equipment between warehouses and sites, with its date." actions={<><a href={CSV_URL} download className="rounded-lg border border-line bg-white px-3 py-2 text-sm">Download CSV</a><Link href="/inventory" className="text-sm text-river hover:underline">← Inventory</Link></>} />
      <Card>
        <CardHead title={`${list.length} transfer${list.length === 1 ? "" : "s"}`} />
        <form className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-3">
          <select name="item" defaultValue={sp.item ?? ""} className={`${inputCls} h-9 w-52`}><option value="">Any item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
          <select name="at" defaultValue={sp.at ?? ""} className={`${inputCls} h-9 w-56`}><option value="">Any location</option><optgroup label="Warehouses">{warehouses.map((w) => <option key={w.id} value={`w:${w.id}`}>{w.name}</option>)}</optgroup><optgroup label="Sites">{projects.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup></select>
          <label className="text-[11px] text-muted">From<input type="date" name="from" defaultValue={sp.from} className={`${inputCls} mt-1 h-9 w-40`} /></label><label className="text-[11px] text-muted">To<input type="date" name="to" defaultValue={sp.to} className={`${inputCls} mt-1 h-9 w-40`} /></label>
          <button className="h-9 rounded-lg bg-river px-4 text-sm font-medium text-ivory">Filter</button><Link href="?" className="pb-2 text-xs text-muted hover:underline">Clear</Link>
        </form>
        {!list.length ? <EmptyState icon={<Truck className="size-5" />} title="No transfers found" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Date</th><th className="px-3 font-medium">No.</th><th className="px-3 font-medium">From → To</th><th className="px-3 font-medium">Items</th><th className="px-3 font-medium">Vehicle / driver</th><th className="px-3 font-medium">By</th></tr></thead>
            <tbody>{list.map((x) => (
              <tr key={x.id} className="border-b border-line/70 last:border-0 hover:bg-stone-50/60"><td className="whitespace-nowrap px-5 py-3 text-[13px]">{fmtDate(x.date)}</td><td className="px-3"><Link href={`/inventory/transfers/${x.id}`} className="font-mono text-[13px] font-medium hover:underline">{x.number}</Link></td>
                <td className="px-3">{x.fromWarehouse?.name ?? x.fromProject?.name} <span className="text-muted">→</span> {x.toWarehouse?.name ?? x.toProject?.name}</td><td className="px-3 text-[13px]">{x.txns.slice(0, 3).map((l) => `${num(l.quantity)} × ${l.item.name}`).join(", ")}{x.txns.length > 3 ? ` +${x.txns.length - 3}` : ""}</td><td className="px-3 text-xs text-muted">{[x.vehicle, x.driver].filter(Boolean).join(" · ") || "—"}</td><td className="px-3 text-xs text-muted">{x.createdBy.name}</td></tr>))}</tbody></table></div>
        )}
      </Card>
    </>
  );
}

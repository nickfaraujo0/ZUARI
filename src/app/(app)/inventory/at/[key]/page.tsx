import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFinance, isManager } from "@/lib/access";
import { INV_KIND, stockMap } from "@/lib/inventory";
import { Card, CardHead, Chip, PageHeader, Stat } from "@/components/ui";
import { fmtDate, formatINR, num } from "@/lib/utils";

export const metadata = { title: "Location stock" };

export default async function AtLocation({ params }: { params: Promise<{ key: string }> }) {
  const u = await requireUser();
  if (!isManager(u) && u.role !== "ACCOUNTANT") notFound();
  const [t, id] = (await params).key.split("-");
  if (!id || (t !== "w" && t !== "p")) notFound();
  const place = t === "w" ? await prisma.warehouse.findFirst({ where: { id, companyId: u.companyId } }) : await prisma.project.findFirst({ where: { id, companyId: u.companyId } });
  if (!place) notFound();
  const [stock, items, hist] = await Promise.all([stockMap(u.companyId, t === "w" ? { warehouseIds: [id] } : { projectIds: [id] }), prisma.inventoryItem.findMany({ where: { companyId: u.companyId } }),
    prisma.inventoryTxn.findMany({ where: { companyId: u.companyId, ...(t === "w" ? { warehouseId: id } : { projectId: id }) }, include: { item: { select: { name: true, unit: true } }, createdBy: { select: { name: true } }, transfer: { include: { fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } }, fromProject: { select: { name: true } }, toProject: { select: { name: true } } } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 })]);
  const held = items.map((i) => ({ i, q: stock.get(`${i.id}|${t}:${id}`) ?? 0 })).filter((x) => x.q > 0).sort((a, b) => a.i.category.localeCompare(b.i.category) || a.i.name.localeCompare(b.i.name));
  const value = held.reduce((s, x) => s + x.q * Number(x.i.unitCost ?? 0), 0);
  const other = (h: (typeof hist)[number]) => { if (!h.transfer) return null; const tr = h.transfer, side = h.quantity < 0 ? { w: tr.toWarehouse, p: tr.toProject } : { w: tr.fromWarehouse, p: tr.fromProject }; return `${h.quantity < 0 ? "to" : "from"} ${side.w?.name ?? side.p?.name}`; };
  return (
    <>
      <PageHeader title={place.name} sub={t === "w" ? `Warehouse${"address" in place && place.address ? ` · ${place.address}` : ""}` : "Site"} actions={<><Link href={`/inventory/transfers?at=${t}:${id}`} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">Transfers here</Link><Link href="/inventory" className="text-sm text-river hover:underline">← Inventory</Link></>} />
      <div className="mb-6 grid max-w-2xl grid-cols-3 gap-4"><Stat label="Item types" value={held.length} /><Stat label="Units" value={num(held.reduce((s, x) => s + x.q, 0))} />{isFinance(u) && value ? <Stat label="Est. value" value={formatINR(value)} /> : <span />}</div>
      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card><CardHead title="Stock here now" /><ul className="divide-y divide-line/70 border-t border-line/70">{held.map(({ i, q }) => <li key={i.id}><Link href={`/inventory/items/${i.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-stone-50"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{i.name}</span><span className="text-xs text-muted">{i.category}</span></span><span className="font-semibold tabular-nums">{num(q)} <span className="text-xs font-normal text-muted">{i.unit}</span></span></Link></li>)}{!held.length && <li className="px-5 py-6 text-sm text-muted">Nothing is stored here.</li>}</ul></Card>
        <Card><CardHead title="Movements at this location" sub="By the date they happened" />
          <ul className="divide-y divide-line/70 border-t border-line/70">{hist.map((h) => <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm"><span className="w-24 text-xs tabular-nums text-muted">{fmtDate(h.date)}</span><span className={`w-14 text-right font-semibold tabular-nums ${h.quantity < 0 ? "text-red-700" : "text-emerald-700"}`}>{h.quantity > 0 ? "+" : ""}{num(h.quantity)}</span><span className="min-w-0 flex-1 basis-48"><span className="font-medium">{h.item.name}</span> <span className="text-xs text-muted">{other(h) ?? h.note ?? ""}</span></span>{h.transfer ? <Link href={`/inventory/transfers/${h.transfer.id}`} className="font-mono text-[11px] text-muted hover:underline">{h.transfer.number}</Link> : <Chip tone={h.kind === "WRITE_OFF" ? "red" : "green"}>{INV_KIND[h.kind]}</Chip>}</li>)}{!hist.length && <li className="px-5 py-6 text-sm text-muted">No movements yet.</li>}</ul></Card>
      </div>
    </>
  );
}

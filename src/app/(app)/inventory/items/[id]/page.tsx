import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFinance, isManager } from "@/lib/access";
import { INV_KIND, stockMap } from "@/lib/inventory";
import { Card, CardHead, Chip, PageHeader, Stat } from "@/components/ui";
import { fmtDate, formatINR, num } from "@/lib/utils";

export const metadata = { title: "Item" };

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (!isManager(u) && u.role !== "ACCOUNTANT") notFound();
  const item = await prisma.inventoryItem.findFirst({ where: { id: (await params).id, companyId: u.companyId } });
  if (!item) notFound();
  const [stock, warehouses, projects, hist] = await Promise.all([stockMap(u.companyId, { itemId: item.id }), prisma.warehouse.findMany({ where: { companyId: u.companyId } }), prisma.project.findMany({ where: { companyId: u.companyId }, select: { id: true, name: true } }),
    prisma.inventoryTxn.findMany({ where: { companyId: u.companyId, itemId: item.id }, include: { warehouse: { select: { name: true } }, project: { select: { name: true } }, createdBy: { select: { name: true } }, transfer: { select: { id: true, number: true, vehicle: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 120 })]);
  const where = [...warehouses.map((w) => ({ key: `w:${w.id}`, name: w.name, href: `/inventory/at/w-${w.id}`, site: false })), ...projects.map((p) => ({ key: `p:${p.id}`, name: p.name, href: `/inventory/at/p-${p.id}`, site: true }))].map((l) => ({ ...l, qty: stock.get(`${item.id}|${l.key}`) ?? 0 })).filter((l) => l.qty > 0).sort((a, b) => b.qty - a.qty);
  const total = where.reduce((s, l) => s + l.qty, 0);
  return (
    <>
      <PageHeader title={item.name} sub={`${item.category} · counted in ${item.unit}${item.notes ? ` · ${item.notes}` : ""}`} actions={<Link href="/inventory" className="text-sm text-river hover:underline">← Inventory</Link>} />
      <div className="mb-6 grid max-w-2xl grid-cols-3 gap-4"><Stat label="Total units" value={num(total)} /><Stat label="Locations" value={where.length} />{isFinance(u) && item.unitCost ? <Stat label="Est. value" value={formatINR(total * Number(item.unitCost))} /> : <span />}</div>
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card><CardHead title="Where it is now" /><ul className="divide-y divide-line/70 border-t border-line/70">{where.map((l) => <li key={l.key}><Link href={l.href} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50"><span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span><Chip tone={l.site ? "teal" : "sand"}>{l.site ? "Site" : "Warehouse"}</Chip><span className="w-14 text-right font-semibold tabular-nums">{num(l.qty)}</span></Link></li>)}{!where.length && <li className="px-5 py-6 text-sm text-muted">None in stock anywhere.</li>}</ul></Card>
        <Card>
          <CardHead title="Movement history" sub="Newest first, by the date it happened" />
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Date</th><th className="px-3 font-medium">What</th><th className="px-3 font-medium">Location</th><th className="px-3 text-right font-medium">Qty</th><th className="px-3 font-medium">By / note</th></tr></thead>
            <tbody>{hist.map((h) => <tr key={h.id} className="border-b border-line/70 last:border-0"><td className="whitespace-nowrap px-5 py-2.5 text-[13px]">{fmtDate(h.date)}</td><td className="px-3">{h.transfer ? <Link href={`/inventory/transfers/${h.transfer.id}`} className="font-mono text-xs hover:underline">{h.transfer.number}</Link> : <Chip tone={h.kind === "WRITE_OFF" ? "red" : h.kind === "RECEIPT" ? "green" : "grey"}>{INV_KIND[h.kind]}</Chip>}</td><td className="px-3">{h.warehouse?.name ?? h.project?.name}</td><td className={`px-3 text-right font-medium tabular-nums ${h.quantity < 0 ? "text-red-700" : "text-emerald-700"}`}>{h.quantity > 0 ? "+" : ""}{num(h.quantity)}</td><td className="px-3 text-xs text-muted">{h.createdBy.name}{h.note ? ` · ${h.note}` : ""}</td></tr>)}{!hist.length && <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-muted">No movements yet.</td></tr>}</tbody></table></div>
        </Card>
      </div>
    </>
  );
}

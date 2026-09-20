import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFinance, isManager, projectScope } from "@/lib/access";
import { INV_CATEGORIES, stockMap } from "@/lib/inventory";
import { CountForm, ReceiveForm, TransferForm, WriteOffForm } from "@/components/inventory-forms";
import { Card, CardHead, EmptyState, inputCls, LinkButton, PageHeader, Stat } from "@/components/ui";
import { cn, fmtShort, formatINR, num } from "@/lib/utils";

export const metadata = { title: "Inventory" };

export default async function Inventory({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const u = await requireUser();
  if (!isManager(u) && u.role !== "ACCOUNTANT") notFound();
  const sp = await searchParams, canEdit = isManager(u), fin = isFinance(u);
  const [warehouses, projects, items, stock, recent] = await Promise.all([
    prisma.warehouse.findMany({ where: { companyId: u.companyId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({ where: { companyId: u.companyId, active: true, ...(sp.category ? { category: sp.category } : {}), ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" } } : {}) }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    stockMap(u.companyId),
    prisma.inventoryTransfer.findMany({ where: { companyId: u.companyId }, include: { fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } }, fromProject: { select: { name: true } }, toProject: { select: { name: true } }, txns: { where: { quantity: { gt: 0 } }, include: { item: { select: { name: true } } } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 8 }),
  ]);
  const has = (key: string) => [...stock.keys()].some((k) => k.endsWith(`|${key}`));
  const cols = [...warehouses.filter((w) => w.active || has(`w:${w.id}`)).map((w) => ({ key: `w:${w.id}`, name: w.name, href: `/inventory/at/w-${w.id}`, site: false })), ...projects.filter((p) => p.status !== "COMPLETED" || has(`p:${p.id}`)).map((p) => ({ key: `p:${p.id}`, name: p.name, href: `/inventory/at/p-${p.id}`, site: true }))];
  const all = await prisma.inventoryItem.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true, unit: true, unitCost: true } });
  const totalOf = (id: string) => cols.reduce((s, c) => s + (stock.get(`${id}|${c.key}`) ?? 0), 0);
  const units = all.reduce((s, i) => s + totalOf(i.id), 0), types = all.filter((i) => totalOf(i.id) > 0).length;
  const value = all.reduce((s, i) => s + totalOf(i.id) * Number(i.unitCost ?? 0), 0);
  const sitesHolding = cols.filter((c) => c.site && all.some((i) => (stock.get(`${i.id}|${c.key}`) ?? 0) > 0)).length;
  const wOpts = warehouses.filter((w) => w.active).map((w) => ({ id: w.id, name: w.name })), pOpts = projects.filter((p) => p.status !== "COMPLETED").map((p) => ({ id: p.id, name: p.name }));
  const byCat = INV_CATEGORIES.map((c) => ({ c, rows: items.filter((i) => i.category === c) })).filter((g) => g.rows.length);
  const nm = (t: (typeof recent)[number], side: "from" | "to") => (side === "from" ? t.fromWarehouse?.name ?? t.fromProject?.name : t.toWarehouse?.name ?? t.toProject?.name);
  return (
    <>
      <PageHeader title="Inventory" sub="Tools, scaffolding and equipment across your warehouses and sites." actions={<><LinkButton href="/inventory/transfers" variant="secondary">Transfer log</LinkButton>{canEdit && <LinkButton href="/inventory/manage" variant="secondary">Items & warehouses</LinkButton>}</>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5"><Stat label="Item types" value={types} sub={`${all.length} in catalogue`} /><Stat label="Units in stock" value={num(units)} /><Stat label="Warehouses" value={warehouses.filter((w) => w.active).length} /><Stat label="Sites holding equipment" value={sitesHolding} />{fin ? <Stat label="Est. value" value={value ? formatINR(value) : "—"} sub="where unit cost is set" /> : <span />}</div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card>
            <CardHead title="Where everything is" sub="Units at each warehouse and site" />
            <form className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-3"><input name="q" defaultValue={sp.q} placeholder="Search items…" className={`${inputCls} h-9 w-56`} /><select name="category" defaultValue={sp.category ?? ""} className={`${inputCls} h-9 w-48`}><option value="">All categories</option>{INV_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select><button className="h-9 rounded-lg bg-river px-4 text-sm font-medium text-ivory">Filter</button></form>
            {!items.length ? <EmptyState icon={<Boxes className="size-5" />} title="No items yet" body={canEdit ? "Add your tools and equipment under Items & warehouses, then record stock arriving at a warehouse." : undefined} action={canEdit ? <LinkButton href="/inventory/manage">Add items</LinkButton> : undefined} /> : (
              <div className="overflow-x-auto"><table className="w-full text-sm" style={{ minWidth: 320 + cols.length * 96 }}>
                <thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Item</th>{cols.map((c) => <th key={c.key} className="px-2 text-right font-medium"><Link href={c.href} className={cn("block max-w-[110px] truncate hover:underline", c.site ? "text-teal" : "text-river")} title={c.name}>{c.name}</Link></th>)}<th className="px-5 text-right font-medium">Total</th></tr></thead>
                <tbody>{byCat.map((g) => (<Fragment key={g.c}>
                  <tr className="bg-stone-50/40"><td colSpan={cols.length + 2} className="px-5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{g.c}</td></tr>
                  {g.rows.map((i) => <tr key={i.id} className="border-b border-line/70 hover:bg-stone-50/60"><td className="px-5 py-2.5"><Link href={`/inventory/items/${i.id}`} className="font-medium hover:underline">{i.name}</Link><span className="ml-1.5 text-xs text-muted">{i.unit}</span></td>{cols.map((c) => { const q = stock.get(`${i.id}|${c.key}`) ?? 0; return <td key={c.key} className={cn("px-2 text-right tabular-nums", q ? "font-medium" : "text-muted/40")}>{q ? num(q) : "·"}</td>; })}<td className="px-5 text-right font-semibold tabular-nums">{num(totalOf(i.id))}</td></tr>)}
                </Fragment>))}</tbody></table></div>
            )}
          </Card>
          <Card>
            <CardHead title="Recent transfers" action={<Link href="/inventory/transfers" className="text-xs font-medium text-river hover:underline">Full log →</Link>} />
            {!recent.length ? <p className="px-5 pb-6 text-sm text-muted">No transfers recorded yet.</p> : (
              <ul className="divide-y divide-line/70 border-t border-line/70">{recent.map((t) => <li key={t.id}><Link href={`/inventory/transfers/${t.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-stone-50"><span className="w-20 text-xs tabular-nums text-muted">{fmtShort(t.date)}</span><span className="min-w-0 flex-1 basis-56"><span className="block text-sm font-medium">{t.txns.slice(0, 3).map((x) => `${num(x.quantity)} × ${x.item.name}`).join(", ")}{t.txns.length > 3 ? ` +${t.txns.length - 3} more` : ""}</span><span className="text-xs text-muted">{nm(t, "from")} → {nm(t, "to")}</span></span><span className="font-mono text-[11px] text-muted">{t.number}</span></Link></li>)}</ul>
            )}
          </Card>
        </div>
        {canEdit && (
          <div className="space-y-4">
            <Card><details open><summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-semibold">Transfer equipment</summary><div className="border-t border-line p-5"><TransferForm warehouses={wOpts} projects={pOpts} items={all} /></div></details></Card>
            <Card><details><summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-semibold">Receive new stock</summary><div className="border-t border-line p-5"><ReceiveForm warehouses={wOpts} projects={pOpts} items={all} /></div></details></Card>
            <Card><details><summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-semibold">Write off lost or damaged</summary><div className="border-t border-line p-5"><WriteOffForm warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} projects={projects} items={all} /></div></details></Card>
            <Card><details><summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-semibold">Stock count correction</summary><div className="border-t border-line p-5"><CountForm warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} projects={projects} items={all} /></div></details></Card>
          </div>
        )}
      </div>
    </>
  );
}

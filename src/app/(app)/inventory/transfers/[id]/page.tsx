import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager } from "@/lib/access";
import { PrintButton } from "@/components/print-button";
import { fmtDate, fmtTime, num } from "@/lib/utils";

export const metadata = { title: "Transfer challan" };

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (!isManager(u) && u.role !== "ACCOUNTANT") notFound();
  const t = await prisma.inventoryTransfer.findFirst({ where: { id: (await params).id, companyId: u.companyId }, include: { company: { select: { name: true, address: true } }, fromWarehouse: true, toWarehouse: true, fromProject: { select: { name: true, location: true } }, toProject: { select: { name: true, location: true } }, createdBy: { select: { name: true } }, txns: { where: { quantity: { gt: 0 } }, include: { item: true } } } });
  if (!t) notFound();
  const end = (w: { name: string; address: string | null } | null, p: { name: string; location: string } | null) => ({ name: w?.name ?? p?.name ?? "", sub: w?.address ?? p?.location ?? "" });
  const from = end(t.fromWarehouse, t.fromProject), to = end(t.toWarehouse, t.toProject);
  return (
    <article className="mx-auto max-w-3xl space-y-5 rounded-xl border border-line bg-white p-8 shadow-card print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.3em] text-muted">{t.company.name} · equipment transfer</p><h1 className="font-serif text-4xl font-semibold text-river-deep">{t.number}</h1></div><div className="flex items-center gap-3 print:hidden"><PrintButton /></div></div>
      <div className="grid gap-x-8 gap-y-3 border-y border-line py-4 text-sm sm:grid-cols-2"><div><p className="text-[11px] uppercase tracking-wider text-muted">From</p><p className="font-semibold">{from.name}</p><p className="text-muted">{from.sub}</p></div><div><p className="text-[11px] uppercase tracking-wider text-muted">To</p><p className="font-semibold">{to.name}</p><p className="text-muted">{to.sub}</p></div><p><span className="text-muted">Date of transport</span> <b>{fmtDate(t.date)}</b></p><p><span className="text-muted">Recorded</span> {fmtDate(t.createdAt)}, {fmtTime(t.createdAt)} by {t.createdBy.name}</p><p><span className="text-muted">Vehicle</span> {t.vehicle ?? "—"}</p><p><span className="text-muted">Driver</span> {t.driver ?? "—"}</p></div>
      <table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted"><th className="py-2 font-medium">#</th><th className="font-medium">Item</th><th className="font-medium">Category</th><th className="text-right font-medium">Quantity</th></tr></thead><tbody>{t.txns.map((l, i) => <tr key={l.id} className="border-b border-line/60"><td className="py-2 text-muted">{i + 1}</td><td className="font-medium">{l.item.name}</td><td className="text-muted">{l.item.category}</td><td className="text-right tabular-nums">{num(l.quantity)} {l.item.unit}</td></tr>)}</tbody></table>
      {t.note && <p className="text-sm text-muted">Note: {t.note}</p>}
      <div className="grid grid-cols-2 gap-10 pt-10 text-xs text-muted print:pt-16"><div className="border-t border-charcoal/40 pt-1.5">Dispatched by (signature)</div><div className="border-t border-charcoal/40 pt-1.5">Received by (signature)</div></div>
      <p className="print:hidden"><Link href="/inventory/transfers" className="text-sm text-river hover:underline">← Transfer log</Link></p>
    </article>
  );
}

import Link from "next/link";
import { Truck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, projectScope } from "@/lib/access";
import { createPO } from "@/actions/procurement";
import { ActionForm } from "@/components/forms";
import { Card, CardHead, Chip, EmptyState, Field, inputCls, PageHeader, Select } from "@/components/ui";
import { cn, fmtShort, inr, PO_STATUS, PO_TONE } from "@/lib/utils";

export const metadata = { title: "Procurement" };

export default async function Procurement({ searchParams }: { searchParams: Promise<{ status?: string; fromRequest?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const canEdit = isManager(u);
  const st = sp.status && sp.status in PO_STATUS ? (sp.status as keyof typeof PO_STATUS) : undefined;
  const [orders, projects, suppliers, materials, req] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { companyId: u.companyId, project: projectScope(u), ...(st ? { status: st } : {}) }, include: { project: { select: { name: true } }, supplier: { select: { name: true } }, lines: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.material.findMany({ where: { companyId: u.companyId, active: true }, orderBy: { name: "asc" } }),
    sp.fromRequest ? prisma.materialRequest.findFirst({ where: { id: sp.fromRequest, companyId: u.companyId, project: projectScope(u), status: "APPROVED", poId: null } }) : null,
  ]);
  const tabs = [["", "All"], ...Object.entries(PO_STATUS)];
  return (
    <>
      <PageHeader title="Procurement" sub="Purchase orders from request to delivery." />
      {canEdit && (
        <Card className="mb-6">
          <details open={!!req}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4"><span className="text-[15px] font-semibold">New purchase order</span><span className="text-xs text-river">+ Create</span></summary>
            <div className="border-t border-line p-5">
              {!suppliers.length ? <p className="text-sm text-muted">Add a supplier first on the <Link href="/suppliers" className="text-river underline">Suppliers</Link> page.</p> : (
                <ActionForm action={createPO} reset submit="Create draft PO" className="space-y-4">
                  {req && <input type="hidden" name="requestId" value={req.id} />}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="Project"><Select name="projectId" required defaultValue={req?.projectId} options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
                    <Field label="Supplier"><Select name="supplierId" required placeholder="Choose…" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></Field>
                    <Field label="Expected delivery"><input type="date" name="expectedDate" className={inputCls} /></Field>
                    <Field label="Notes"><input name="notes" className={inputCls} /></Field>
                  </div>
                  <div className="overflow-x-auto"><div className="min-w-[720px] space-y-2">
                    <div className="grid grid-cols-[1.2fr_1.4fr_90px_80px_110px] gap-2 text-[11px] uppercase tracking-wider text-muted"><span>Material</span><span>Description</span><span>Qty</span><span>Unit</span><span>Rate (₹)</span></div>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="grid grid-cols-[1.2fr_1.4fr_90px_80px_110px] gap-2">
                        <Select name={`mat_${i}`} placeholder="— custom —" defaultValue={i === 0 ? req?.materialId : undefined} options={materials.map((m) => ({ value: m.id, label: m.name }))} />
                        <input name={`desc_${i}`} className={inputCls} placeholder="Defaults to material name" />
                        <input name={`qty_${i}`} type="number" step="any" min="0" defaultValue={i === 0 && req ? req.quantity : undefined} className={inputCls} />
                        <input name={`unit_${i}`} className={inputCls} placeholder="auto" />
                        <input name={`rate_${i}`} type="number" step="any" min="0" className={inputCls} />
                      </div>))}
                  </div></div>
                </ActionForm>
              )}
            </div>
          </details>
        </Card>
      )}
      <Card>
        <CardHead title={`${orders.length} order${orders.length === 1 ? "" : "s"}`} action={<div className="flex gap-1 text-xs">{tabs.map(([k, l]) => <Link key={k} href={k ? `?status=${k}` : "?"} className={cn("rounded-full px-3 py-1", (sp.status ?? "") === k ? "bg-river text-ivory" : "text-muted hover:bg-stone-100")}>{l}</Link>)}</div>} />
        {!orders.length ? <EmptyState icon={<Truck className="size-5" />} title="No purchase orders" body="Approve a material request or create an order above." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">PO</th><th className="px-3 font-medium">Supplier</th><th className="px-3 font-medium">Project</th><th className="px-3 font-medium">Expected</th><th className="px-3 text-right font-medium">Value</th><th className="px-3 font-medium">Status</th></tr></thead>
            <tbody>{orders.map((o) => <tr key={o.id} className="border-b border-line/70 last:border-0 hover:bg-stone-50/60"><td className="px-5 py-3"><Link href={`/procurement/${o.id}`} className="font-mono text-[13px] font-medium hover:underline">{o.number}</Link></td><td className="px-3">{o.supplier.name}</td><td className="px-3 text-muted">{o.project.name}</td><td className="px-3 text-[13px]">{fmtShort(o.expectedDate)}</td><td className="px-3 text-right tabular-nums">{inr(o.lines.reduce((s, l) => s + l.quantity * Number(l.rate), 0))}</td><td className="px-3"><Chip tone={PO_TONE[o.status]}>{PO_STATUS[o.status]}</Chip></td></tr>)}</tbody></table></div>
        )}
      </Card>
    </>
  );
}

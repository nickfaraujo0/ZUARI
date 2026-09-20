import Link from "next/link";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, projectScope, requireManagerPage } from "@/lib/access";
import { stockFor } from "@/lib/materials";
import { createMaterial, decideRequest, updateMaterial } from "@/actions/materials";
import { ActionForm } from "@/components/forms";
import { LogMaterialForm } from "@/components/material-forms";
import { Card, CardHead, Chip, EmptyState, Field, inputCls, PageHeader, Select, Stat } from "@/components/ui";
import { fmtDate, fmtShort, fmtTime, num, REQUEST_STATUS, REQUEST_TONE, TXN } from "@/lib/utils";

export const metadata = { title: "Materials" };

export default async function Materials({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await requireUser();
  requireManagerPage(u);
  const sp = await searchParams;
  const canEdit = isManager(u);
  const [projects, materials, suppliers] = await Promise.all([
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.material.findMany({ where: { companyId: u.companyId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.supplier.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pid = projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id;
  const [stock, txns, requests] = await Promise.all([
    pid ? stockFor(u.companyId, pid) : new Map(),
    pid ? prisma.materialTxn.findMany({ where: { companyId: u.companyId, projectId: pid }, include: { material: { select: { name: true, unit: true } }, user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 12 }) : [],
    prisma.materialRequest.findMany({ where: { companyId: u.companyId, project: projectScope(u) }, include: { material: true, project: { select: { name: true } }, requestedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const active = materials.filter((m) => m.active);
  const rows = active.map((m) => ({ m, s: stock.get(m.id) ?? { received: 0, consumed: 0, adjust: 0, stock: 0 } })).filter((r) => r.s.received || r.s.consumed || r.s.adjust || r.m.reorderLevel > 0);
  const low = rows.filter((r) => r.m.reorderLevel > 0 && r.s.stock <= r.m.reorderLevel).length;
  const pending = requests.filter((r) => r.status === "REQUESTED");
  return (
    <>
      <PageHeader title="Materials" sub="Stock, deliveries, consumption and site requests." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Catalogue" value={active.length} sub="materials" /><Stat label="Tracked here" value={rows.length} /><Stat label="Low stock" value={low} tone={low ? "amber" : undefined} /><Stat label="Awaiting approval" value={pending.length} tone={pending.length ? "amber" : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card>
            <CardHead title="Stock on site" action={<form className="flex gap-2"><Select name="project" defaultValue={pid} options={projects.map((p) => ({ value: p.id, label: p.name }))} className="h-9 w-52" /><button className="h-9 rounded-lg bg-river px-3 text-sm font-medium text-ivory">Show</button></form>} />
            {!rows.length ? <EmptyState icon={<Package className="size-5" />} title="No stock movements yet" body="Record a delivery or receive a purchase order to start the ledger." /> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Material</th><th className="px-3 text-right font-medium">Received</th><th className="px-3 text-right font-medium">Used</th><th className="px-3 text-right font-medium">In stock</th><th className="px-3 font-medium">Status</th></tr></thead>
                <tbody>{rows.map(({ m, s }) => { const isLow = m.reorderLevel > 0 && s.stock <= m.reorderLevel; return (
                  <tr key={m.id} className="border-b border-line/70 last:border-0"><td className="px-5 py-2.5 font-medium">{m.name}<span className="ml-1.5 text-xs font-normal text-muted">{m.unit}</span></td><td className="px-3 text-right tabular-nums">{num(s.received)}</td><td className="px-3 text-right tabular-nums">{num(s.consumed)}</td><td className="px-3 text-right font-semibold tabular-nums">{num(s.stock)}</td><td className="px-3">{isLow ? <Chip tone="amber" dot>Low · reorder at {num(m.reorderLevel)}</Chip> : <Chip tone="green" dot>OK</Chip>}</td></tr>); })}</tbody></table></div>
            )}
          </Card>
          <Card>
            <CardHead title="Material requests" sub="Raised from site" />
            {!requests.length ? <p className="px-5 pb-6 text-sm text-muted">No requests yet. Site staff can request materials from ZUARI Site.</p> : (
              <ul className="divide-y divide-line/70 border-t border-line/70">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1 basis-56"><p className="text-sm font-medium">{num(r.quantity)} {r.material.unit} {r.material.name}</p><p className="text-xs text-muted">{r.project.name} · {r.requestedBy.name} · {fmtShort(r.createdAt)}{r.neededBy ? ` · needed by ${fmtShort(r.neededBy)}` : ""}{r.note ? ` · ${r.note}` : ""}</p></div>
                    <Chip tone={REQUEST_TONE[r.status]}>{REQUEST_STATUS[r.status]}</Chip>
                    {canEdit && r.status === "REQUESTED" && <div className="flex gap-2">
                      <ActionForm action={decideRequest} hideSubmit><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="APPROVED" /><button className="rounded-lg bg-river px-3 py-1.5 text-xs font-medium text-ivory">Approve</button></ActionForm>
                      <ActionForm action={decideRequest} hideSubmit><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="REJECTED" /><button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium">Decline</button></ActionForm></div>}
                    {canEdit && r.status === "APPROVED" && !r.poId && <Link href={`/procurement?fromRequest=${r.id}`} className="text-xs font-medium text-river hover:underline">Create PO →</Link>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHead title="Recent movements" />
            <ul className="divide-y divide-line/70 border-t border-line/70">
              {txns.map((t) => <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm"><Chip tone={t.type === "RECEIVED" ? "green" : t.type === "CONSUMED" ? "sand" : "grey"}>{TXN[t.type]}</Chip><span className="flex-1"><span className="font-medium">{num(t.quantity)} {t.material.unit} {t.material.name}</span><span className="text-xs text-muted"> · {t.user.name}{t.note ? ` · ${t.note}` : ""}</span></span><span className="text-xs text-muted">{fmtDate(t.createdAt)}, {fmtTime(t.createdAt)}</span></li>)}
              {!txns.length && <li className="px-5 py-6 text-sm text-muted">Nothing recorded for this project yet.</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          {pid && active.length > 0 && <Card className="p-5"><h2 className="mb-4 text-[15px] font-semibold">Record stock movement</h2><LogMaterialForm projectId={pid} materials={active} suppliers={suppliers} types={canEdit ? ["RECEIVED", "CONSUMED", "ADJUSTMENT"] : ["RECEIVED", "CONSUMED"]} /></Card>}
          <Card>
            <CardHead title="Catalogue" sub={`${materials.length} materials`} />
            <ul className="max-h-[420px] divide-y divide-line/70 overflow-y-auto border-t border-line/70">
              {materials.map((m) => (
                <li key={m.id} className={`px-5 py-2.5 ${m.active ? "" : "opacity-60"}`}>
                  <div className="flex items-center gap-2 text-sm"><span className="flex-1 font-medium">{m.name} <span className="text-xs font-normal text-muted">· {m.unit}{m.category ? ` · ${m.category}` : ""}{m.reorderLevel ? ` · reorder ≤ ${num(m.reorderLevel)}` : ""}</span></span>{!m.active && <Chip>Inactive</Chip>}</div>
                  {canEdit && <details className="mt-1"><summary className="cursor-pointer text-xs font-medium text-river">Edit</summary>
                    <ActionForm action={updateMaterial} submit="Save" size="sm" variant="secondary" className="mt-2 grid gap-3 rounded-lg border border-line bg-stone-50 p-3"><input type="hidden" name="id" value={m.id} />
                      <Field label="Name"><input name="name" required defaultValue={m.name} className={inputCls} /></Field><Field label="Unit"><input name="unit" required defaultValue={m.unit} className={inputCls} /></Field><Field label="Category"><input name="category" defaultValue={m.category ?? ""} className={inputCls} /></Field>
                      <Field label="Reorder level"><input name="reorderLevel" type="number" min={0} step="any" defaultValue={m.reorderLevel} className={inputCls} /></Field><Field label="Status"><Select name="active" defaultValue={String(m.active)} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} /></Field></ActionForm></details>}
                </li>
              ))}
            </ul>
          </Card>
          {canEdit && <Card className="p-5"><h2 className="mb-4 text-[15px] font-semibold">Add a material</h2>
            <ActionForm action={createMaterial} reset submit="Add material" className="grid gap-3"><Field label="Name"><input name="name" required className={inputCls} placeholder="Cement OPC 53" /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Unit"><input name="unit" required className={inputCls} placeholder="bags, kg, m³…" /></Field><Field label="Reorder level"><input name="reorderLevel" type="number" min={0} step="any" defaultValue={0} className={inputCls} /></Field></div>
              <Field label="Category"><input name="category" className={inputCls} placeholder="Cement, Steel, Tiles…" /></Field></ActionForm></Card>}
        </div>
      </div>
    </>
  );
}

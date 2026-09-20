import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFinance, isManager, projectScope } from "@/lib/access";
import { billTotals } from "@/lib/bills";
import { createBill } from "@/actions/bills";
import { ActionForm } from "@/components/forms";
import { Card, CardHead, Chip, EmptyState, Field, inputCls, PageHeader, Select } from "@/components/ui";
import { addDays, BILL_STATUS, BILL_TONE, cn, fmtShort, inr, startOfToday, toInputDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export const metadata = { title: "Contractor bills" };

export default async function Bills({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const u = await requireUser();
  if (!isManager(u) && !isFinance(u)) notFound();
  const sp = await searchParams, st = sp.status && sp.status in BILL_STATUS ? (sp.status as keyof typeof BILL_STATUS) : undefined;
  const canCreate = isManager(u);
  const [bills, projects, contractors] = await Promise.all([
    prisma.rABill.findMany({ where: { companyId: u.companyId, project: projectScope(u), ...(st ? { status: st } : {}) }, include: { project: { select: { name: true } }, contractor: { select: { name: true } }, lines: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    canCreate ? prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    canCreate ? prisma.contractor.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const today = startOfToday();
  return (
    <>
      <PageHeader title="Contractor bills" sub="Measured running-account bills with retention, TDS and GST. Certified bills flow into Expenses." />
      {canCreate && (
        <Card className="mb-6"><details>
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4"><span className="text-[15px] font-semibold">New RA bill</span><span className="text-xs text-river">+ Create</span></summary>
          <div className="border-t border-line p-5">
            {!contractors.length ? <p className="text-sm text-muted">Add a contractor first on the <Link href="/contractors" className="text-river underline">Contractors</Link> page.</p> : (
              <ActionForm action={createBill} submit="Create draft bill" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4"><Field label="Project"><Select name="projectId" required placeholder="Choose…" options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field><Field label="Contractor"><Select name="contractorId" required placeholder="Choose…" options={contractors.map((c) => ({ value: c.id, label: c.name }))} /></Field><Field label="Period from"><input name="periodFrom" type="date" required defaultValue={toInputDate(addDays(today, -30))} className={inputCls} /></Field><Field label="Period to"><input name="periodTo" type="date" required defaultValue={toInputDate(today)} className={inputCls} /></Field></div>
                <div className="grid gap-3 sm:grid-cols-4"><Field label="Retention %"><input name="retentionPct" type="number" step="0.1" min={0} max={30} defaultValue={5} className={inputCls} /></Field><Field label="TDS %"><input name="tdsPct" type="number" step="0.1" min={0} max={30} defaultValue={1} className={inputCls} /></Field><Field label="GST %"><input name="gstPct" type="number" step="0.1" min={0} max={28} defaultValue={18} className={inputCls} /></Field><Field label="Notes"><input name="notes" className={inputCls} /></Field></div>
                <div className="overflow-x-auto"><div className="min-w-[640px] space-y-2"><div className="grid grid-cols-[2fr_80px_110px_120px] gap-2 text-[11px] uppercase tracking-wider text-muted"><span>Measured item (this bill)</span><span>Unit</span><span>Quantity</span><span>Rate (₹)</span></div>
                  {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="grid grid-cols-[2fr_80px_110px_120px] gap-2"><input name={`desc_${i}`} className={inputCls} placeholder={i === 0 ? "Brickwork in CM 1:6" : ""} /><input name={`unit_${i}`} className={inputCls} placeholder="m³" /><input name={`qty_${i}`} type="number" step="any" min="0" className={inputCls} /><input name={`rate_${i}`} type="number" step="any" min="0" className={inputCls} /></div>)}</div></div>
                <p className="text-xs text-muted">Quantities already certified on earlier bills for the same item are shown as &quot;previous&quot; automatically.</p>
              </ActionForm>)}
          </div>
        </details></Card>
      )}
      <Card>
        <CardHead title={`${bills.length} bill${bills.length === 1 ? "" : "s"}`} action={<div className="flex gap-1 text-xs">{[["", "All"], ...Object.entries(BILL_STATUS)].map(([k, l]) => <Link key={k} href={k ? `?status=${k}` : "?"} className={cn("rounded-full px-3 py-1", (sp.status ?? "") === k ? "bg-river text-ivory" : "text-muted hover:bg-stone-100")}>{l}</Link>)}</div>} />
        {!bills.length ? <EmptyState icon={<Receipt className="size-5" />} title="No contractor bills" body="Measure a contractor's work for a period and raise an RA bill." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Bill</th><th className="px-3 font-medium">Contractor</th><th className="px-3 font-medium">Project</th><th className="px-3 font-medium">Period</th><th className="px-3 text-right font-medium">Net payable</th><th className="px-3 font-medium">Status</th></tr></thead>
            <tbody>{bills.map((b) => <tr key={b.id} className="border-b border-line/70 last:border-0 hover:bg-stone-50/60"><td className="px-5 py-3"><Link href={`/bills/${b.id}`} className="font-mono text-[13px] font-medium hover:underline">{b.number}</Link></td><td className="px-3">{b.contractor.name}</td><td className="px-3 text-muted">{b.project.name}</td><td className="px-3 text-xs">{fmtShort(b.periodFrom)} – {fmtShort(b.periodTo)}</td><td className="px-3 text-right font-medium tabular-nums">{inr(billTotals(b.lines.map((l) => ({ quantity: l.quantity, rate: Number(l.rate) })), b.retentionPct, b.tdsPct, b.gstPct).net)}</td><td className="px-3"><Chip tone={BILL_TONE[b.status]}>{BILL_STATUS[b.status]}</Chip></td></tr>)}</tbody></table></div>
        )}
      </Card>
    </>
  );
}

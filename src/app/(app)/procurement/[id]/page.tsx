import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDirector, isFinance, isManager, projectScope } from "@/lib/access";
import { approvePO, cancelPO, markOrdered, receivePO } from "@/actions/procurement";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { Card, CardHead, Chip, PageHeader } from "@/components/ui";
import { EXPENSE_STATUS, EXPENSE_TONE, fmtDate, fmtShort, inr, num, PO_STATUS, PO_TONE } from "@/lib/utils";

export const metadata = { title: "Purchase order" };

const btn = "rounded-lg px-4 py-2 text-sm font-medium";
function Act({ poId, action, label, tone = "primary" }: { poId: string; action: typeof approvePO; label: string; tone?: "primary" | "danger" }) {
  return (
    <ActionForm action={action} hideSubmit><input type="hidden" name="poId" value={poId} />{tone === "danger" ? <ConfirmSubmit message="Cancel this purchase order?" className={`${btn} border border-red-200 text-red-700`}>{label}</ConfirmSubmit> : <button className={`${btn} bg-river text-ivory`}>{label}</button>}</ActionForm>
  );
}

export default async function PODetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const po = await prisma.purchaseOrder.findFirst({ where: { id: (await params).id, companyId: u.companyId, project: projectScope(u) }, include: { lines: { include: { material: { select: { name: true } } } }, project: { select: { id: true, name: true } }, supplier: true, createdBy: { select: { name: true } }, expenses: true } });
  if (!po) notFound();
  const total = po.lines.reduce((s, l) => s + l.quantity * Number(l.rate), 0);
  return (
    <>
      <PageHeader title={po.number} sub={`${po.supplier.name} · ${po.project.name}`} actions={<Link href="/procurement" className="text-sm text-river hover:underline">← All orders</Link>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHead title="Order lines" action={<Chip tone={PO_TONE[po.status]}>{PO_STATUS[po.status]}</Chip>} />
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Item</th><th className="px-3 text-right font-medium">Qty</th><th className="px-3 text-right font-medium">Rate</th><th className="px-5 text-right font-medium">Amount</th></tr></thead>
            <tbody>{po.lines.map((l) => <tr key={l.id} className="border-b border-line/70"><td className="px-5 py-2.5 font-medium">{l.description}{l.material && <span className="ml-1.5 text-xs font-normal text-muted">stocked</span>}</td><td className="px-3 text-right tabular-nums">{num(l.quantity)} {l.unit}</td><td className="px-3 text-right tabular-nums">{inr(Number(l.rate))}</td><td className="px-5 text-right tabular-nums">{inr(l.quantity * Number(l.rate))}</td></tr>)}
              <tr><td colSpan={3} className="px-5 py-3 text-right text-xs uppercase tracking-wider text-muted">Total</td><td className="px-5 text-right text-base font-semibold tabular-nums">{inr(total)}</td></tr></tbody></table></div>
        </Card>
        <div className="space-y-6">
          <Card className="space-y-3 p-5 text-sm">
            <div className="flex justify-between"><span className="text-muted">Raised by</span><span>{po.createdBy.name}</span></div>
            <div className="flex justify-between"><span className="text-muted">Order date</span><span>{fmtDate(po.orderDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Expected</span><span>{fmtShort(po.expectedDate)}</span></div>
            {po.deliveredAt && <div className="flex justify-between"><span className="text-muted">Delivered</span><span>{fmtDate(po.deliveredAt)}</span></div>}
            {po.notes && <p className="border-t border-line pt-3 text-muted">{po.notes}</p>}
          </Card>
          {isManager(u) && po.status !== "DELIVERED" && po.status !== "CANCELLED" && (
            <Card className="space-y-3 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Actions</p>
              <div className="flex flex-wrap gap-2">
                {po.status === "DRAFT" && isDirector(u) && <Act poId={po.id} action={approvePO} label="Approve order" />}
                {po.status === "DRAFT" && !isDirector(u) && <p className="text-sm text-muted">Waiting for a Director to approve.</p>}
                {po.status === "APPROVED" && <Act poId={po.id} action={markOrdered} label="Mark as ordered" />}
                {(po.status === "APPROVED" || po.status === "ORDERED") && <Act poId={po.id} action={receivePO} label="Receive delivery" />}
                <Act poId={po.id} action={cancelPO} label="Cancel" tone="danger" />
              </div>
              {(po.status === "APPROVED" || po.status === "ORDERED") && <p className="text-xs text-muted">Receiving adds every stocked line to the project&apos;s inventory.</p>}
            </Card>
          )}
          <Card>
            <CardHead title="Invoices" action={isFinance(u) && po.status !== "CANCELLED" ? <Link href={`/expenses?po=${po.id}`} className="text-xs font-medium text-river hover:underline">Record invoice →</Link> : undefined} />
            {po.expenses.length ? <ul className="divide-y divide-line/70 border-t border-line/70">{po.expenses.map((e) => <li key={e.id} className="flex items-center gap-2 px-5 py-2.5 text-sm"><span className="flex-1">{e.invoiceNo ?? "Invoice"} · {inr(Number(e.amount))}</span><Chip tone={EXPENSE_TONE[e.status]}>{EXPENSE_STATUS[e.status]}</Chip></li>)}</ul> : <p className="px-5 pb-5 text-sm text-muted">No invoices recorded yet.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

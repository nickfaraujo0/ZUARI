import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFinance, projectScope } from "@/lib/access";
import { financeFor } from "@/lib/finance";
import { addBudgetLine, deleteBudgetLine } from "@/actions/finance";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { CHART, Donut, Legend } from "@/components/charts";
import { Card, CardHead, Field, inputCls, PageHeader, Progress, Select, Stat } from "@/components/ui";
import { cn, EXPENSE_CATEGORY, formatINR, inr, opts } from "@/lib/utils";

export const metadata = { title: "Budget" };

export default async function Budget({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await requireUser();
  if (!isFinance(u)) notFound();
  const projects = await prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true, budget: true, code: true }, orderBy: { name: "asc" } });
  const fin = await financeFor(u.companyId, projects);
  const sp = await searchParams;
  const pid = projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id;
  const sel = pid ? fin.get(pid) : undefined;
  const lines = pid ? await prisma.budgetLine.findMany({ where: { companyId: u.companyId, projectId: pid }, orderBy: { createdAt: "asc" } }) : [];
  const all = [...fin.values()];
  const sum = (k: "budget" | "spent" | "committed" | "remaining" | "pending") => all.reduce((s, f) => s + f[k], 0);
  return (
    <>
      <PageHeader title="Budget" sub="Budget, committed purchase orders and approved spend, per project." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Total budget" value={formatINR(sum("budget"))} /><Stat label="Spent" value={formatINR(sum("spent"))} sub="approved + paid" /><Stat label="Committed" value={formatINR(sum("committed"))} sub="open purchase orders" />
        <Stat label="Remaining" value={formatINR(sum("remaining"))} tone={sum("remaining") < 0 ? "red" : undefined} /><Stat label="Awaiting approval" value={formatINR(sum("pending"))} sub="pending expenses" tone={sum("pending") ? "amber" : undefined} />
      </div>
      <Card className="mb-6">
        <CardHead title="Projects" />
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Project</th><th className="px-3 text-right font-medium">Budget</th><th className="px-3 text-right font-medium">Spent</th><th className="px-3 text-right font-medium">Committed</th><th className="px-3 text-right font-medium">Remaining</th><th className="px-3 font-medium">Used</th></tr></thead>
          <tbody>{projects.map((p) => { const f = fin.get(p.id)!, used = f.budget ? ((f.spent + f.committed) / f.budget) * 100 : 0; return (
            <tr key={p.id} className={cn("border-b border-line/70 last:border-0 hover:bg-stone-50/60", p.id === pid && "bg-river/[.03]")}><td className="px-5 py-3"><Link href={`?project=${p.id}`} className="font-medium hover:underline">{p.name}</Link></td><td className="px-3 text-right tabular-nums">{formatINR(f.budget)}</td><td className="px-3 text-right tabular-nums">{formatINR(f.spent)}</td><td className="px-3 text-right tabular-nums">{formatINR(f.committed)}</td><td className={cn("px-3 text-right tabular-nums", f.remaining < 0 && "font-medium text-red-700")}>{formatINR(f.remaining)}</td><td className="px-3"><div className="flex w-32 items-center gap-2"><Progress value={used} tone={used > 100 ? "amber" : "river"} thin /><span className="w-10 text-xs tabular-nums">{Math.round(used)}%</span></div></td></tr>); })}</tbody></table></div>
      </Card>
      {pid && sel && (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="p-5">
            <h2 className="mb-4 text-[15px] font-semibold">{projects.find((p) => p.id === pid)!.name} · cost overview</h2>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Donut parts={[{ label: "Spent", value: sel.spent, color: CHART.spent }, { label: "Committed", value: sel.committed, color: CHART.committed }, { label: "Remaining", value: Math.max(0, sel.remaining), color: CHART.remaining }]}><p className="text-lg font-semibold">{formatINR(sel.budget)}</p><p className="text-[11px] text-muted">Total budget</p></Donut>
              <Legend items={[{ label: "Spent", color: CHART.spent, value: formatINR(sel.spent) }, { label: "Committed", color: CHART.committed, value: formatINR(sel.committed) }, { label: "Remaining", color: CHART.remaining, value: formatINR(sel.remaining) }]} />
            </div>
            {sel.remaining < 0 && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Over budget by {inr(-sel.remaining)}.</p>}
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHead title="Budget by category" sub={sel.planned ? `${inr(sel.planned)} allocated of ${inr(sel.budget)}` : "Add lines to allocate the budget"} />
              <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2 font-medium">Category</th><th className="px-3 text-right font-medium">Allocated</th><th className="px-3 text-right font-medium">Spent</th><th className="px-5 text-right font-medium">Variance</th></tr></thead>
                <tbody>{Object.entries(EXPENSE_CATEGORY).map(([k, l]) => { const c = sel.byCategory[k] ?? { planned: 0, spent: 0 }; if (!c.planned && !c.spent) return null; const v = c.planned - c.spent; return <tr key={k} className="border-b border-line/70 last:border-0"><td className="px-5 py-2.5 font-medium">{l}</td><td className="px-3 text-right tabular-nums">{inr(c.planned)}</td><td className="px-3 text-right tabular-nums">{inr(c.spent)}</td><td className={cn("px-5 text-right tabular-nums", v < 0 && "font-medium text-red-700")}>{inr(v)}</td></tr>; })}</tbody></table></div>
            </Card>
            <Card>
              <CardHead title="Budget lines" />
              <ul className="divide-y divide-line/70 border-t border-line/70">
                {lines.map((l) => <li key={l.id} className="flex items-center gap-3 px-5 py-2.5 text-sm"><span className="flex-1"><span className="font-medium">{l.name}</span> <span className="text-xs text-muted">· {EXPENSE_CATEGORY[l.category]}</span></span><span className="tabular-nums">{inr(Number(l.amount))}</span><ActionForm action={deleteBudgetLine} hideSubmit><input type="hidden" name="id" value={l.id} /><ConfirmSubmit message="Remove this budget line?" className="text-xs text-red-700 hover:underline">Remove</ConfirmSubmit></ActionForm></li>)}
                {!lines.length && <li className="px-5 py-5 text-sm text-muted">No lines yet.</li>}
              </ul>
              <ActionForm action={addBudgetLine} reset submit="Add line" size="sm" className="grid gap-3 border-t border-line bg-stone-50/60 p-5 sm:grid-cols-4">
                <input type="hidden" name="projectId" value={pid} />
                <Field label="Category"><Select name="category" options={opts(EXPENSE_CATEGORY)} defaultValue="MATERIALS" /></Field>
                <Field label="Description" className="sm:col-span-2"><input name="name" required className={inputCls} placeholder="Structural steel" /></Field>
                <Field label="Amount (₹)"><input name="amount" type="number" min="1" step="any" required className={inputCls} /></Field>
              </ActionForm>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

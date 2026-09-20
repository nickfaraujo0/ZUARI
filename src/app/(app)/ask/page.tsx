import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/access";
import { emailWeeklySummary } from "@/actions/ask";
import { aiEnabled } from "@/lib/ask";
import { insightsFor } from "@/lib/insights";
import { weeklySummary } from "@/lib/summary";
import { ActionForm } from "@/components/forms";
import { AskBox } from "@/components/ask-box";
import { HealthChip } from "@/components/blocks";
import { Card, CardHead, PageHeader } from "@/components/ui";

export const metadata = { title: "Ask ZUARI" };

export default async function Ask() {
  const u = await requireUser();
  if (!isManager(u) && u.role !== "ACCOUNTANT") notFound();
  const [ins, summary] = await Promise.all([insightsFor(u), weeklySummary(u)]);
  const needs = ins.filter((i) => i.level === "AT_RISK" || i.level === "DELAYED" || i.factors.length);
  return (
    <>
      <PageHeader title="Ask ZUARI" sub={aiEnabled() ? "Ask questions in plain language. Answers use only data you can see, with links to the records." : "Project health explained from your data. Add an ANTHROPIC_API_KEY to enable free-form questions."} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <AskBox />
          <Card>
            <CardHead title="Project health" sub="What is contributing to each project's status" />
            <ul className="divide-y divide-line/70 border-t border-line/70">{ins.map((i) => (
              <li key={i.projectId} className="px-5 py-4"><div className="flex flex-wrap items-center gap-3"><Link href={`/projects/${i.projectId}`} className="font-semibold hover:underline">{i.name}</Link><HealthChip health={i.level} /><span className="text-xs text-muted">{i.progress}% done · {i.planned}% of schedule used</span></div>
                {i.factors.length ? <ul className="mt-2 space-y-1 text-sm">{i.factors.map((f, n) => <li key={n} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-laterite" /><Link href={f.href} className="hover:underline">{f.text}</Link></li>)}</ul> : <p className="mt-1 text-sm text-muted">No risk factors detected.</p>}</li>))}
              {!ins.length && <li className="px-5 py-6 text-sm text-muted">No projects yet.</li>}</ul>
          </Card>
        </div>
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold">This week</h2><ActionForm action={emailWeeklySummary} submit="Email me this" size="sm" variant="secondary" submitClass="!mt-0" className="text-right" ><span /></ActionForm></div>
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-charcoal/85">{summary}</pre>
          {needs.length === 0 && <p className="mt-3 text-xs text-muted">Nothing needs attention.</p>}
        </Card>
      </div>
    </>
  );
}

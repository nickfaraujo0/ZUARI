import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { portfolio } from "@/lib/queries";
import { Card, CardHead, EmptyState, PageHeader } from "@/components/ui";
import { fmtShort, startOfToday } from "@/lib/utils";

export const metadata = { title: "Timeline" };
const DAY = 864e5;

export default async function PortfolioTimeline() {
  const u = await requireUser();
  const projects = await portfolio(u);
  if (!projects.length) return <><PageHeader title="Timeline" /><Card><EmptyState title="No projects yet" /></Card></>;
  const min = Math.min(...projects.map((p) => p.startDate.getTime())), max = Math.max(...projects.map((p) => p.expectedEnd.getTime()));
  const span = Math.max(max - min, DAY), at = (t: number) => ((t - min) / span) * 100;
  const months: Date[] = [];
  for (let d = new Date(Date.UTC(new Date(min).getUTCFullYear(), new Date(min).getUTCMonth(), 1)); d.getTime() <= max; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) months.push(new Date(d));
  const today = startOfToday().getTime();
  const step = Math.ceil(months.length / 12);
  return (
    <>
      <PageHeader title="Timeline" sub="Every project and its construction phases on one calendar." />
      <Card>
        <CardHead title="Portfolio" sub={`${fmtShort(new Date(min))} → ${fmtShort(new Date(max))}`} />
        <div className="overflow-x-auto px-5 pb-5"><div className="min-w-[860px]">
          <div className="relative ml-48 h-7 border-b border-line text-[11px] text-muted">{months.filter((_, i) => i % step === 0).map((m) => <span key={m.getTime()} className="absolute border-l border-line pl-1.5" style={{ left: `${Math.max(0, at(m.getTime()))}%` }}>{m.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" })}</span>)}</div>
          <div className="relative">
            {today >= min && today <= max && <div className="absolute bottom-0 top-0 z-10 w-px bg-laterite" style={{ left: `calc(12rem + (100% - 12rem) * ${(today - min) / span})` }}><span className="absolute -top-0.5 -translate-x-1/2 rounded bg-laterite px-1 text-[9px] text-white">Today</span></div>}
            {projects.map((p) => (
              <div key={p.id} className="flex items-center border-b border-line/60 py-3 last:border-0">
                <Link href={`/projects/${p.id}/timeline`} className="w-48 shrink-0 pr-3 hover:underline"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-[11px] text-muted">{p.progress}% · {p.location}</p></Link>
                <div className="relative h-11 flex-1">
                  <div className="absolute top-0 h-5 overflow-hidden rounded-md bg-teal/20 ring-1 ring-inset ring-teal/30" style={{ left: `${at(p.startDate.getTime())}%`, width: `${at(p.expectedEnd.getTime()) - at(p.startDate.getTime())}%` }} title={`${fmtShort(p.startDate)} – ${fmtShort(p.expectedEnd)}`}><div className="h-full bg-river" style={{ width: `${p.progress}%` }} /></div>
                  {p.phases.map((ph) => <div key={ph.id} title={`${ph.name} · ${ph.progress}%`} className="absolute top-6 h-3 overflow-hidden rounded-sm bg-stone-200" style={{ left: `${at(ph.startDate.getTime())}%`, width: `${Math.max(0.4, at(ph.endDate.getTime()) - at(ph.startDate.getTime()))}%` }}><div className="h-full bg-teal" style={{ width: `${ph.progress}%` }} /></div>)}
                </div>
              </div>))}
          </div>
        </div></div>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">Top bar: whole project. Thin bars below: its phases. Filled portion is completed work.</p>
      </Card>
    </>
  );
}

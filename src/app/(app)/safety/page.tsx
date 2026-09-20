import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope, requireManagerPage } from "@/lib/access";
import { closeSafety } from "@/actions/safety";
import { ActionForm } from "@/components/forms";
import { ReportSafetyForm, ToolboxForm } from "@/components/safety-forms";
import { Card, CardHead, Chip, EmptyState, PageHeader, Stat } from "@/components/ui";
import { fmtDate, SEVERITY, SEVERITY_TONE, startOfToday } from "@/lib/utils";

export const metadata = { title: "Safety" };
const KIND = { INCIDENT: "Incident", NEAR_MISS: "Near miss", HAZARD: "Hazard" } as const;

export default async function Safety() {
  const u = await requireUser();
  requireManagerPage(u);
  const base = { companyId: u.companyId, project: projectScope(u) };
  const month = new Date(startOfToday().getTime() - 30 * 864e5);
  const [projects, workers, incidents, talks, lastInc, ppe] = await Promise.all([
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.worker.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true, trade: true }, orderBy: { name: "asc" } }),
    prisma.safetyIncident.findMany({ where: base, include: { project: { select: { name: true } }, reportedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.toolboxTalk.findMany({ where: base, include: { project: { select: { name: true } }, conductedBy: { select: { name: true } }, _count: { select: { attendees: true } } }, orderBy: { date: "desc" }, take: 15 }),
    prisma.safetyIncident.findFirst({ where: { ...base, kind: "INCIDENT" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.inspection.groupBy({ by: ["status"], where: { ...base, template: { name: "PPE & site safety" }, completedAt: { not: null } }, _count: true }),
  ]);
  const days = lastInc ? Math.max(0, Math.floor((startOfToday().getTime() + 864e5 - lastInc.createdAt.getTime()) / 864e5)) : null;
  const recent = incidents.filter((i) => i.createdAt >= month), open = incidents.filter((i) => !i.closed);
  const ppeDone = ppe.reduce((s, x) => s + x._count, 0), ppePass = ppe.find((x) => x.status === "PASSED")?._count ?? 0;
  return (
    <>
      <PageHeader title="Safety" sub="Incidents, near misses, hazards and toolbox talks." actions={<Link href="/inspections" className="rounded-lg border border-line bg-white px-3 py-2 text-sm">Run a PPE check →</Link>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5"><Stat label="Days without incident" value={days ?? "—"} sub={days == null ? "none recorded" : `since ${fmtDate(lastInc!.createdAt)}`} /><Stat label="Open reports" value={open.length} tone={open.length ? "amber" : undefined} /><Stat label="Near misses, 30 d" value={recent.filter((i) => i.kind === "NEAR_MISS").length} /><Stat label="Toolbox talks, 30 d" value={talks.filter((t) => t.date >= month).length} /><Stat label="PPE checks passed" value={ppeDone ? `${Math.round((ppePass / ppeDone) * 100)}%` : "—"} sub={`${ppeDone} completed`} /></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHead title="Reports" />
            {!incidents.length ? <EmptyState icon={<ShieldCheck className="size-5" />} title="No safety reports" body="Supervisors report events from ZUARI Site; you can also log one here." /> : (
              <ul className="divide-y divide-line/70 border-t border-line/70">{incidents.map((i) => (
                <li key={i.id} className={`px-5 py-3.5 ${i.closed ? "opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2"><Chip tone={i.kind === "INCIDENT" ? "red" : i.kind === "HAZARD" ? "amber" : "sand"} dot>{KIND[i.kind]}</Chip><Chip tone={SEVERITY_TONE[i.severity]}>{SEVERITY[i.severity]}</Chip>{i.injuredCount > 0 && <Chip tone="red">{i.injuredCount} injured</Chip>}{i.closed && <Chip tone="green">Closed</Chip>}</div>
                  <p className="mt-1.5 text-sm font-medium">{i.description}</p><p className="text-xs text-muted">{i.project.name} · {[i.block, i.floor, i.area].filter(Boolean).join(" · ") || "—"} · {i.reportedBy.name} · {fmtDate(i.createdAt)}</p>
                  {i.actionsTaken && <p className="mt-1 text-xs text-muted">Action: {i.actionsTaken}</p>}
                  {!i.closed && <ActionForm action={closeSafety} submit="Close with action taken" size="sm" variant="secondary" className="mt-2 flex flex-wrap items-end gap-2" submitClass="!mt-0"><input type="hidden" name="id" value={i.id} /><input name="actionsTaken" placeholder="Corrective action taken" defaultValue={i.actionsTaken ?? ""} className="h-9 min-w-56 flex-1 rounded-lg border border-line bg-white px-3 text-sm" /></ActionForm>}
                </li>))}</ul>
            )}
          </Card>
          <Card><CardHead title="Toolbox talks" /><ul className="divide-y divide-line/70 border-t border-line/70">{talks.map((t) => <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm"><span className="min-w-0 flex-1"><span className="font-medium">{t.topic}</span><span className="block text-xs text-muted">{t.project.name} · {t.conductedBy.name} · {fmtDate(t.date)}</span></span><Chip tone="teal">{t._count.attendees} attended</Chip></li>)}{!talks.length && <li className="px-5 py-6 text-sm text-muted">No toolbox talks recorded.</li>}</ul></Card>
        </div>
        <div className="space-y-6"><Card className="p-5"><h2 className="mb-4 text-[15px] font-semibold">Report an event</h2><ReportSafetyForm projects={projects} /></Card><Card className="p-5"><h2 className="mb-4 text-[15px] font-semibold">Record a toolbox talk</h2><ToolboxForm projects={projects} workers={workers} /></Card></div>
      </div>
    </>
  );
}

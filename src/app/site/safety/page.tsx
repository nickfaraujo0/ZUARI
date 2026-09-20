import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { ReportSafetyForm, ToolboxForm } from "@/components/safety-forms";
import { SiteHeader } from "@/components/site-ui";
import { Chip } from "@/components/ui";
import { fmtShort } from "@/lib/utils";

export const metadata = { title: "Safety" };

export default async function SiteSafety() {
  const u = await requireUser();
  const [projects, workers, mine] = await Promise.all([
    prisma.project.findMany({ where: { ...projectScope(u), status: { not: "COMPLETED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    u.role === "CONTRACTOR" ? [] : prisma.worker.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true, trade: true }, orderBy: { name: "asc" } }),
    prisma.safetyIncident.findMany({ where: { companyId: u.companyId, reportedById: u.id }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const sec = "rounded-2xl border border-line bg-white shadow-card", sum = "flex h-14 cursor-pointer list-none items-center px-4 text-base font-semibold";
  return (
    <>
      <SiteHeader title="Safety" back="/site/more" />
      <div className="space-y-4 p-5">
        <details className={sec} open><summary className={sum}>Report an incident, near miss or hazard</summary><div className="border-t border-line p-4"><ReportSafetyForm mobile projects={projects} defaultProject={projects.length === 1 ? projects[0].id : undefined} /></div></details>
        {u.role !== "CONTRACTOR" && <details className={sec}><summary className={sum}>Record a toolbox talk</summary><div className="border-t border-line p-4"><ToolboxForm mobile projects={projects} workers={workers} defaultProject={projects.length === 1 ? projects[0].id : undefined} /></div></details>}
        {u.role !== "CONTRACTOR" && <Link href="/site/inspections" className={`${sec} flex h-14 items-center px-4 text-base font-semibold`}>Run a PPE check →</Link>}
        {mine.length > 0 && <div className={`${sec} p-4`}><p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">My reports</p><ul className="divide-y divide-line/70">{mine.map((m) => <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="truncate">{m.description}</span><span className="flex shrink-0 items-center gap-2"><Chip tone={m.closed ? "green" : "amber"}>{m.closed ? "Closed" : "Open"}</Chip><span className="text-xs text-muted">{fmtShort(m.createdAt)}</span></span></li>)}</ul></div>}
      </div>
    </>
  );
}

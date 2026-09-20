import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { docScope, isManager, requireProject } from "@/lib/access";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Photo } from "@/components/ui";
import { DOC_CATEGORY, fmtDate, fmtShort, TYPE_LABEL } from "@/lib/utils";

export const metadata = { title: "Project Passport" };
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-2 mt-8 border-b border-charcoal/20 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-river">{children}</h2>;

export default async function Passport({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (!isManager(u)) notFound();
  const p = await requireProject(u, (await params).id);
  const [phases, docs, insp, snags, warranties, safety, lastInc, photoCount, attendance] = await Promise.all([
    prisma.projectPhase.findMany({ where: { projectId: p.id }, orderBy: { position: "asc" } }),
    prisma.document.findMany({ where: { ...docScope(u), projectId: p.id, category: { in: ["DRAWING", "CONTRACT", "CERTIFICATE"] } }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { category: "asc" } }),
    prisma.inspection.findMany({ where: { projectId: p.id, companyId: u.companyId, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 15 }),
    prisma.issue.count({ where: { projectId: p.id, companyId: u.companyId, inspectionItemId: { not: null }, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
    prisma.warranty.findMany({ where: { projectId: p.id, companyId: u.companyId }, orderBy: { endDate: "asc" } }),
    prisma.safetyIncident.groupBy({ by: ["kind"], where: { projectId: p.id, companyId: u.companyId }, _count: true }),
    prisma.safetyIncident.findFirst({ where: { projectId: p.id, kind: "INCIDENT" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.progressPhoto.count({ where: { projectId: p.id } }),
    prisma.attendance.findMany({ where: { projectId: p.id, status: { not: "ABSENT" } }, select: { status: true } }),
  ]);
  const key = await Promise.all(phases.map((ph) => prisma.progressPhoto.findMany({ where: { projectId: p.id, task: { phaseId: ph.id } }, orderBy: { takenAt: "desc" }, take: 2, select: { id: true } })));
  const workerDays = attendance.reduce((s, a) => s + (a.status === "HALF" ? 0.5 : 1), 0);
  const s = (k: string) => safety.find((x) => x.kind === k)?._count ?? 0;
  return (
    <article className="mx-auto max-w-3xl rounded-xl border border-line bg-white p-8 shadow-card print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.3em] text-muted">Project Passport</p><h1 className="font-serif text-5xl font-semibold text-river-deep">{p.name}</h1><p className="mt-1 text-muted">{p.location} · <span className="font-mono text-xs">{p.code}</span></p></div><PrintButton /></div>
      <div className="mt-5 grid gap-x-8 gap-y-1 border-y border-line py-3 text-sm sm:grid-cols-2"><p><span className="text-muted">Client</span> {p.client}</p><p><span className="text-muted">Type</span> {TYPE_LABEL[p.type]}</p><p><span className="text-muted">Start</span> {fmtDate(p.startDate)}</p><p><span className="text-muted">Expected completion</span> {fmtDate(p.expectedEnd)}</p><p><span className="text-muted">Project manager</span> {p.manager?.name ?? "—"}</p><p><span className="text-muted">Progress</span> <b>{p.progress}%</b></p></div>
      {p.description && <p className="mt-3 text-sm text-muted">{p.description}</p>}
      <H>Construction timeline</H>
      <table className="w-full text-sm"><tbody>{phases.map((ph, i) => <tr key={ph.id} className="border-b border-line/60"><td className="py-1.5 font-medium">{ph.name}</td><td className="text-muted">{fmtShort(ph.startDate)} – {fmtShort(ph.endDate)}</td><td className="text-right">{ph.progress >= 100 ? "Complete" : `${ph.progress}%`}</td><td className="w-40 pl-3">{key[i].length ? <div className="flex gap-1">{key[i].map((k) => <Photo key={k.id} id={k.id} className="h-10 w-16 rounded" />)}</div> : null}</td></tr>)}</tbody></table>
      <H>Drawings, contracts &amp; certificates</H>
      {docs.length ? <ul className="space-y-1 text-sm">{docs.map((d) => <li key={d.id} className="flex justify-between gap-3"><span>{d.title} <span className="text-muted">· {DOC_CATEGORY[d.category]}{d.discipline ? ` · ${d.discipline}` : ""}</span></span><span className="text-muted">v{d.currentVersion}{d.versions[0] ? ` · ${fmtShort(d.versions[0].createdAt)}` : ""}</span></li>)}</ul> : <p className="text-sm text-muted">None on file.</p>}
      <H>Quality inspections</H>
      {insp.length ? <ul className="space-y-1 text-sm">{insp.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.title}</span><span className={i.status === "PASSED" ? "text-emerald-700" : "text-red-700"}>{i.status === "PASSED" ? "Passed" : "Failed"} · {fmtShort(i.completedAt!)}</span></li>)}</ul> : <p className="text-sm text-muted">No completed inspections.</p>}
      <p className="mt-2 text-sm"><b>{snags}</b> open snag{snags === 1 ? "" : "s"} from inspections.</p>
      <H>Site &amp; safety record</H>
      <p className="text-sm">{photoCount} progress photos · {num(workerDays)} worker-days recorded · {s("INCIDENT")} incidents, {s("NEAR_MISS")} near misses, {s("HAZARD")} hazards reported{lastInc ? ` · last incident ${fmtDate(lastInc.createdAt)}` : " · no incidents recorded"}.</p>
      <H>Warranties &amp; defect liability</H>
      {warranties.length ? <ul className="space-y-1 text-sm">{warranties.map((w) => <li key={w.id} className="flex justify-between gap-3"><span>{w.item}{w.provider ? <span className="text-muted"> · {w.provider}</span> : null}</span><span className="text-muted">until {fmtDate(w.endDate)}</span></li>)}</ul> : <p className="text-sm text-muted">No warranties recorded.</p>}
      <p className="mt-10 border-t border-line pt-3 text-[11px] text-muted">Generated by ZUARI for {u.name} on {fmtDate(new Date())}. Financial data is intentionally excluded.</p>
    </article>
  );
}
function num(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

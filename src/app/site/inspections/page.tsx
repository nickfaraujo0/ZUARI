import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { ensureTemplates } from "@/lib/inspections";
import { INSPECTION_TONE } from "@/components/inspection";
import { StartInspectionForm } from "@/components/start-inspection";
import { SiteHeader } from "@/components/site-ui";
import { Chip } from "@/components/ui";
import { fmtShort } from "@/lib/utils";

export const metadata = { title: "Inspections" };

export default async function SiteInspections() {
  const u = await requireUser();
  if (u.role === "CONTRACTOR") redirect("/site/more");
  await ensureTemplates(u.companyId);
  const [projects, templates, list, tasks] = await Promise.all([
    prisma.project.findMany({ where: { ...projectScope(u), status: { not: "COMPLETED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.inspectionTemplate.findMany({ where: { companyId: u.companyId }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    prisma.inspection.findMany({ where: { companyId: u.companyId, project: projectScope(u) }, include: { project: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.task.findMany({ where: { companyId: u.companyId, project: projectScope(u), ...(["SITE_SUPERVISOR"].includes(u.role) ? { assigneeId: u.id } : {}), status: { in: ["IN_PROGRESS", "COMPLETED"] } }, select: { id: true, title: true, project: { select: { name: true } } }, take: 60 }),
  ]);
  return (
    <>
      <SiteHeader title="Inspections" back="/site/more" />
      <div className="space-y-5 p-5">
        <details className="rounded-2xl border border-line bg-white shadow-card"><summary className="flex h-14 cursor-pointer list-none items-center px-4 text-base font-semibold">Start an inspection</summary><div className="border-t border-line p-4"><StartInspectionForm mobile projects={projects} templates={templates} tasks={tasks} defaultProject={projects.length === 1 ? projects[0].id : undefined} /></div></details>
        <ul className="space-y-3">{list.map((i) => <li key={i.id}><Link href={`/site/inspections/${i.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card active:scale-[.99]"><span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{i.title}</span><span className="text-sm text-muted">{i.project.name} · {fmtShort(i.createdAt)}</span></span><Chip tone={INSPECTION_TONE[i.status]}>{i.status === "OPEN" ? "Open" : i.status === "PASSED" ? "Passed" : "Failed"}</Chip></Link></li>)}{!list.length && <li className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">No inspections yet.</li>}</ul>
      </div>
    </>
  );
}

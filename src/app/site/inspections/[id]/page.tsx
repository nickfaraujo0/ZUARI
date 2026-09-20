import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { InspectionDetail } from "@/components/inspection";
import { SiteHeader } from "@/components/site-ui";

export const metadata = { title: "Inspection" };

export default async function SiteInspection({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (u.role === "CONTRACTOR") redirect("/site/more");
  const ins = await prisma.inspection.findFirst({ where: { id: (await params).id, companyId: u.companyId, project: projectScope(u) }, include: { items: { orderBy: { position: "asc" }, include: { issues: { select: { id: true, status: true } } } }, project: { select: { name: true } }, inspector: { select: { name: true } }, task: { select: { title: true } }, photos: { select: { id: true } }, children: { select: { id: true, status: true } } } });
  if (!ins) notFound();
  return <><SiteHeader title="Inspection" back="/site/inspections" /><div className="p-5"><InspectionDetail mobile ins={ins} canAct base="/site/inspections" /></div></>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope, requireManagerPage } from "@/lib/access";
import { InspectionDetail } from "@/components/inspection";

export const metadata = { title: "Inspection" };

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  requireManagerPage(u);
  const ins = await prisma.inspection.findFirst({ where: { id: (await params).id, companyId: u.companyId, project: projectScope(u) }, include: { items: { orderBy: { position: "asc" }, include: { issues: { select: { id: true, status: true } } } }, project: { select: { name: true } }, inspector: { select: { name: true } }, task: { select: { title: true } }, photos: { select: { id: true } }, children: { select: { id: true, status: true } } } });
  if (!ins) notFound();
  return <div className="mx-auto max-w-3xl"><Link href="/inspections" className="mb-4 inline-block text-sm text-river hover:underline">← All inspections</Link><InspectionDetail ins={ins} canAct base="/inspections" /></div>;
}

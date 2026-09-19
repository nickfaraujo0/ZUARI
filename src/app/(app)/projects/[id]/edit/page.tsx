import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDirector, isManager, requireProject } from "@/lib/access";
import { ProjectForm } from "@/components/project-form";
import { Card, CardHead } from "@/components/ui";

export const metadata = { title: "Edit project" };

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (!isManager(u)) notFound();
  const p = await requireProject(u, (await params).id);
  const managers = await prisma.user.findMany({ where: { companyId: u.companyId, active: true, role: { not: "SITE_SUPERVISOR" } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
  return (
    <Card className="max-w-3xl">
      <CardHead title="Edit project" action={<Link href={`/projects/${p.id}`} className="text-xs text-river hover:underline">← Back</Link>} />
      <div className="border-t border-line p-6"><ProjectForm managers={managers} project={{ ...p, budget: Number(p.budget) }} canPickManager={isDirector(u)} defaults={{ start: "", end: "", managerId: p.managerId ?? u.id }} /></div>
    </Card>
  );
}

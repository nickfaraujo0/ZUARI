import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectForm } from "@/components/project-form";
import { Card, PageHeader } from "@/components/ui";
import { addDays, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "New project" };

export default async function NewProject() {
  const u = await requireUser();
  if (u.role !== "DIRECTOR") notFound();
  const managers = await prisma.user.findMany({ where: { companyId: u.companyId, active: true, role: { in: ["DIRECTOR", "PROJECT_MANAGER"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
  const today = startOfToday();
  return (
    <>
      <PageHeader title="New project" sub="Six standard construction phases are created for you — adjust them on the Timeline tab." />
      <Card className="max-w-3xl p-6"><ProjectForm managers={managers} canPickManager defaults={{ start: toInputDate(today), end: toInputDate(addDays(today, 365)), managerId: u.id }} /></Card>
    </>
  );
}

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager } from "@/lib/access";
import { PartyForm, PartyTable } from "@/components/parties";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Contractors" };

export default async function Contractors() {
  const u = await requireUser();
  const list = await prisma.contractor.findMany({ where: { companyId: u.companyId }, include: { _count: { select: { workers: true, users: true, expenses: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  const canEdit = isManager(u);
  return (
    <>
      <PageHeader title="Contractors" sub="Subcontractors and specialist trades you work with." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <PartyTable kind="contractor" canEdit={canEdit} items={list.map((c) => ({ ...c, counts: `${c._count.workers} workers · ${c._count.users} logins` }))} />
        {canEdit && <Card className="h-fit p-5"><h2 className="mb-4 text-[15px] font-semibold">Add a contractor</h2><PartyForm kind="contractor" /></Card>}
      </div>
    </>
  );
}

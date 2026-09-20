import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager } from "@/lib/access";
import { PartyForm, PartyTable } from "@/components/parties";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Suppliers" };

export default async function Suppliers() {
  const u = await requireUser();
  const list = await prisma.supplier.findMany({ where: { companyId: u.companyId }, include: { _count: { select: { orders: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  const canEdit = isManager(u);
  return (
    <>
      <PageHeader title="Suppliers" sub="Material and equipment vendors." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <PartyTable kind="supplier" canEdit={canEdit} items={list.map((s) => ({ ...s, counts: `${s._count.orders} orders` }))} />
        {canEdit && <Card className="h-fit p-5"><h2 className="mb-4 text-[15px] font-semibold">Add a supplier</h2><PartyForm kind="supplier" /></Card>}
      </div>
    </>
  );
}

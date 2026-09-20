import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDirector, requireManagerPage } from "@/lib/access";
import { NewUserForm } from "@/components/user-form";
import { UserAdmin } from "@/components/user-admin";
import { Avatar, Card, CardHead, Chip, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/utils";
import { isSiteRole } from "@/lib/roles";

export const metadata = { title: "Team" };

export default async function Team() {
  const u = await requireUser();
  requireManagerPage(u);
  const contractors = await prisma.contractor.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const all = await prisma.user.findMany({ where: { companyId: u.companyId }, include: { memberships: { include: { project: { select: { name: true } } } } }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  const people = all.filter((p) => p.active), inactive = all.filter((p) => !p.active);
  const director = isDirector(u);
  const Row = ({ p }: { p: (typeof all)[number] }) => (
    <li className="flex items-start gap-3 px-5 py-3">
      <Avatar name={p.name} size={38} />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{p.name}{p.id === u.id && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</p><p className="truncate text-xs text-muted">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p></div>
      <div className="hidden max-w-[200px] flex-wrap justify-end gap-1 md:flex">{p.memberships.slice(0, 2).map((m) => <Chip key={m.id}>{m.project.name}</Chip>)}{p.memberships.length > 2 && <Chip>+{p.memberships.length - 2}</Chip>}</div>
      <div className="flex flex-col items-end gap-2">
        <Chip tone={p.role === "DIRECTOR" ? "dark" : p.role === "PROJECT_MANAGER" ? "teal" : p.role === "ACCOUNTANT" ? "amber" : "sand"}>{ROLE_LABEL[p.role]}</Chip>
        {p.id !== u.id && (director || isSiteRole(p.role)) && <UserAdmin id={p.id} name={p.name} active={p.active} canDeactivate={director} canReset />}
      </div>
    </li>
  );
  return (
    <>
      <PageHeader title="Team" sub={`${people.length} people at ${u.company.name}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card><CardHead title="People" /><ul className="divide-y divide-line/70 border-t border-line/70">{people.map((p) => <Row key={p.id} p={p} />)}</ul></Card>
          {inactive.length > 0 && <Card><CardHead title="Deactivated" sub="Cannot sign in" /><ul className="divide-y divide-line/70 border-t border-line/70 opacity-75">{inactive.map((p) => <Row key={p.id} p={p} />)}</ul></Card>}
        </div>
        <Card className="h-fit p-5"><h2 className="mb-1 text-[15px] font-semibold">Add a team member</h2><p className="mb-4 text-xs text-muted">Add them to projects afterwards from a project&apos;s Team tab, or by assigning a task.</p><NewUserForm director={director} contractors={contractors} /></Card>
      </div>
    </>
  );
}

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDirector } from "@/lib/access";
import { NewUserForm } from "@/components/user-form";
import { Avatar, Card, CardHead, Chip, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/utils";

export const metadata = { title: "Team" };

export default async function Team() {
  const u = await requireUser();
  const people = await prisma.user.findMany({ where: { companyId: u.companyId, active: true }, include: { memberships: { include: { project: { select: { name: true } } } } }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Team" sub={`${people.length} people at ${u.company.name}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHead title="People" />
          <ul className="divide-y divide-line/70 border-t border-line/70">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={p.name} size={38} />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{p.name}</p><p className="truncate text-xs text-muted">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p></div>
                <div className="hidden max-w-[220px] flex-wrap justify-end gap-1 md:flex">{p.memberships.slice(0, 3).map((m) => <Chip key={m.id}>{m.project.name}</Chip>)}{p.memberships.length > 3 && <Chip>+{p.memberships.length - 3}</Chip>}</div>
                <Chip tone={p.role === "DIRECTOR" ? "dark" : p.role === "PROJECT_MANAGER" ? "teal" : "sand"}>{ROLE_LABEL[p.role]}</Chip>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="h-fit p-5"><h2 className="mb-1 text-[15px] font-semibold">Add a team member</h2><p className="mb-4 text-xs text-muted">Add them to projects afterwards from a project&apos;s Team tab, or by assigning a task.</p><NewUserForm director={isDirector(u)} /></Card>
      </div>
    </>
  );
}

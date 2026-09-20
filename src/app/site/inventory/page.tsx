import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { stockMap } from "@/lib/inventory";
import { SiteHeader } from "@/components/site-ui";
import { fmtShort, num } from "@/lib/utils";

export const metadata = { title: "Tools & equipment" };

/** Read-only: what equipment is at the sites I work on, and when it arrived or left. */
export default async function SiteInventory() {
  const u = await requireUser();
  if (u.role === "CONTRACTOR") redirect("/site/more");
  const projects = await prisma.project.findMany({ where: { ...projectScope(u), status: { not: "COMPLETED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const ids = projects.map((p) => p.id);
  const [stock, items, moves] = await Promise.all([stockMap(u.companyId, { projectIds: ids }), prisma.inventoryItem.findMany({ where: { companyId: u.companyId }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.inventoryTxn.findMany({ where: { companyId: u.companyId, projectId: { in: ids } }, include: { item: { select: { name: true } }, transfer: { include: { fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } }, fromProject: { select: { name: true } }, toProject: { select: { name: true } } } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 40 })]);
  // Other projects' names are not shown to people who aren't members of them.
  const nameOf = (w: { name: string } | null, p: { name: string } | null, pid: string | null) => w?.name ?? (pid && !ids.includes(pid) ? "another site" : p?.name);
  const sec = "rounded-2xl border border-line bg-white shadow-card";
  return (
    <>
      <SiteHeader title="Tools & equipment" back="/site/more" />
      <div className="space-y-5 p-5">
        {!projects.length && <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">You&apos;re not on an active project.</p>}
        {projects.map((p) => {
          const held = items.map((i) => ({ i, q: stock.get(`${i.id}|p:${p.id}`) ?? 0 })).filter((x) => x.q > 0), mine = moves.filter((m) => m.projectId === p.id).slice(0, 8);
          return (
            <section key={p.id} className={sec}>
              <h2 className="px-4 pt-4 font-serif text-2xl font-semibold text-river-deep">{p.name}</h2>
              <ul className="divide-y divide-line/70 px-4 pb-1">{held.map(({ i, q }) => <li key={i.id} className="flex items-center justify-between py-3"><span className="font-medium">{i.name}</span><span className="tabular-nums"><b className="text-lg">{num(q)}</b> <span className="text-sm text-muted">{i.unit}</span></span></li>)}{!held.length && <li className="py-4 text-sm text-muted">No equipment recorded at this site.</li>}</ul>
              {mine.length > 0 && <div className="border-t border-line px-4 py-3"><p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">Recent movements</p><ul className="space-y-2 text-sm">{mine.map((m) => { const t = m.transfer, side = t ? (m.quantity < 0 ? `to ${nameOf(t.toWarehouse, t.toProject, t.toProjectId)}` : `from ${nameOf(t.fromWarehouse, t.fromProject, t.fromProjectId)}`) : m.note ?? ""; return <li key={m.id} className="flex gap-3"><span className="w-14 shrink-0 text-xs text-muted">{fmtShort(m.date)}</span><span><b className={m.quantity < 0 ? "text-red-700" : "text-emerald-700"}>{m.quantity > 0 ? "+" : ""}{num(m.quantity)}</b> {m.item.name} <span className="text-muted">{side}</span></span></li>; })}</ul></div>}
            </section>
          );
        })}
      </div>
    </>
  );
}

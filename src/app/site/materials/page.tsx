import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { stockFor } from "@/lib/materials";
import { LogMaterialForm, RequestMaterialForm } from "@/components/material-forms";
import { SiteHeader } from "@/components/site-ui";
import { Chip } from "@/components/ui";
import { cn, fmtShort, num, REQUEST_STATUS, REQUEST_TONE } from "@/lib/utils";

export const metadata = { title: "Materials" };

export default async function SiteMaterials({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await requireUser();
  if (u.role === "CONTRACTOR") redirect("/site/more");
  const projects = await prisma.project.findMany({ where: { ...projectScope(u), status: { not: "COMPLETED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const sp = await searchParams;
  const pid = projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id;
  const [materials, stock, mine] = await Promise.all([
    prisma.material.findMany({ where: { companyId: u.companyId, active: true }, orderBy: { name: "asc" } }),
    pid ? stockFor(u.companyId, pid) : new Map(),
    prisma.materialRequest.findMany({ where: { companyId: u.companyId, requestedById: u.id }, include: { material: true }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const held = materials.filter((m) => stock.get(m.id)?.stock).map((m) => ({ m, s: stock.get(m.id)!.stock }));
  const sec = "rounded-2xl border border-line bg-white shadow-card";
  const sum = "flex h-14 cursor-pointer list-none items-center px-4 text-base font-semibold";
  return (
    <>
      <SiteHeader title="Materials" back="/site/more" />
      <div className="space-y-4 p-5">
        {projects.length > 1 && <div className="flex gap-2 overflow-x-auto">{projects.map((p) => <Link key={p.id} href={`?project=${p.id}`} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset", p.id === pid ? "bg-river text-ivory ring-river" : "bg-white ring-line")}>{p.name}</Link>)}</div>}
        {!pid ? <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">You&apos;re not on an active project.</p> : (<>
          <div className={sec}>
            <p className="px-4 pt-4 text-xs font-medium uppercase tracking-[0.16em] text-muted">In stock on site</p>
            <ul className="divide-y divide-line/70 px-4 pb-2">{held.map(({ m, s }) => <li key={m.id} className="flex items-center justify-between py-3"><span className="font-medium">{m.name}</span><span className="tabular-nums">{m.reorderLevel > 0 && s <= m.reorderLevel && <Chip tone="amber" className="mr-2">Low</Chip>}<b>{num(s)}</b> <span className="text-sm text-muted">{m.unit}</span></span></li>)}{!held.length && <li className="py-4 text-sm text-muted">Nothing recorded yet.</li>}</ul>
          </div>
          <details className={sec}><summary className={sum}>Record delivery received</summary><div className="border-t border-line p-4"><LogMaterialForm mobile projectId={pid} materials={materials} types={["RECEIVED"]} /></div></details>
          <details className={sec}><summary className={sum}>Record material used</summary><div className="border-t border-line p-4"><LogMaterialForm mobile projectId={pid} materials={materials} types={["CONSUMED"]} /></div></details>
          <details className={sec}><summary className={sum}>Request material</summary><div className="border-t border-line p-4"><RequestMaterialForm mobile projectId={pid} materials={materials} /></div></details>
          {mine.length > 0 && <div className={sec}><p className="px-4 pt-4 text-xs font-medium uppercase tracking-[0.16em] text-muted">My requests</p><ul className="divide-y divide-line/70 px-4 pb-2">{mine.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span><b>{num(r.quantity)} {r.material.unit}</b> {r.material.name}<span className="block text-xs text-muted">{fmtShort(r.createdAt)}</span></span><Chip tone={REQUEST_TONE[r.status]}>{REQUEST_STATUS[r.status]}</Chip></li>)}</ul></div>}
        </>)}
      </div>
    </>
  );
}

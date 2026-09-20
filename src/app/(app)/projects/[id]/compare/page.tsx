import Link from "next/link";
import { Images } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { photoScope, requireProject } from "@/lib/access";
import { PhotoCompare } from "@/components/photo-compare";
import { Card, EmptyState } from "@/components/ui";
import { cn, fmtShort } from "@/lib/utils";

export const metadata = { title: "Compare photos" };
const key = (b: string | null, f: string | null, a: string | null) => JSON.stringify([b, f, a]);

export default async function Compare({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ loc?: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const sp = await searchParams;
  const groups = await prisma.progressPhoto.groupBy({ by: ["block", "floor", "locationArea"], where: { ...photoScope(u), projectId: p.id, OR: [{ block: { not: null } }, { floor: { not: null } }, { locationArea: { not: null } }] }, _count: true, orderBy: { _count: { id: "desc" } } });
  const chosen = groups.find((g) => key(g.block, g.floor, g.locationArea) === sp.loc) ?? groups[0];
  const photos = chosen ? await prisma.progressPhoto.findMany({ where: { ...photoScope(u), projectId: p.id, block: chosen.block, floor: chosen.floor, locationArea: chosen.locationArea }, include: { task: { select: { title: true } } }, orderBy: { takenAt: "asc" }, take: 60 }) : [];
  const name = (g: { block: string | null; floor: string | null; locationArea: string | null }) => [g.block, g.floor, g.locationArea].filter(Boolean).join(" · ");
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">Watch a single spot change over time. Tag block / floor / area on photos to build these views.</p><Link href={`/projects/${p.id}/photos`} className="text-sm text-river hover:underline">← Gallery</Link></div>
      {!groups.length ? <Card><EmptyState icon={<Images className="size-5" />} title="No located photos yet" body="Photos taken with a block, floor or area appear here, grouped by location." /></Card> : (<>
        <div className="flex flex-wrap gap-2">{groups.map((g) => { const k = key(g.block, g.floor, g.locationArea); return <Link key={k} href={`?loc=${encodeURIComponent(k)}`} className={cn("rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset", chosen && k === key(chosen.block, chosen.floor, chosen.locationArea) ? "bg-river text-ivory ring-river" : "bg-white ring-line hover:bg-stone-50")}>{name(g)} <span className="text-xs opacity-70">· {g._count}</span></Link>; })}</div>
        {photos.length < 2 ? <Card className="p-6 text-sm text-muted">This location needs at least two photos to compare. Keep capturing progress with the same block / floor / area.</Card> : <PhotoCompare photos={photos.map((ph) => ({ id: ph.id, label: `${fmtShort(ph.takenAt)}${ph.task ? ` · ${ph.task.title.slice(0, 22)}` : ""}` }))} />}
      </>)}
    </div>
  );
}

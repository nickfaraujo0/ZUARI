import Link from "next/link";
import { Camera, Images } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { photoScope } from "@/lib/access";
import { SiteHeader } from "@/components/site-ui";
import { Photo } from "@/components/ui";
import { dayKey, fmtDay, fmtTime } from "@/lib/utils";

export const metadata = { title: "Progress" };

export default async function SiteProgress() {
  const u = await requireUser();
  const photos = await prisma.progressPhoto.findMany({ where: photoScope(u), include: { task: { select: { title: true } }, user: { select: { name: true } }, project: { select: { name: true } } }, orderBy: { takenAt: "desc" }, take: 60 });
  const days = new Map<string, typeof photos>();
  for (const p of photos) days.set(dayKey(p.takenAt), [...(days.get(dayKey(p.takenAt)) ?? []), p]);
  return (
    <>
      <SiteHeader title="Site photos" right={<Link href="/site/add-progress" className="flex h-10 items-center gap-1.5 rounded-full bg-river px-4 text-sm font-semibold text-ivory"><Camera className="size-4" />Add</Link>} />
      <div className="space-y-7 p-5">
        {!photos.length && <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center"><Images className="mx-auto mb-3 size-8 text-river/50" /><p className="font-medium">No photos yet</p><p className="mt-1 text-sm text-muted">Tap Add to capture the first progress photo.</p></div>}
        {[...days.entries()].map(([d, list]) => (
          <section key={d}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-river">{fmtDay(new Date(d + "T00:00:00+05:30"))}</h2>
            <div className="space-y-4">{list.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <Photo id={p.id} className="aspect-[4/3] w-full" alt={p.task?.title ?? "Progress photo"} />
                <figcaption className="p-3.5"><p className="font-semibold">{p.task?.title ?? p.project.name}</p><p className="text-sm text-muted">{p.user.name} · {fmtTime(p.takenAt)}</p>{[p.block, p.floor, p.locationArea].some(Boolean) && <p className="text-sm text-river">{[p.block, p.floor, p.locationArea].filter(Boolean).join(" · ")}</p>}</figcaption>
              </figure>
            ))}</div>
          </section>
        ))}
      </div>
    </>
  );
}

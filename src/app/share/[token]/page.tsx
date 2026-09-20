import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { shareHash } from "@/lib/share";
import { Logo } from "@/components/ui";
import { dayKey, fmtDate, fmtDay, fmtShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Project progress", robots: { index: false, follow: false } };

export default async function ClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await prisma.clientShare.findUnique({ where: { tokenHash: shareHash(token) }, include: { project: { include: { phases: { orderBy: { position: "asc" } }, company: { select: { name: true } } } } } });
  if (!share || share.revokedAt || (share.expiresAt && share.expiresAt < new Date())) notFound();
  const p = share.project;
  const photos = await prisma.progressPhoto.findMany({ where: { projectId: p.id, companyId: share.companyId, clientVisible: true }, include: { task: { select: { title: true } } }, orderBy: { takenAt: "desc" }, take: 90 });
  const days = new Map<string, typeof photos>();
  for (const ph of photos) days.set(dayKey(ph.takenAt), [...(days.get(dayKey(ph.takenAt)) ?? []), ph]);
  const next = p.phases.find((x) => x.progress < 100);
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="bg-river-deep px-6 py-5 text-ivory"><div className="mx-auto flex max-w-4xl items-center justify-between"><Logo dark size={26} /><span className="text-xs uppercase tracking-[0.25em] text-ivory/60">{p.company.name}</span></div></header>
      <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        <section>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Project progress update{p.client ? ` for ${p.client}` : ""}</p>
          <h1 className="mt-1 font-serif text-5xl font-semibold text-river-deep">{p.name}</h1>
          <p className="mt-1 text-muted">{p.location} · {fmtDate(p.startDate)} → {fmtDate(p.expectedEnd)}</p>
          <div className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-card"><div className="flex items-end justify-between"><p className="text-6xl font-semibold tabular-nums text-river-deep">{p.progress}<span className="text-2xl text-muted">%</span></p><p className="text-sm text-muted">overall progress</p></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-river" style={{ width: `${p.progress}%` }} /></div>{next && <p className="mt-4 text-sm text-muted">Next milestone: <b className="text-charcoal">{next.name}</b> · due {fmtShort(next.endDate)}</p>}</div>
        </section>
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted">Construction stages</h2>
          <ul className="space-y-2">{p.phases.map((ph) => <li key={ph.id} className="flex items-center gap-4 rounded-xl border border-line bg-white px-4 py-3"><span className="w-32 text-sm font-medium">{ph.name}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200"><div className={`h-full rounded-full ${ph.progress >= 100 ? "bg-teal" : "bg-river"}`} style={{ width: `${ph.progress}%` }} /></div><span className="w-20 text-right text-xs text-muted">{ph.progress >= 100 ? "Complete" : `${ph.progress}%`}</span></li>)}</ul>
        </section>
        <section>
          <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted">Photo journal</h2>
          {!photos.length && <p className="text-sm text-muted">Photos will appear here as your project team shares them.</p>}
          <div className="space-y-8">{[...days.entries()].map(([d, list]) => (
            <div key={d}><h3 className="mb-3 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-river"><span>{fmtDay(new Date(d + "T00:00:00+05:30"))}</span><span className="h-px flex-1 bg-line" /></h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{list.map((ph) => (
                <figure key={ph.id} className="overflow-hidden rounded-xl border border-line bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/share/${token}/photos/${ph.id}`} alt={ph.task?.title ?? "Site photo"} loading="lazy" className="aspect-[4/3] w-full bg-stone-200 object-cover" />
                  <figcaption className="px-3 py-2 text-xs text-muted">{[ph.task?.title, ph.block, ph.floor, ph.locationArea].filter(Boolean).join(" · ") || "Site photo"}</figcaption>
                </figure>))}</div></div>))}</div>
        </section>
        <footer className="border-t border-line pt-4 text-xs text-muted">Shared by {p.company.name} · powered by ZUARI{share.expiresAt ? ` · link valid until ${fmtDate(share.expiresAt)}` : ""}</footer>
      </main>
    </div>
  );
}

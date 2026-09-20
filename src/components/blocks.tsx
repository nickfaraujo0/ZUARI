import Link from "next/link";
import { Chip, Photo } from "./ui";
import { ActionForm } from "./forms";
import { toggleClientVisible } from "@/actions/share";
import { HEALTH, HEALTH_TONE, relative, type Health, fmtDay, fmtShort, fmtTime, dayKey } from "@/lib/utils";

export const HealthChip = ({ health }: { health: Health }) => <Chip tone={HEALTH_TONE[health]} dot>{HEALTH[health]}</Chip>;

type Act = { id: string; message: string; detail: string | null; createdAt: Date; type: string; project?: { id: string; name: string } | null };
export function ActivityFeed({ items, showProject, empty = "No activity yet." }: { items: Act[]; showProject?: boolean; empty?: string }) {
  if (!items.length) return <p className="px-5 pb-6 text-sm text-muted">{empty}</p>;
  return (
    <ol className="relative px-5 pb-4">
      <span className="absolute left-[25px] top-2 bottom-6 w-px bg-line" aria-hidden />
      {items.map((a) => (
        <li key={a.id} className="relative flex gap-4 py-2.5">
          <span className={`z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white ${a.type === "ISSUE" ? "bg-amber-500" : a.type === "PHOTOS" ? "bg-teal" : "bg-river"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tabular-nums text-muted">{relative(a.createdAt)}</p>
            <p className="text-sm font-medium leading-snug">{a.message}</p>
            {(a.detail || (showProject && a.project)) && (
              <p className="truncate text-xs text-muted">
                {a.detail}{a.detail && showProject && a.project ? " · " : ""}
                {showProject && a.project && <Link href={`/projects/${a.project.id}`} className="hover:underline">{a.project.name}</Link>}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

type Ph = { clientVisible?: boolean; block?: string | null; floor?: string | null; locationArea?: string | null; id: string; takenAt: Date; caption?: string | null; issueId?: string | null; siteReportId?: string | null; task?: { title: string; phase?: { name: string } | null } | null; user: { name: string }; project?: { name: string } };
export function PhotoTile({ p, showProject, className }: { p: Ph; showProject?: boolean; className?: string }) {
  return (
    <a href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer" className={`group relative block overflow-hidden rounded-lg ${className ?? ""}`}>
      <Photo id={p.id} className="aspect-[4/3] w-full transition duration-500 group-hover:scale-[1.03]" alt={p.task?.title ?? "Progress photo"} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8 text-white">
        <p className="truncate text-xs font-medium">{p.task?.title ?? (showProject ? p.project?.name : "Site photo")}</p>
        <p className="truncate text-[11px] text-white/75">{p.user.name} · {fmtShort(p.takenAt)}, {fmtTime(p.takenAt)}</p>
        {[p.block, p.floor, p.locationArea].some(Boolean) && <p className="truncate text-[11px] text-white/90">{[p.block, p.floor, p.locationArea].filter(Boolean).join(" · ")}</p>}
      </div>
    </a>
  );
}

/** Photos grouped by day, then by task/activity — the visual construction journal. */
export function GroupedGallery({ photos, showProject, groupBy = "task", shareToggle }: { photos: Ph[]; showProject?: boolean; groupBy?: "task" | "phase"; shareToggle?: boolean }) {
  const days = new Map<string, Map<string, Ph[]>>();
  for (const p of photos) {
    const d = dayKey(p.takenAt), act = (groupBy === "phase" ? p.task?.phase?.name : p.task?.title) ?? (p.issueId ? "Reported issues" : p.siteReportId ? "Site updates" : "General site photos");
    if (!days.has(d)) days.set(d, new Map());
    const g = days.get(d)!;
    g.set(act, [...(g.get(act) ?? []), p]);
  }
  return (
    <div className="space-y-9">
      {[...days.entries()].map(([d, acts]) => (
        <section key={d}>
          <h3 className="mb-4 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-river"><span>{fmtDay(new Date(d + "T00:00:00+05:30"))}</span><span className="h-px flex-1 bg-line" /></h3>
          <div className="space-y-5">
            {[...acts.entries()].map(([act, list]) => (
              <div key={act}>
                <p className="mb-2 text-sm font-semibold">{act} <span className="font-normal text-muted">· {list.length}</span></p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{list.map((p) => <div key={p.id} className="relative"><PhotoTile p={p} showProject={showProject} />{shareToggle && <ActionForm action={toggleClientVisible} hideSubmit className="absolute right-2 top-2 z-10"><input type="hidden" name="photoId" value={p.id} /><button title="Show this photo on the client page" className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow ${p.clientVisible ? "bg-emerald-600 text-white" : "bg-white/90 text-charcoal"}`}>{p.clientVisible ? "Shared ✓" : "Share"}</button></ActionForm>}</div>)}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

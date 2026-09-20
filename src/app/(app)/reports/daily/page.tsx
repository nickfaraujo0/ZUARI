import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, projectScope } from "@/lib/access";
import { PrintButton } from "@/components/print-button";
import { ActionForm } from "@/components/forms";
import { shareReportWhatsApp } from "@/actions/whatsapp";
import { Photo } from "@/components/ui";
import { fmtDate, fmtTime, num, parseDate, PRIORITY, SEVERITY, startOfToday, toInputDate, TXN } from "@/lib/utils";

export const metadata = { title: "Daily site report" };
const DAY = 864e5;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-2 mt-7 border-b border-charcoal/20 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-river">{children}</h2>;
const Empty = ({ t }: { t: string }) => <p className="text-sm text-muted">{t}</p>;

export default async function DailyReport({ searchParams }: { searchParams: Promise<{ project?: string; date?: string }> }) {
  const u = await requireUser();
  if (!isManager(u)) notFound();
  const sp = await searchParams;
  const day = parseDate(sp.date);
  if (!sp.project || !day) redirect("/reports");
  const project = await prisma.project.findFirst({ where: { id: sp.project, ...projectScope(u) }, include: { manager: { select: { name: true } }, company: true, phases: { orderBy: { position: "asc" } } } });
  if (!project) notFound();
  const next = new Date(day.getTime() + DAY), range = { gte: day, lt: next };
  const pj = { companyId: u.companyId, projectId: project.id };
  const [reports, attendance, doneTasks, updates, txns, raised, resolved, open, photos, photoCount, dueNext] = await Promise.all([
    prisma.siteReport.findMany({ where: { ...pj, createdAt: range }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.attendance.findMany({ where: { ...pj, date: day }, include: { worker: { select: { trade: true } } } }),
    prisma.task.findMany({ where: { ...pj, completedAt: range }, select: { id: true, title: true } }),
    prisma.progressUpdate.findMany({ where: { ...pj, createdAt: range }, include: { user: { select: { name: true } }, task: { select: { title: true } }, _count: { select: { photos: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.materialTxn.findMany({ where: { ...pj, createdAt: range, type: { in: ["RECEIVED", "CONSUMED"] } }, include: { material: { select: { name: true, unit: true } } } }),
    prisma.issue.findMany({ where: { ...pj, createdAt: range }, include: { reporter: { select: { name: true } } } }),
    prisma.issue.findMany({ where: { ...pj, resolvedAt: range } }),
    prisma.issue.findMany({ where: { ...pj, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] }, severity: { in: ["HIGH", "CRITICAL"] }, createdAt: { lt: next } } }),
    prisma.progressPhoto.findMany({ where: { ...pj, takenAt: range }, include: { task: { select: { title: true } } }, orderBy: { takenAt: "asc" }, take: 12 }),
    prisma.progressPhoto.count({ where: { ...pj, takenAt: range } }),
    prisma.task.findMany({ where: { ...pj, dueDate: { gte: next, lt: new Date(next.getTime() + DAY) }, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } }, select: { title: true, priority: true } }),
  ]);
  const present = attendance.filter((a) => a.status === "PRESENT").length, half = attendance.filter((a) => a.status === "HALF").length;
  const trades = new Map<string, number>();
  for (const a of attendance) if (a.status !== "ABSENT") trades.set(a.worker.trade, (trades.get(a.worker.trade) ?? 0) + (a.status === "HALF" ? 0.5 : 1));
  const reported = Math.max(0, ...reports.map((r) => r.workforceCount));
  const workers = present + half ? present + half * 0.5 : reported;
  const bullets = (s?: string | null) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const completed = [...doneTasks.map((t) => t.title), ...reports.flatMap((r) => bullets(r.workCompleted))];
  const planned = [...reports.flatMap((r) => bullets(r.workPlanned)), ...dueNext.map((t) => `${t.title} (${PRIORITY[t.priority].toLowerCase()} priority, due next day)`)];
  return (
    <article className="mx-auto max-w-3xl rounded-xl border border-line bg-white p-8 shadow-card print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div><p className="text-[11px] uppercase tracking-[0.3em] text-muted">{project.company.name}</p><h1 className="font-serif text-4xl font-semibold text-river-deep">Daily Site Report</h1></div>
        <div className="flex flex-col items-end gap-2 print:hidden"><PrintButton /><ActionForm action={shareReportWhatsApp} submit="Send on WhatsApp" size="sm" variant="secondary" className="flex items-center gap-2" submitClass="!mt-0"><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="date" value={toInputDate(day)} /><select name="audience" className="h-8 rounded-lg border border-line bg-white px-2 text-xs"><option value="me">to me</option><option value="team">to opted-in team</option></select></ActionForm></div>
      </div>
      <div className="grid gap-x-8 gap-y-1 border-y border-line py-3 text-sm sm:grid-cols-2"><p><span className="text-muted">Project</span> <b>{project.name}</b> <span className="font-mono text-xs text-muted">{project.code}</span></p><p><span className="text-muted">Date</span> <b>{fmtDate(day)}</b></p><p><span className="text-muted">Location</span> {project.location}</p><p><span className="text-muted">Manager</span> {project.manager?.name ?? "—"}</p><p><span className="text-muted">Overall progress</span> <b>{project.progress}%</b></p><p><span className="text-muted">Status</span> {project.status.replace("_", " ").toLowerCase()}</p></div>

      <H>Workforce</H>
      {workers ? <><p className="text-sm"><b className="text-2xl">{num(workers)}</b> worker-days on site{present + half ? ` (${present} present${half ? `, ${half} half day` : ""}, from attendance)` : " (as reported by site update)"}.</p>{trades.size > 0 && <p className="mt-1 text-sm text-muted">{[...trades.entries()].map(([t, n]) => `${t} ${num(n)}`).join(" · ")}</p>}</> : <Empty t="No workforce recorded for this day." />}

      <H>Work completed</H>
      {completed.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{completed.map((c, i) => <li key={i}>{c}</li>)}</ul> : <Empty t="No completed work recorded." />}
      {updates.length > 0 && <div className="mt-3 space-y-1 text-sm">{updates.map((up) => <p key={up.id}><span className="text-muted">{fmtTime(up.createdAt)}</span> <b>{up.user.name}</b>{up.task ? ` on ${up.task.title}` : ""}{up.statusAfter && up.statusAfter !== up.statusBefore ? ` → ${up.statusAfter.replace("_", " ").toLowerCase()}` : ""}{up.note ? `: ${up.note}` : ""}{up._count.photos ? ` (${up._count.photos} photo${up._count.photos > 1 ? "s" : ""})` : ""}{[up.block, up.floor, up.locationArea].some(Boolean) ? ` · ${[up.block, up.floor, up.locationArea].filter(Boolean).join(", ")}` : ""}</p>)}</div>}

      <H>Work planned next</H>
      {planned.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{planned.map((c, i) => <li key={i}>{c}</li>)}</ul> : <Empty t="Nothing planned recorded." />}

      <H>Materials</H>
      {txns.length || reports.some((r) => r.materialsReceived) ? <ul className="list-disc space-y-1 pl-5 text-sm">{txns.map((t) => <li key={t.id}>{TXN[t.type]}: {num(t.quantity)} {t.material.unit} {t.material.name}</li>)}{reports.filter((r) => r.materialsReceived).map((r) => <li key={r.id}>Site note: {r.materialsReceived}</li>)}</ul> : <Empty t="No material movement recorded." />}

      <H>Issues</H>
      {raised.length + resolved.length + open.length ? <div className="space-y-1 text-sm">
        {raised.map((i) => <p key={i.id}><b>Raised</b> · {SEVERITY[i.severity]} · {i.title}{[i.block, i.floor, i.area].some(Boolean) ? ` (${[i.block, i.floor, i.area].filter(Boolean).join(", ")})` : ""} — {i.reporter.name}</p>)}
        {resolved.map((i) => <p key={i.id}><b>Resolved</b> · {i.title}</p>)}
        {open.filter((i) => !raised.some((r) => r.id === i.id)).map((i) => <p key={i.id}><b>Still open</b> · {SEVERITY[i.severity]} · {i.title}</p>)}</div> : <Empty t="No issues raised, resolved, or open at high severity." />}

      <H>Photos ({photoCount})</H>
      {photos.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{photos.map((p) => <figure key={p.id}><Photo id={p.id} className="aspect-[4/3] w-full rounded" /><figcaption className="mt-0.5 truncate text-[10px] text-muted">{p.task?.title ?? fmtTime(p.takenAt)}</figcaption></figure>)}</div> : <Empty t="No photos captured." />}
      {photoCount > photos.length && <p className="mt-1 text-xs text-muted">Showing {photos.length} of {photoCount}.</p>}

      {reports.length > 0 && <><H>Site notes</H><div className="space-y-1 text-sm">{reports.filter((r) => r.notes).map((r) => <p key={r.id}><b>{r.user.name}</b>: {r.notes}</p>)}{!reports.some((r) => r.notes) && <Empty t="—" />}</div></>}
      <p className="mt-8 border-t border-line pt-3 text-[11px] text-muted">Generated automatically by ZUARI on {fmtDate(new Date())} from data captured on site and in the office · Prepared for {u.name}{day.getTime() === startOfToday().getTime() ? " · Day not yet closed" : ""}{sp.date ? ` · ${toInputDate(day)}` : ""}</p>
    </article>
  );
}

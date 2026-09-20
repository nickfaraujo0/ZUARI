"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { pinIssue } from "@/actions/pins";
import { cn } from "@/lib/utils";

type Pin = { id: string; x: number; y: number; title: string; severity: string; status: string };
const COLOR: Record<string, string> = { CRITICAL: "#c0392b", HIGH: "#d99a1c", MEDIUM: "#3F6868", LOW: "#8a8f8d" };

/** Drawing with issue pins. Click / tap a spot to pin a new issue there. */
export function PinViewer({ documentId, src, pins, canPin, mobile, issuesHref }: { documentId: string; src: string; pins: Pin[]; canPin: boolean; mobile?: boolean; issuesHref: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [sel, setSel] = useState<Pin | null>(null);
  const [err, setErr] = useState(""); const [busy, start] = useTransition();
  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canPin || (e.target as HTMLElement).dataset.pin) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDraft({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }); setSel(null); setErr("");
  };
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!draft) return;
    const fd = new FormData(e.currentTarget); fd.set("documentId", documentId); fd.set("x", String(draft.x)); fd.set("y", String(draft.y));
    start(async () => { const r = await pinIssue(null, fd); if (r?.error) setErr(r.error); else { setDraft(null); router.refresh(); } });
  };
  const field = cn("w-full rounded-lg border border-line bg-white px-3 text-sm", mobile ? "h-12 text-base" : "h-10");
  return (
    <div className="space-y-3">
      <div className={cn("relative select-none overflow-hidden rounded-xl border border-line bg-white", canPin && "cursor-crosshair")} onClick={place} role="img" aria-label="Drawing with issue pins">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="block w-full" />
        {pins.map((p, i) => <button key={p.id} data-pin="1" type="button" title={p.title} onClick={() => { setSel(p); setDraft(null); }} className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-lg" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: COLOR[p.severity], opacity: ["RESOLVED", "CLOSED"].includes(p.status) ? 0.45 : 1 }}>{i + 1}</button>)}
        {draft && <span className="absolute size-7 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-dashed border-river bg-river/25" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }} />}
      </div>
      {!canPin && <p className="text-xs text-muted">Pins are shown for reference.</p>}
      {canPin && !draft && !sel && <p className="text-sm text-muted">Tap or click a spot on the drawing to pin an issue there.</p>}
      {sel && <div className="rounded-xl border border-line bg-white p-4 text-sm"><p className="font-semibold">{sel.title}</p><p className="mt-1 text-muted">{sel.severity.toLowerCase()} · {sel.status.replace("_", " ").toLowerCase()}</p><Link href={issuesHref} className="mt-2 inline-block font-medium text-river underline">Open issues →</Link></div>}
      {draft && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-line bg-white p-4">
          <input name="title" required minLength={3} placeholder="What's wrong here?" className={field} autoFocus />
          <select name="severity" defaultValue="MEDIUM" className={field}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</select>
          <textarea name="description" rows={2} placeholder="Details (optional)" className={cn(field, "h-auto py-2")} />
          {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
          <div className="flex gap-3"><button type="button" onClick={() => setDraft(null)} className={cn("flex-1 rounded-lg border border-line bg-white font-medium", mobile ? "h-12" : "h-10 text-sm")}>Cancel</button><button disabled={busy} className={cn("flex-1 rounded-lg bg-river font-medium text-ivory disabled:opacity-60", mobile ? "h-12" : "h-10 text-sm")}>{busy ? "Saving…" : "Pin issue"}</button></div>
        </form>
      )}
    </div>
  );
}

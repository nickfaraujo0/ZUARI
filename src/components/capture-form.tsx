"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, Minus, Plus, WifiOff, X } from "lucide-react";
import { reportIssue, submitProgress, submitSiteUpdate } from "@/actions/capture";
import { cn } from "@/lib/utils";
import { enqueue } from "@/lib/outbox";
import { useT } from "./i18n";

type Task = { id: string; title: string; status: string; progress: number; quantityTotal: number | null; quantityDone: number; quantityUnit: string | null };
type Project = { id: string; name: string; tasks: Task[] };
type Kind = "progress" | "issue" | "update";
type Photo = { id: string; file: File; url: string };

const CFG = {
  progress: { title: "Add Progress", cta: "Submit progress", act: submitProgress, ok: "Progress submitted" },
  issue: { title: "Report Issue", cta: "Report issue", act: reportIssue, ok: "Issue reported" },
  update: { title: "Site Update", cta: "Submit update", act: submitSiteUpdate, ok: "Site update submitted" },
} as const;
const STATUS = [["NOT_STARTED", "Not started"], ["IN_PROGRESS", "In progress"], ["COMPLETED", "Completed"]] as const;
const SEVERITY = [["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"], ["CRITICAL", "Critical"]] as const;
const MAX_PHOTOS = 8;

/** Downscale to ≤1600px JPEG so uploads stay fast on site connections. */
async function compress(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.82));
    if (!blob) throw new Error("encode");
    return new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}

const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted";
const field = "w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-river focus:ring-2 focus:ring-river/15";

export function CaptureForm({ kind, userId, projects, projectId, taskId, suggest }: { kind: Kind; userId: string; suggest?: { block: string[]; floor: string[]; area: string[] }; projects: Project[]; projectId?: string; taskId?: string }) {
  const cfg = CFG[kind];
  const tr = useT();
  const draftKey = `zuari:draft:${kind}`;
  const initialProject = projects.find((p) => p.id === projectId) ?? projects.find((p) => p.tasks.some((t) => t.id === taskId)) ?? projects[0];
  const initialTask = initialProject?.tasks.find((t) => t.id === taskId);

  const [pid, setPid] = useState(initialProject?.id ?? "");
  const [tid, setTid] = useState(initialTask?.id ?? "");
  const [status, setStatus] = useState(initialTask?.status === "NOT_STARTED" ? "IN_PROGRESS" : initialTask?.status ?? "IN_PROGRESS");
  const [progress, setProgress] = useState(initialTask?.progress ? Math.min(99, initialTask.progress) : 50);
  const [text, setText] = useState<Record<string, string>>({});
  const [qty, setQty] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [workers, setWorkers] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [queued, setQueued] = useState(false);
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [online, setOnline] = useState(true);
  const [, start] = useTransition();
  const cam = useRef<HTMLInputElement>(null), pick = useRef<HTMLInputElement>(null);
  const project = projects.find((p) => p.id === pid);
  const task = project?.tasks.find((t) => t.id === tid);
  const set = (k: string) => (v: string) => setText((t) => ({ ...t, [k]: v }));

  // Connectivity + draft persistence: typed details survive a reload or a dropped signal.
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync(); addEventListener("online", sync); addEventListener("offline", sync);
    // Restore a saved draft after mount (localStorage only exists on the client).
    const restore = setTimeout(() => { try { const d = JSON.parse(localStorage.getItem(draftKey) ?? "null"); if (d?.text) { setText(d.text); if (d.workers) setWorkers(d.workers); if (d.severity) setSeverity(d.severity); } } catch {} }, 0);
    return () => { clearTimeout(restore); removeEventListener("online", sync); removeEventListener("offline", sync); };
  }, [draftKey]);
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify({ text, workers, severity })); } catch {} }, [text, workers, severity, draftKey]);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const room = MAX_PHOTOS - photos.length;
    const next: Photo[] = [];
    for (const f of [...list].slice(0, room)) {
      try { const file = await compress(f); next.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }); }
      catch { setError("Couldn't read one of those photos. Try a JPEG or PNG."); }
    }
    setPhotos((p) => [...p, ...next]);
  }
  const removePhoto = (id: string) => setPhotos((p) => { p.filter((x) => x.id === id).forEach((x) => URL.revokeObjectURL(x.url)); return p.filter((x) => x.id !== id); });

  function chooseTask(id: string) {
    setTid(id);
    const t = project?.tasks.find((x) => x.id === id);
    if (t) { setStatus(t.status === "NOT_STARTED" ? "IN_PROGRESS" : t.status); setProgress(t.progress > 0 && t.progress < 100 ? t.progress : 50); }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pid) return setError("Choose a project first.");
    if (kind === "issue" && !(text.title ?? "").trim()) return setError("Give the issue a short title.");
    const fd = new FormData();
    fd.set("projectId", pid);
    if (kind === "progress") {
      if (tid) { fd.set("taskId", tid); if (task?.quantityTotal) fd.set("quantity", qty || "0"); else { fd.set("status", status); if (status === "IN_PROGRESS") fd.set("progress", String(progress)); } }
      fd.set("note", text.note ?? "");
      for (const k of ["block", "floor", "area"]) fd.set(k, text[k] ?? "");
    } else if (kind === "issue") {
      fd.set("title", text.title ?? ""); fd.set("severity", severity); fd.set("area", text.area ?? ""); fd.set("block", text.block ?? ""); fd.set("floor", text.floor ?? ""); fd.set("description", text.description ?? "");
      if (tid) fd.set("taskId", tid);
    } else {
      fd.set("workforceCount", String(workers));
      for (const k of ["workCompleted", "workPlanned", "materialsReceived", "notes"]) fd.set(k, text[k] ?? "");
    }
    fd.set("clientId", clientId);
    photos.forEach((p) => fd.append("photos", p.file));
    const label = `${cfg.title} · ${kind === "issue" ? (text.title ?? "") : (task?.title ?? project?.name ?? "")}`.trim();
    // No signal (or the request never got through): keep everything on the phone and upload later.
    const queueIt = async () => {
      try {
        await enqueue({ id: clientId, userId, kind, label, fields: [...fd.entries()].filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "clientId"), photos: photos.map((p) => p.file), createdAt: Date.now() });
        try { localStorage.removeItem(draftKey); } catch {}
        setQueued(true); setDone(true);
      } catch { setError("Could not save this on your phone. Free some storage and try again."); }
    };
    setBusy(true);
    start(async () => {
      if (!navigator.onLine) await queueIt();
      else {
        try {
          const res = await cfg.act(null, fd);
          if (res?.error) setError(res.error);
          else { try { localStorage.removeItem(draftKey); } catch {} setDone(true); }
        } catch { await queueIt(); }
      }
      setBusy(false);
    });
  }

  if (done) return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
      <CheckCircle2 className="size-20 text-emerald-600" strokeWidth={1.5} />
      <h2 className="mt-5 font-serif text-4xl font-semibold text-river-deep">{tr(queued ? "Saved on this phone" : cfg.ok)}</h2>
      <p className="mt-2 text-muted">{queued ? "It will upload automatically as soon as you have signal. You can keep working." : tr("Your manager can see it in the office right now.")}</p>
      <div className="mt-8 w-full space-y-3">
        <Link href="/site" className="flex h-14 items-center justify-center rounded-2xl bg-river text-base font-semibold text-ivory">{tr("Back to Home")}</Link>
        <button onClick={() => { photos.forEach((p) => URL.revokeObjectURL(p.url)); setDone(false); setQueued(false); setQty(""); setClientId(crypto.randomUUID()); setPhotos([]); setText({}); setWorkers(0); }} className="h-14 w-full rounded-2xl border border-line bg-white text-base font-semibold">{tr("Add another")}</button>
      </div>
    </div>
  );

  const photoBlock = (
    <div>
      <span className={label}>{tr(kind === "issue" ? "Photo of the issue" : "Photos")}{photos.length ? ` · ${photos.length}` : ""}</span>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      {photos.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Selected" className="size-full object-cover" />
              <button type="button" onClick={() => removePhoto(p.id)} aria-label="Remove photo" className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"><X className="size-4" /></button>
            </div>
          ))}
        </div>
      )}
      {photos.length < MAX_PHOTOS && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => cam.current?.click()} className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-river text-ivory active:scale-[.98]"><Camera className="size-7" /><span className="text-sm font-semibold">{tr("Take photo")}</span></button>
          <button type="button" onClick={() => pick.current?.click()} className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-river/30 bg-white text-river active:scale-[.98]"><ImagePlus className="size-7" /><span className="text-sm font-semibold">{tr("Choose photos")}</span></button>
        </div>
      )}
    </div>
  );

  const loc = (k: "block" | "floor" | "area", l: string, ph: string) => (
    <div><span className={label}>{tr(l)}</span><input list={`loc-${k}`} value={text[k] ?? ""} onChange={(e) => set(k)(e.target.value)} placeholder={ph} className={cn(field, "h-14")} /><datalist id={`loc-${k}`}>{(suggest?.[k] ?? []).map((v) => <option key={v} value={v} />)}</datalist></div>
  );
  const locationBlock = (
    <div className="space-y-3"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{tr("Where on site (optional)")}</p><div className="grid grid-cols-2 gap-3">{loc("block", "Block / tower", "Block A")}{loc("floor", "Floor", "Floor 2")}</div>{loc("area", "Area / room", "Master bedroom")}</div>
  );
  const projectBlock = projects.length > 1 && (
    <div><span className={label}>{tr("Project")}</span>
      <select value={pid} onChange={(e) => { setPid(e.target.value); setTid(""); }} className={cn(field, "h-14")}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    </div>
  );
  const taskBlock = (
    <div><span className={label}>{tr(kind === "issue" ? "Related task (optional)" : "Task / activity")}</span>
      <select value={tid} onChange={(e) => chooseTask(e.target.value)} className={cn(field, "h-14")}>
        <option value="">{tr(kind === "issue" ? "Not linked to a task" : "General site progress")}</option>
        {project?.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </div>
  );
  const area = (k: string, l: string, ph: string, rows = 3) => (
    <div><span className={label}>{tr(l)}</span><textarea value={text[k] ?? ""} onChange={(e) => set(k)(e.target.value)} rows={rows} placeholder={tr(ph)} className={cn(field, "py-3")} /></div>
  );

  return (
    <form onSubmit={submit} className="space-y-6 p-5 pb-36">
      {!online && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200"><WifiOff className="size-4 shrink-0" />{tr("You're offline. You can still submit: it is saved on this phone and uploads automatically when the signal returns.")}</p>}
      {projects.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-muted ring-1 ring-line">You&apos;re not on any active project yet.</p>}

      {kind === "progress" && (<>
        {photoBlock}{projectBlock}{taskBlock}
        {task?.quantityTotal ? (
          <div><span className={label}>Quantity completed today ({task.quantityUnit ?? "units"})</span><input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0" className={cn(field, "h-16 text-2xl font-semibold")} /><p className="mt-2 text-sm text-muted">{task.quantityDone} of {task.quantityTotal} {task.quantityUnit} done so far{qty ? ` → ${Math.min(task.quantityTotal, task.quantityDone + Number(qty || 0))} after this update` : ""}</p></div>
        ) : task && (
          <div className="space-y-4">
            <div><span className={label}>{tr("Status")}</span>
              <div className="grid grid-cols-3 gap-2">{STATUS.map(([v, l]) => <button key={v} type="button" onClick={() => setStatus(v)} aria-pressed={status === v} className={cn("h-14 rounded-xl text-sm font-semibold ring-1 ring-inset", status === v ? "bg-river text-ivory ring-river" : "bg-white text-charcoal ring-line")}>{tr(l)}</button>)}</div>
            </div>
            {status === "IN_PROGRESS" && (
              <div><span className={label}>Progress · {progress}%</span><input type="range" min={5} max={95} step={5} value={progress} onChange={(e) => setProgress(+e.target.value)} className="h-10 w-full" /></div>
            )}
          </div>
        )}
        {locationBlock}
        {area("note", "Note (optional)", "What was done? Anything the office should know?")}
      </>)}

      {kind === "issue" && (<>
        <div><span className={label}>{tr("What's the problem?")}</span><input value={text.title ?? ""} onChange={(e) => set("title")(e.target.value)} placeholder="e.g. Water leakage — Floor 2" className={cn(field, "h-14")} /></div>
        <div><span className={label}>{tr("Severity")}</span>
          <div className="grid grid-cols-4 gap-2">{SEVERITY.map(([v, l]) => <button key={v} type="button" onClick={() => setSeverity(v)} aria-pressed={severity === v} className={cn("h-12 rounded-xl text-sm font-semibold ring-1 ring-inset", severity === v ? (v === "CRITICAL" ? "bg-red-700 text-white ring-red-700" : v === "HIGH" ? "bg-amber-500 text-white ring-amber-500" : "bg-river text-ivory ring-river") : "bg-white ring-line")}>{tr(l)}</button>)}</div>
        </div>
        {photoBlock}{projectBlock}
        {locationBlock}
        {taskBlock}
        {area("description", "Details (optional)", "What did you see? Any immediate risk?")}
      </>)}

      {kind === "update" && (<>
        {projectBlock}
        <div><span className={label}>{tr("Workers on site")}</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setWorkers((w) => Math.max(0, w - 1))} aria-label="Fewer workers" className="flex size-14 items-center justify-center rounded-xl bg-white ring-1 ring-line active:bg-stone-100"><Minus /></button>
            <input inputMode="numeric" value={workers} onChange={(e) => setWorkers(Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))} className={cn(field, "h-14 text-center text-2xl font-semibold")} aria-label="Workers on site" />
            <button type="button" onClick={() => setWorkers((w) => w + 1)} aria-label="More workers" className="flex size-14 items-center justify-center rounded-xl bg-river text-ivory active:opacity-90"><Plus /></button>
          </div>
        </div>
        {area("workCompleted", "Work completed today", "Column casting — Block A, brickwork Floor 1…")}
        {area("workPlanned", "Work planned next", "Slab shuttering Floor 2…", 2)}
        {area("materialsReceived", "Materials received", "Steel 2.4 t, cement 200 bags…", 2)}
        {area("notes", "Notes (optional)", "Weather, delays, visitors…", 2)}
        {photoBlock}
      </>)}

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-line bg-ivory/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button type="submit" disabled={busy || !pid} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-river text-base font-semibold text-ivory disabled:opacity-50">
          {busy ? <><Loader2 className="size-5 animate-spin" />{tr(online ? "Uploading…" : "Saving…")}</> : tr(online ? cfg.cta : "Save to send later")}
        </button>
      </div>
    </form>
  );
}

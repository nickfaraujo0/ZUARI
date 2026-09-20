"use client";
import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type P = { id: string; label: string };
/** Same-view comparison: before/after slider, plus a time-lapse of every photo taken at this spot. */
export function PhotoCompare({ photos }: { photos: P[] }) {
  const [mode, setMode] = useState<"compare" | "lapse">("compare");
  const [a, setA] = useState(0), [b, setB] = useState(photos.length - 1), [pos, setPos] = useState(50);
  const [frame, setFrame] = useState(0), [playing, setPlaying] = useState(false);
  useEffect(() => { if (!playing || mode !== "lapse") return; const t = setInterval(() => setFrame((f) => (f + 1) % photos.length), 900); return () => clearInterval(t); }, [playing, mode, photos.length]);
  const src = (i: number) => `/api/photos/${photos[i].id}`;
  const sel = "h-9 rounded-lg border border-line bg-white px-2 text-sm";
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-sm">{([["compare", "Before / after"], ["lapse", "Time-lapse"]] as const).map(([k, l]) => <button key={k} onClick={() => { setMode(k); setPlaying(false); }} className={cn("rounded-md px-3 py-1", mode === k ? "bg-river text-ivory" : "text-muted")}>{l}</button>)}</div>
      {mode === "compare" ? (
        <>
          <div className="flex flex-wrap gap-3 text-sm"><label className="text-muted">Before <select value={a} onChange={(e) => setA(+e.target.value)} className={sel}>{photos.map((p, i) => <option key={p.id} value={i}>{p.label}</option>)}</select></label><label className="text-muted">After <select value={b} onChange={(e) => setB(+e.target.value)} className={sel}>{photos.map((p, i) => <option key={p.id} value={i}>{p.label}</option>)}</select></label></div>
          <div className="relative aspect-[4/3] max-w-3xl select-none overflow-hidden rounded-xl bg-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(b)} alt="After" className="absolute inset-0 size-full object-cover" draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(a)} alt="Before" className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} draggable={false} />
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}><span className="absolute top-1/2 -ml-4 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-river shadow">⇔</span></div>
            <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{photos[a].label}</span><span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{photos[b].label}</span>
            <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} aria-label="Compare slider" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
          </div>
        </>
      ) : (
        <div className="max-w-3xl space-y-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(frame)} alt={photos[frame].label} className="size-full object-cover" />
            <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{photos[frame].label}</span><span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{frame + 1} / {photos.length}</span>
          </div>
          <div className="flex items-center gap-3"><button onClick={() => setPlaying((p) => !p)} className="flex size-10 items-center justify-center rounded-full bg-river text-ivory" aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button><input type="range" min={0} max={photos.length - 1} value={frame} onChange={(e) => { setFrame(+e.target.value); setPlaying(false); }} className="flex-1" aria-label="Frame" /></div>
        </div>
      )}
    </div>
  );
}

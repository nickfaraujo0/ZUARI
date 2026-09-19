"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CloudUpload, Loader2 } from "lucide-react";
import { discard, flush, isFlushing, outboxList, update, type OutboxItem } from "@/lib/outbox";

/** Shows queued offline submissions and syncs them when the signal returns. */
export function SyncStatus({ userId }: { userId: string }) {
  const path = usePathname();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => { setItems(await outboxList(userId)); setBusy(isFlushing()); }, [userId]);

  useEffect(() => {
    const onChange = () => { void refresh(); };
    const onOnline = () => { void flush(userId); };
    addEventListener("zuari-outbox", onChange); addEventListener("online", onOnline);
    const t = setTimeout(() => { void refresh(); void flush(userId); }, 0);
    const poll = setInterval(() => { void flush(userId); }, 20000);
    return () => { removeEventListener("zuari-outbox", onChange); removeEventListener("online", onOnline); clearTimeout(t); clearInterval(poll); };
  }, [refresh, userId]);

  if (!items.length || /^\/site\/(add-progress|report-issue|site-update)/.test(path)) return null;
  const failed = items.filter((i) => i.error), waiting = items.length - failed.length;
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-[480px] px-4">
      <button onClick={() => setOpen((o) => !o)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium shadow-lg ring-1 ${failed.length ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-river text-ivory ring-river"}`}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : failed.length ? <AlertTriangle className="size-5" /> : <CloudUpload className="size-5" />}
        <span className="flex-1">{busy ? "Uploading…" : failed.length ? `${failed.length} update${failed.length > 1 ? "s" : ""} couldn't be sent` : `${waiting} update${waiting > 1 ? "s" : ""} waiting to upload`}</span>
        <span className="text-xs opacity-70">{open ? "Hide" : "Details"}</span>
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-white text-sm shadow-lg ring-1 ring-line">
          {items.map((i) => (
            <li key={i.id} className="p-3.5">
              <p className="font-medium">{i.label}</p>
              <p className="text-xs text-muted">{i.photos.length} photo{i.photos.length === 1 ? "" : "s"} · {i.error ?? "Waiting to upload"}</p>
              {i.error && <div className="mt-2 flex gap-4 text-sm font-medium"><button onClick={() => { void update({ ...i, error: undefined }).then(() => flush(userId)); }} className="text-river">Try again</button><button onClick={() => { void discard(i.id); }} className="text-red-700">Discard</button></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

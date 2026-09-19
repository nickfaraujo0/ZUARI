// Client-side outbox: submissions made without signal are stored in IndexedDB (photos included)
// and uploaded automatically later. Each item carries a clientId so the server can de-duplicate retries.
import { reportIssue, submitProgress, submitSiteUpdate } from "@/actions/capture";

export type Kind = "progress" | "issue" | "update";
export type OutboxItem = { id: string; userId: string; kind: Kind; label: string; fields: [string, string][]; photos: File[]; createdAt: number; error?: string };

const DB = "zuari-outbox", STORE = "items";
const ACTIONS = { progress: submitProgress, issue: reportIssue, update: submitSiteUpdate } as const;
const changed = () => window.dispatchEvent(new Event("zuari-outbox"));

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((res, rej) => { const r = fn(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  } finally { db.close(); }
}
/** Only ever returns the signed-in user's items, so a shared phone can't upload someone else's update under the wrong account. */
export const outboxList = async (userId: string) => { try { return ((await run("readonly", (s) => s.getAll())) as OutboxItem[]).filter((i) => i.userId === userId).sort((a, b) => a.createdAt - b.createdAt); } catch { return []; } };
export async function enqueue(item: OutboxItem) { await run("readwrite", (s) => s.put(item)); changed(); }
export async function update(item: OutboxItem) { await run("readwrite", (s) => s.put(item)); changed(); }
export async function discard(id: string) { await run("readwrite", (s) => s.delete(id)); changed(); }

let flushing = false;
/** Upload queued items in order. Stops at the first network failure; marks items the server rejected. */
export async function flush(userId: string) {
  if (flushing || !navigator.onLine) return;
  flushing = true; changed();
  try {
    for (const it of (await outboxList(userId)).filter((i) => !i.error)) {
      const fd = new FormData();
      it.fields.forEach(([k, v]) => fd.append(k, v));
      fd.set("clientId", it.id);
      it.photos.forEach((f) => fd.append("photos", f));
      let res;
      try { res = await ACTIONS[it.kind](null, fd); } catch { break; } // still offline / server unreachable: retry later
      if (res?.error) await update({ ...it, error: res.error });
      else await discard(it.id);
    }
  } finally { flushing = false; changed(); }
}
export const isFlushing = () => flushing;

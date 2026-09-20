import type { TaskStatus } from "@prisma/client";

/** Single source of truth for how status and progress relate. */
export function taskData(status: TaskStatus, progress?: number | null, prev?: { progress: number; completedAt: Date | null }) {
  let p = progress ?? prev?.progress ?? 0;
  if (status === "NOT_STARTED") p = 0;
  else if (status === "COMPLETED" || status === "VERIFIED") p = 100;
  else p = p <= 0 ? 10 : p >= 100 ? 90 : Math.round(p);
  const done = status === "COMPLETED" || status === "VERIFIED";
  return { status, progress: p, completedAt: done ? (prev?.completedAt ?? new Date()) : null };
}

/** For tasks measured by quantity, progress is derived from quantity done; status follows it. */
export function qtyData(total: number, done: number, cur: { status: TaskStatus; completedAt: Date | null }) {
  const d = Math.max(0, Math.min(total, done));
  let status: TaskStatus = cur.status;
  if (d >= total) status = cur.status === "VERIFIED" ? "VERIFIED" : "COMPLETED";
  else if (d > 0 && cur.status !== "IN_PROGRESS") status = "IN_PROGRESS";
  else if (d === 0 && (cur.status === "COMPLETED" || cur.status === "VERIFIED")) status = "NOT_STARTED";
  const finished = status === "COMPLETED" || status === "VERIFIED";
  return { quantityDone: d, progress: Math.round((d / total) * 100), status, completedAt: finished ? (cur.completedAt ?? new Date()) : null };
}

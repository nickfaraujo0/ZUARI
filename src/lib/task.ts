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

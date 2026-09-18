import "server-only";
import { z } from "zod";
import { requireUser, type SessionUser } from "./auth";
import { UserError } from "./access";

export type ActionState = { error?: string; ok?: boolean; message?: string } | null;

/** Wraps a server action: authenticates, converts expected errors into form state, rethrows redirects. */
export function action(fn: (u: SessionUser, fd: FormData) => Promise<Partial<NonNullable<ActionState>> | void>, opts: { auth?: boolean } = {}) {
  return async (_prev: ActionState, fd: FormData): Promise<ActionState> => {
    try {
      const u = opts.auth === false ? (null as unknown as SessionUser) : await requireUser();
      const r = await fn(u, fd);
      return { ok: true, ...(r ?? {}) };
    } catch (e) {
      const digest = (e as { digest?: string })?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
      if (e instanceof UserError) return { error: e.message };
      if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Please check the form." };
      console.error("[action]", e);
      return { error: "Something went wrong. Please try again." };
    }
  };
}

// FormData helpers: "" → undefined so optional zod fields behave.
export const obj = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, (v as string).trim() === "" ? undefined : (v as string).trim()]));
export const files = (fd: FormData, k = "photos") => fd.getAll(k).filter((f): f is File => f instanceof File && f.size > 0);
export const cuid = (label: string) => z.string({ error: `${label} is required` }).min(1, `${label} is required`);
export const optId = z.string().optional();
export const dateStr = (label: string) => z.string({ error: `${label} is required` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date`);
export const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional();

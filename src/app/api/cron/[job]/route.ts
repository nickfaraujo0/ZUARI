import { createHash, timingSafeEqual } from "node:crypto";
import { runEscalations, sendDigests } from "@/lib/schedules";
import { sendWeeklySummaries } from "@/lib/summary";

const eq = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

// Scheduled jobs: call with `Authorization: Bearer $CRON_SECRET` (cron, Vercel Cron, GitHub Actions …).
async function handle(req: Request, ctx: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Scheduled jobs are disabled: set CRON_SECRET" }, { status: 503 });
  if (!eq(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { job } = await ctx.params;
  if (job === "escalate") return Response.json(await runEscalations());
  if (job === "digest-daily") return Response.json(await sendDigests("DAILY"));
  if (job === "digest-weekly") return Response.json(await sendDigests("WEEKLY"));
  if (job === "weekly-summary") return Response.json(await sendWeeklySummaries());
  return Response.json({ error: "Unknown job" }, { status: 404 });
}
export const GET = handle, POST = handle;

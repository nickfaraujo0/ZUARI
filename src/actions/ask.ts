"use server";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/access";
import { action } from "@/lib/action";
import { aiEnabled, askAllowed, askModel, buildContext, type Source } from "@/lib/ask";
import { sendMail } from "@/lib/mail";
import { weeklySummary } from "@/lib/summary";

export type Answer = { answer?: string; sources?: Source[]; error?: string; ai?: boolean };

/** Natural-language questions over the caller's own permitted data. */
export async function askZuari(question: string): Promise<Answer> {
  const u = await requireUser();
  if (!isManager(u) && u.role !== "ACCOUNTANT") return { error: "Not available for your role." };
  const q = question.trim().slice(0, 500);
  if (q.length < 3) return { error: "Ask a question, for example “What is delaying Dona Paula Villa?”" };
  if (!askAllowed(u.id)) return { error: "You've asked a lot of questions this hour. Try again shortly." };
  const ctx = await buildContext(u);
  if (!aiEnabled()) {
    const risky = ctx.insights.filter((i) => i.factors.length);
    return { ai: false, answer: `AI answers switch on when an ANTHROPIC_API_KEY is configured. Meanwhile, this is what your data shows right now:\n\n${risky.length ? risky.map((i) => `${i.name}: ${i.factors.slice(0, 3).map((f) => f.text).join(" ")}`).join("\n\n") : "No projects have open risk factors."}`, sources: [] };
  }
  try {
    const answer = await askModel(q, ctx.text);
    const cited = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))];
    return { ai: true, answer: answer || "I couldn't produce an answer from the available data.", sources: ctx.sources.filter((s) => cited.includes(s.n)) };
  } catch (e) { console.error("[ask]", e); return { error: "The AI service is unavailable right now. Please try again." }; }
}

export const emailWeeklySummary = action(async (u) => {
  if (!isManager(u) && u.role !== "ACCOUNTANT") throw new Error("Not available for your role.");
  await sendMail({ to: u.email, subject: "Your ZUARI weekly summary", text: await weeklySummary(u) });
  return { message: `Summary sent to ${u.email}` };
});

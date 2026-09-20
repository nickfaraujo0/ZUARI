"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { askZuari, type Answer } from "@/actions/ask";

const EXAMPLES = ["Which projects need attention this week?", "What is delaying my projects?", "Which tasks are overdue and who owns them?", "Summarise this week's site activity."];

/** Renders [n] citations in an answer as links to the records they came from. */
function Cited({ text, sources }: { text: string; sources: Answer["sources"] }) {
  return <>{text.split(/(\[\d+\])/g).map((part, i) => { const m = part.match(/^\[(\d+)\]$/), s = m && sources?.find((x) => x.n === Number(m[1])); return s ? <Link key={i} href={s.href} title={s.label} className="mx-0.5 inline-flex size-5 items-center justify-center rounded bg-river/10 align-text-top text-[11px] font-semibold text-river no-underline hover:bg-river/20">{s.n}</Link> : <span key={i}>{part}</span>; })}</>;
}

export function AskBox() {
  const [q, setQ] = useState(""), [res, setRes] = useState<Answer | null>(null), [busy, start] = useTransition();
  const go = (question: string) => { if (!question.trim()) return; setRes(null); start(async () => setRes(await askZuari(question))); };
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="flex gap-2">
        <div className="relative flex-1"><Sparkles className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-river" /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask ZUARI" placeholder="Ask about your projects…" maxLength={500} className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-[15px] outline-none focus:border-river focus:ring-2 focus:ring-river/15" /></div>
        <button disabled={busy} className="flex h-12 items-center gap-2 rounded-xl bg-river px-5 text-sm font-medium text-ivory disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Ask</button>
      </form>
      <div className="flex flex-wrap gap-2">{EXAMPLES.map((e) => <button key={e} type="button" onClick={() => { setQ(e); go(e); }} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs hover:bg-stone-50">{e}</button>)}</div>
      {res?.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{res.error}</p>}
      {res?.answer && (
        <div className="rounded-xl border border-line bg-white p-5 shadow-card" data-testid="answer">
          <p className="whitespace-pre-line text-[15px] leading-relaxed"><Cited text={res.answer} sources={res.sources} /></p>
          {!!res.sources?.length && <div className="mt-4 border-t border-line pt-3"><p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Sources</p><ul className="space-y-1 text-sm">{res.sources.map((s) => <li key={s.n}><Link href={s.href} className="text-river hover:underline"><b>[{s.n}]</b> {s.label}</Link></li>)}</ul></div>}
        </div>
      )}
    </div>
  );
}

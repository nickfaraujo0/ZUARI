import { addDelay, deleteDelay, logWeatherDelays } from "@/actions/delays";
import { ActionForm, ConfirmSubmit } from "./forms";
import { Card, CardHead, Chip, Field, inputCls, Select } from "./ui";
import { fmtDate, opts, startOfToday, toInputDate } from "@/lib/utils";

export const DELAY_CAUSE = { WEATHER: "Weather", MATERIAL: "Material", APPROVAL: "Approval", LABOUR: "Labour", DESIGN: "Design", EQUIPMENT: "Equipment", OTHER: "Other" } as const;
type D = { id: string; date: Date; cause: keyof typeof DELAY_CAUSE; days: number; note: string | null; source: string; phase: { name: string } | null };

export function DelayLogCard({ projectId, delays, phases, suggestions, canManage }: { projectId: string; delays: D[]; phases: { id: string; name: string }[]; suggestions: { date: string; rain: number }[]; canManage: boolean }) {
  const total = delays.reduce((s, d) => s + d.days, 0);
  const byCause = Object.keys(DELAY_CAUSE).map((k) => ({ k: k as keyof typeof DELAY_CAUSE, n: delays.filter((d) => d.cause === k).reduce((s, d) => s + d.days, 0) })).filter((x) => x.n > 0);
  return (
    <Card>
      <CardHead title="Delay log" sub={`${total} day${total === 1 ? "" : "s"} lost${byCause.length ? " · " + byCause.map((x) => `${DELAY_CAUSE[x.k]} ${x.n}`).join(" · ") : ""}`} />
      {suggestions.length > 0 && canManage && (
        <ActionForm action={logWeatherDelays} submit={`Log ${suggestions.length} heavy-rain day${suggestions.length > 1 ? "s" : ""} as delays`} size="sm" variant="secondary" className="flex flex-wrap items-center gap-3 border-t border-line bg-amber-50/60 px-5 py-3" submitClass="!mt-0">
          <input type="hidden" name="projectId" value={projectId} /><span className="text-sm text-amber-900">Heavy rain recorded on {suggestions.map((s) => `${s.date.slice(8)}/${s.date.slice(5, 7)} (${Math.round(s.rain)} mm)`).join(", ")} isn&apos;t logged yet.</span>
        </ActionForm>
      )}
      <ul className="divide-y divide-line/70 border-t border-line/70">
        {delays.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
            <span className="w-24 text-xs text-muted">{fmtDate(d.date)}</span><Chip tone={d.cause === "WEATHER" ? "teal" : "sand"}>{DELAY_CAUSE[d.cause]}</Chip>
            <span className="min-w-0 flex-1">{d.days} day{d.days === 1 ? "" : "s"}{d.phase ? ` · ${d.phase.name}` : ""}{d.note ? <span className="text-muted"> — {d.note}</span> : null}</span>
            {canManage && <ActionForm action={deleteDelay} hideSubmit><input type="hidden" name="id" value={d.id} /><ConfirmSubmit message="Remove this delay entry?" className="text-xs text-red-700 hover:underline">Remove</ConfirmSubmit></ActionForm>}
          </li>
        ))}
        {!delays.length && <li className="px-5 py-5 text-sm text-muted">No delays logged. Record days lost to weather, materials, approvals or labour so extension-of-time claims have evidence.</li>}
      </ul>
      <ActionForm action={addDelay} reset submit="Log delay" size="sm" className="grid gap-3 border-t border-line bg-stone-50/60 p-5 sm:grid-cols-5" submitClass="sm:col-span-5 !mt-0 w-fit">
        <input type="hidden" name="projectId" value={projectId} />
        <Field label="Date"><input name="date" type="date" required max={toInputDate(startOfToday())} defaultValue={toInputDate(startOfToday())} className={inputCls} /></Field>
        <Field label="Cause"><Select name="cause" defaultValue="WEATHER" options={opts(DELAY_CAUSE)} /></Field>
        <Field label="Days lost"><input name="days" type="number" step="0.25" min="0.25" defaultValue={1} className={inputCls} /></Field>
        <Field label="Phase"><Select name="phaseId" placeholder="—" options={phases.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        <Field label="Note"><input name="note" className={inputCls} /></Field>
      </ActionForm>
    </Card>
  );
}

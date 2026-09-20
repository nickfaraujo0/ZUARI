import { CloudRain } from "lucide-react";
import { Card, CardHead } from "./ui";
import { isWet, HEAVY_MM, type Day } from "@/lib/weather";
import { fmtShort } from "@/lib/utils";

type Risk = { task: { id: string; title: string }; days: string[] };
export function WeatherCard({ days, risks }: { days: Day[] | null; risks: Risk[] }) {
  if (!days) return <Card className="p-5 text-sm text-muted"><CloudRain className="mb-2 size-5" />Weather forecast is unavailable right now.</Card>;
  const max = Math.max(HEAVY_MM, ...days.map((d) => d.rain));
  return (
    <Card>
      <CardHead title="Rain outlook" sub={`Last 7 days recorded · next 7 forecast · heavy ≥ ${HEAVY_MM} mm`} />
      <div className="flex items-end gap-1.5 px-5 pb-1" style={{ height: 96 }} role="img" aria-label={days.map((d) => `${d.date}: ${Math.round(d.rain)} mm`).join(", ")}>
        {days.map((d) => <div key={d.date} title={`${fmtShort(new Date(d.date + "T00:00:00+05:30"))}: ${Math.round(d.rain)} mm${d.prob != null && !d.past ? ` (${d.prob}% chance)` : ""}`} className="flex flex-1 flex-col items-center justify-end"><div className={`w-full rounded-t ${isWet(d) ? "bg-laterite" : d.past ? "bg-teal/60" : "bg-mist"}`} style={{ height: `${Math.max(3, (d.rain / max) * 72)}px` }} /></div>)}
      </div>
      <div className="flex gap-1.5 px-5 pb-3 text-[9px] text-muted">{days.map((d) => <span key={d.date} className="flex-1 text-center">{d.date.slice(8)}</span>)}</div>
      {risks.length > 0 && <div className="border-t border-line bg-amber-50/60 px-5 py-3"><p className="mb-1 text-xs font-semibold text-amber-900">Weather-sensitive work at risk</p><ul className="space-y-0.5 text-sm">{risks.map((r) => <li key={r.task.id}>{r.task.title} <span className="text-xs text-muted">· rain expected {r.days.slice(0, 2).map((d) => fmtShort(new Date(d + "T00:00:00+05:30"))).join(", ")}</span></li>)}</ul></div>}
    </Card>
  );
}

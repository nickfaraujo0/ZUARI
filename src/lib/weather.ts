import "server-only";

export type Day = { date: string; rain: number; prob: number | null; past: boolean };
export const HEAVY_MM = 15;
const IST = 5.5 * 3600e3;

/** 14-day rainfall (7 recorded + 7 forecast) from Open-Meteo, cached for 3 hours. Returns null if the service is unreachable. */
export async function forecast(lat: number, lng: number): Promise<Day[] | null> {
  const base = process.env.WEATHER_API_BASE ?? "https://api.open-meteo.com";
  try {
    const r = await fetch(`${base}/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,precipitation_probability_max&past_days=7&forecast_days=7&timezone=Asia%2FKolkata`, { next: { revalidate: 10800 }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { daily?: { time: string[]; precipitation_sum: (number | null)[]; precipitation_probability_max?: (number | null)[] } };
    if (!j.daily?.time) return null;
    const today = new Date(Date.now() + IST).toISOString().slice(0, 10);
    return j.daily.time.map((t, i) => ({ date: t, rain: j.daily!.precipitation_sum[i] ?? 0, prob: j.daily!.precipitation_probability_max?.[i] ?? null, past: t < today }));
  } catch { return null; }
}
export const isWet = (d: Day) => d.rain >= HEAVY_MM || (!d.past && (d.prob ?? 0) >= 70 && d.rain >= 5);

type T = { id: string; title: string; startDate: Date | null; dueDate: Date | null; weatherSensitive: boolean; status: string };
/** Weather-sensitive, unfinished tasks whose working window overlaps a wet forecast day. */
export function tasksAtRisk<X extends T>(tasks: X[], days: Day[]) {
  const wet = days.filter((d) => !d.past && isWet(d)).map((d) => d.date);
  if (!wet.length) return [];
  const iso = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
  const horizon = days[days.length - 1].date;
  return tasks.filter((t) => t.weatherSensitive && t.status !== "COMPLETED" && t.status !== "VERIFIED").map((t) => {
    const from = t.startDate ? iso(t.startDate) : "0000", to = t.dueDate ? iso(t.dueDate) : horizon;
    return { task: t, days: wet.filter((w) => w >= from && w <= to) };
  }).filter((x) => x.days.length);
}

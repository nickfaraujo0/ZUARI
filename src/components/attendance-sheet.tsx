import { markAttendance } from "@/actions/workforce";
import { ActionForm } from "./forms";
import { cn } from "@/lib/utils";
import { tFor } from "@/lib/i18n";

type W = { id: string; name: string; trade: string; contractor?: { name: string } | null };
const OPTS = [["PRESENT", "Present"], ["HALF", "Half"], ["ABSENT", "Absent"], ["", "—"]] as const;

/** Tap-to-mark attendance sheet, shared by the desktop Workforce page and ZUARI Site. */
export function AttendanceSheet({ projectId, date, workers, existing, mobile, loc = "en" }: { loc?: string; projectId: string; date: string; workers: W[]; existing: Record<string, { status: string; ot: number }>; mobile?: boolean }) {
  const tr = tFor(loc);
  return (
    <ActionForm action={markAttendance} submit={tr("Save attendance")} size={mobile ? "lg" : "md"} submitClass={mobile ? "w-full" : ""}>
      <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="date" value={date} />
      <ul className="divide-y divide-line/70 rounded-xl border border-line bg-white">
        {workers.map((w) => {
          const cur = existing[w.id]?.status ?? "";
          return (
            <li key={w.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4", mobile ? "py-3.5" : "py-2.5")}>
              <div className="min-w-0 flex-1 basis-40"><p className="text-sm font-medium">{w.name}</p><p className="text-xs text-muted">{w.trade}{w.contractor ? ` · ${w.contractor.name}` : ""}</p></div>
              <div className="flex gap-1.5" role="radiogroup" aria-label={`Attendance for ${w.name}`}>
                {OPTS.map(([v, l]) => (
                  <label key={v}><input type="radio" name={`s_${w.id}`} value={v} defaultChecked={cur === v} className="peer sr-only" />
                    <span className={cn("block cursor-pointer rounded-lg text-center ring-1 ring-inset ring-line peer-checked:bg-river peer-checked:text-ivory peer-checked:ring-river peer-focus-visible:ring-2 peer-focus-visible:ring-river", mobile ? "px-3.5 py-2.5 text-sm" : "px-2.5 py-1.5 text-xs")}>{tr(l)}</span></label>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-muted">OT h<input type="number" name={`o_${w.id}`} min={0} max={16} step={0.5} defaultValue={existing[w.id]?.ot || ""} className="h-8 w-14 rounded-lg border border-line bg-white px-2 text-sm" /></label>
            </li>
          );
        })}
      </ul>
    </ActionForm>
  );
}

import Link from "next/link";
import { reinspect, saveInspection } from "@/actions/inspections";
import { ActionForm } from "./forms";
import { Chip, Photo, inputCls } from "./ui";
import { cn, fmtDate, fmtTime, type Tone } from "@/lib/utils";

const ITEM_OPTS = [["PASS", "Pass"], ["FAIL", "Fail"], ["NA", "N/A"]] as const;
export const INSPECTION_TONE: Record<string, Tone> = { OPEN: "amber", PASSED: "green", FAILED: "red" };
const RESULT_CLS: Record<string, string> = { PASS: "peer-checked:bg-emerald-700 peer-checked:ring-emerald-700", FAIL: "peer-checked:bg-red-700 peer-checked:ring-red-700", NA: "peer-checked:bg-stone-500 peer-checked:ring-stone-500" };

type Item = { id: string; text: string; result: string; note: string | null; issues: { id: string; status: string }[] };
export type InspectionView = {
  id: string; title: string; status: string; note: string | null; block: string | null; floor: string | null; locationArea: string | null; createdAt: Date; completedAt: Date | null;
  project: { name: string }; inspector: { name: string }; task: { title: string } | null; parentId: string | null; items: Item[]; photos: { id: string }[]; children: { id: string; status: string }[];
};

/** Checklist sheet: tap Pass / Fail / N/A per item; a fail needs a note and becomes a snag when finished. */
export function InspectionDetail({ ins, mobile, canAct, base }: { ins: InspectionView; mobile?: boolean; canAct: boolean; base: string }) {
  const open = ins.status === "OPEN" && canAct;
  const where = [ins.block, ins.floor, ins.locationArea].filter(Boolean).join(" · ");
  const passed = ins.items.filter((i) => i.result === "PASS").length, failed = ins.items.filter((i) => i.result === "FAIL").length;
  return (
    <div className="space-y-5">
      <div className={cn("rounded-xl border border-line bg-white p-5 shadow-card", mobile && "rounded-2xl")}>
        <div className="flex flex-wrap items-center gap-2"><Chip tone={INSPECTION_TONE[ins.status]} dot>{ins.status === "OPEN" ? "In progress" : ins.status === "PASSED" ? "Passed" : "Failed"}</Chip>{ins.parentId && <Chip tone="sand">Re-inspection</Chip>}</div>
        <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-river-deep">{ins.title}</h2>
        <p className="mt-1 text-sm text-muted">{[ins.project.name, where, ins.task && `Task: ${ins.task.title}`].filter(Boolean).join(" · ")}</p>
        <p className="mt-1 text-xs text-muted">{ins.inspector.name} · started {fmtDate(ins.createdAt)}, {fmtTime(ins.createdAt)}{ins.completedAt ? ` · completed ${fmtDate(ins.completedAt)}` : ""}{!open ? ` · ${passed} passed, ${failed} failed` : ""}</p>
      </div>

      <ActionForm action={saveInspection} hideSubmit className="space-y-4">
        <input type="hidden" name="inspectionId" value={ins.id} />
        <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line bg-white">
          {ins.items.map((i, n) => (
            <li key={i.id} className="space-y-2 px-4 py-3.5">
              <p className={cn("font-medium leading-snug", mobile ? "text-[15px]" : "text-sm")}><span className="mr-2 text-muted">{n + 1}.</span>{i.text}</p>
              {open ? (
                <>
                  <div className="flex gap-2" role="radiogroup" aria-label={i.text}>
                    {ITEM_OPTS.map(([v, l]) => <label key={v}><input type="radio" name={`r_${i.id}`} value={v} defaultChecked={i.result === v} className="peer sr-only" /><span className={cn("block cursor-pointer rounded-lg bg-white text-center font-medium ring-1 ring-inset ring-line peer-checked:text-white", RESULT_CLS[v], mobile ? "min-w-[4.5rem] px-4 py-3 text-sm" : "px-3.5 py-1.5 text-xs")}>{l}</span></label>)}
                  </div>
                  <input name={`n_${i.id}`} defaultValue={i.note ?? ""} placeholder="Note (required if it fails)" className={cn(inputCls, mobile && "!h-12 !text-base")} />
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2"><Chip tone={i.result === "PASS" ? "green" : i.result === "FAIL" ? "red" : "grey"}>{i.result === "NA" ? "N/A" : i.result[0] + i.result.slice(1).toLowerCase()}</Chip>{i.note && <span className="text-sm text-muted">{i.note}</span>}{i.issues.length > 0 && <Chip tone={i.issues.every((x) => ["RESOLVED", "CLOSED"].includes(x.status)) ? "green" : "amber"}>Snag {i.issues.every((x) => ["RESOLVED", "CLOSED"].includes(x.status)) ? "resolved" : "open"}</Chip>}</div>
              )}
            </li>
          ))}
        </ul>
        {ins.photos.length > 0 && <div className="flex flex-wrap gap-2">{ins.photos.map((p) => <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer"><Photo id={p.id} className="size-24 rounded-lg" /></a>)}</div>}
        {open && (
          <div className="space-y-3">
            <textarea name="note" rows={2} defaultValue={ins.note ?? ""} placeholder="Overall remarks (optional)" className={cn(inputCls, "h-auto py-2", mobile && "!text-base")} />
            <input type="file" name="photos" accept="image/*" capture="environment" multiple className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-stone-200 file:px-3 file:py-2.5 file:text-sm file:font-medium" />
            <div className="flex gap-3">
              <button name="intent" value="save" className={cn("flex-1 rounded-xl border border-line bg-white font-semibold", mobile ? "h-14 text-base" : "h-10 text-sm")}>Save progress</button>
              <button name="intent" value="finish" className={cn("flex-1 rounded-xl bg-river font-semibold text-ivory", mobile ? "h-14 text-base" : "h-10 text-sm")}>Finish inspection</button>
            </div>
          </div>
        )}
      </ActionForm>

      {ins.status === "FAILED" && canAct && (
        ins.children.some((c) => c.status === "OPEN")
          ? <Link href={`${base}/${ins.children.find((c) => c.status === "OPEN")!.id}`} className="block text-sm font-medium text-river underline">Open the re-inspection →</Link>
          : <ActionForm action={reinspect} submit="Start re-inspection" size={mobile ? "lg" : "md"} submitClass={mobile ? "w-full" : ""}><input type="hidden" name="inspectionId" value={ins.id} /></ActionForm>
      )}
    </div>
  );
}

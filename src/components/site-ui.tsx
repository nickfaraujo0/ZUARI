import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { Avatar, Chip, Progress } from "./ui";
import { cn, startOfToday, TASK_STATUS, TASK_TONE } from "@/lib/utils";
import { dueLabelT, tFor } from "@/lib/i18n";

export const SiteHeader = ({ title, back = "/site", right }: { title: string; back?: string; right?: React.ReactNode }) => (
  <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-ivory/95 px-3 backdrop-blur">
    <Link href={back} aria-label="Back" className="flex size-11 items-center justify-center rounded-full active:bg-white"><ArrowLeft className="size-5" /></Link>
    <h1 className="flex-1 text-base font-semibold">{title}</h1>{right}
  </header>
);
export const HomeBar = ({ name, unread }: { name: string; unread: number }) => (
  <div className="flex items-center justify-between px-5 pt-5">
    <span className="text-xs font-medium uppercase tracking-[0.3em] text-river">ZUARI Site</span>
    <div className="flex items-center gap-3">
      <Link href="/site/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative flex size-11 items-center justify-center rounded-full bg-white shadow-card"><Bell className="size-5" />{unread > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-laterite ring-2 ring-white" />}</Link>
      <Link href="/site/more" aria-label="Profile"><Avatar name={name} size={44} /></Link>
    </div>
  </div>
);

type T = { id: string; title: string; status: keyof typeof TASK_STATUS; progress: number; dueDate: Date | null; project?: { name: string } | null };
export function TaskCard({ t, showProject, loc = "en" }: { t: T; showProject?: boolean; loc?: string }) {
  const tr = tFor(loc);
  const late = t.dueDate && t.dueDate < startOfToday() && (t.status === "NOT_STARTED" || t.status === "IN_PROGRESS");
  return (
    <Link href={`/site/tasks/${t.id}`} className="block rounded-2xl border border-line bg-white p-4 shadow-card active:scale-[.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[17px] font-semibold leading-snug">{t.title}</p>{showProject && t.project && <p className="mt-0.5 text-sm text-muted">{t.project.name}</p>}</div>
        <Chip tone={TASK_TONE[t.status]}>{tr(TASK_STATUS[t.status])}</Chip>
      </div>
      <div className="mt-3 flex items-center gap-3"><Progress value={t.progress} thin className="flex-1" /><span className="text-xs tabular-nums text-muted">{t.progress}%</span></div>
      <p className={cn("mt-2 text-sm", late ? "font-medium text-red-700" : "text-muted")}>{dueLabelT(tr, t.dueDate)}</p>
    </Link>
  );
}

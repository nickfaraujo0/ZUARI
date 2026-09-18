import Link from "next/link";
import { Bell } from "lucide-react";
import { markAllRead } from "@/actions/notifications";
import { EmptyState } from "./ui";
import { cn, relative } from "@/lib/utils";

type N = { id: string; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date };
export function NotificationList({ items, mobile }: { items: N[]; mobile?: boolean }) {
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div>
      {unread > 0 && <form action={markAllRead} className="mb-3 text-right"><button className="text-xs font-medium text-river hover:underline">Mark all as read ({unread})</button></form>}
      {items.length === 0 ? <EmptyState icon={<Bell className="size-5" />} title="You're all caught up" body="New tasks, issues and progress updates will appear here." /> : (
        <ul className={cn("divide-y divide-line/70 overflow-hidden rounded-xl border border-line bg-white", mobile && "text-[15px]")}>
          {items.map((n) => {
            const inner = (<><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-laterite")} /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n.title}</span>{n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}</span><span className="text-[11px] text-muted">{relative(n.createdAt)}</span></>);
            return <li key={n.id}>{n.href ? <Link href={n.href} className="flex gap-3 px-4 py-3.5 hover:bg-stone-50">{inner}</Link> : <div className="flex gap-3 px-4 py-3.5">{inner}</div>}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

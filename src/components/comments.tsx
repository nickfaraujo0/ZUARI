import { addComment } from "@/actions/tasks";
import { ActionForm } from "./forms";
import { Avatar, inputCls } from "./ui";
import { fmtDate, fmtTime } from "@/lib/utils";

type C = { id: string; body: string; createdAt: Date; user: { name: string } };
export function TaskComments({ taskId, comments, mobile }: { taskId: string; comments: C[]; mobile?: boolean }) {
  return (
    <div>
      <h3 className={mobile ? "mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted" : "mb-3 text-[15px] font-semibold"}>Discussion</h3>
      <ul className="mb-4 space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.user.name} size={mobile ? 34 : 30} />
            <div className="min-w-0 flex-1 rounded-xl bg-stone-100/70 px-3.5 py-2.5"><p className="text-xs text-muted"><span className="font-medium text-charcoal">{c.user.name}</span> · {fmtDate(c.createdAt)}, {fmtTime(c.createdAt)}</p><p className="mt-0.5 whitespace-pre-line text-sm">{c.body}</p></div>
          </li>
        ))}
        {!comments.length && <li className="text-sm text-muted">No comments yet.</li>}
      </ul>
      <ActionForm action={addComment} reset submit="Post comment" variant="secondary" size={mobile ? "lg" : "sm"} submitClass={mobile ? "w-full" : ""}>
        <input type="hidden" name="taskId" value={taskId} />
        <textarea name="body" rows={2} required placeholder="Add a comment for the team…" className={`${inputCls} h-auto py-2 ${mobile ? "!text-base" : ""}`} />
      </ActionForm>
    </div>
  );
}

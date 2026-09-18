import Link from "next/link";
import { createTask, quickTask, updateTask, deleteTask } from "@/actions/tasks";
import { ActionForm, AutoSelect, ConfirmSubmit } from "./forms";
import { Avatar, EmptyState, Field, inputCls, Progress, Select } from "./ui";
import { dueLabel, opts, PRIORITY, ROLE_LABEL, startOfToday, TASK_STATUS, toInputDate } from "@/lib/utils";
import { ListChecks } from "lucide-react";

type Person = { id: string; name: string; role: keyof typeof ROLE_LABEL };
type TaskRow = {
  id: string; title: string; status: keyof typeof TASK_STATUS; priority: keyof typeof PRIORITY; progress: number; dueDate: Date | null; projectId: string;
  assignee: { name: string } | null; phase: { name: string } | null; project?: { name: string };
};

export function TasksTable({ tasks, showProject }: { tasks: TaskRow[]; showProject?: boolean }) {
  if (!tasks.length) return <EmptyState icon={<ListChecks className="size-5" />} title="No tasks match" body="Create a task and assign it to a supervisor — it appears on their phone immediately." />;
  const today = startOfToday();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted">
          <th className="px-5 py-2.5 font-medium">Task</th><th className="px-3 font-medium">Assignee</th><th className="px-3 font-medium">Priority</th><th className="px-3 font-medium">Due</th><th className="px-3 font-medium">Status</th><th className="px-3 font-medium">Progress</th><th className="px-3" />
        </tr></thead>
        <tbody>
          {tasks.map((t) => {
            const late = t.dueDate && t.dueDate < today && (t.status === "NOT_STARTED" || t.status === "IN_PROGRESS");
            return (
              <tr key={t.id} className="border-b border-line/70 last:border-0 hover:bg-stone-50/50">
                <td className="px-5 py-2.5"><Link href={`/projects/${t.projectId}/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link><span className="block text-xs text-muted">{[showProject && t.project?.name, t.phase?.name].filter(Boolean).join(" · ") || "No phase"}</span></td>
                <td className="px-3"><span className="flex items-center gap-2">{t.assignee ? <><Avatar name={t.assignee.name} size={24} />{t.assignee.name}</> : <span className="text-muted">Unassigned</span>}</span></td>
                <td className="px-3"><ActionForm action={quickTask} hideSubmit><input type="hidden" name="taskId" value={t.id} /><AutoSelect name="priority" defaultValue={t.priority} options={opts(PRIORITY)} /></ActionForm></td>
                <td className={`px-3 text-[13px] ${late ? "font-medium text-red-700" : ""}`}>{dueLabel(t.dueDate)}</td>
                <td className="px-3"><ActionForm action={quickTask} hideSubmit><input type="hidden" name="taskId" value={t.id} /><AutoSelect name="status" defaultValue={t.status} options={opts(TASK_STATUS)} /></ActionForm></td>
                <td className="px-3"><div className="flex w-28 items-center gap-2"><Progress value={t.progress} thin /><span className="text-xs tabular-nums">{t.progress}%</span></div></td>
                <td className="px-3 text-right"><Link href={`/projects/${t.projectId}/tasks/${t.id}`} className="text-xs font-medium text-river hover:underline">Edit</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TaskForm({ projectId, phases, people, task }: {
  projectId: string; phases: { id: string; name: string }[]; people: Person[];
  task?: { id: string; title: string; description: string | null; phaseId: string | null; assigneeId: string | null; priority: string; status: string; progress: number; startDate: Date | null; dueDate: Date | null };
}) {
  return (
    <ActionForm action={task ? updateTask : createTask} reset={!task} submit={task ? "Save changes" : "Create task"} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {task ? <input type="hidden" name="taskId" value={task.id} /> : <input type="hidden" name="projectId" value={projectId} />}
      <Field label="Title" className="sm:col-span-2 lg:col-span-3"><input name="title" required defaultValue={task?.title} className={inputCls} placeholder="Electrical conduit installation — Floor 2" /></Field>
      <Field label="Phase"><Select name="phaseId" placeholder="No phase" defaultValue={task?.phaseId} options={phases.map((p) => ({ value: p.id, label: p.name }))} /></Field>
      <Field label="Assign to"><Select name="assigneeId" placeholder="Unassigned" defaultValue={task?.assigneeId} options={people.map((p) => ({ value: p.id, label: `${p.name} · ${ROLE_LABEL[p.role]}` }))} /></Field>
      <Field label="Priority"><Select name="priority" defaultValue={task?.priority ?? "MEDIUM"} options={opts(PRIORITY)} /></Field>
      <Field label="Start date"><input type="date" name="startDate" defaultValue={toInputDate(task?.startDate)} className={inputCls} /></Field>
      <Field label="Due date"><input type="date" name="dueDate" defaultValue={toInputDate(task?.dueDate)} className={inputCls} /></Field>
      {task && (<>
        <Field label="Status"><Select name="status" defaultValue={task.status} options={opts(TASK_STATUS)} /></Field>
        <Field label="Progress (%)" hint="Used while In Progress; Completed is 100%"><input type="number" name="progress" min={0} max={100} defaultValue={task.progress} className={inputCls} /></Field>
      </>)}
      <Field label="Description" className="sm:col-span-2 lg:col-span-3"><textarea name="description" rows={3} defaultValue={task?.description ?? ""} className={`${inputCls} h-auto py-2`} /></Field>
    </ActionForm>
  );
}

export function DeleteTask({ taskId }: { taskId: string }) {
  return <ActionForm action={deleteTask} hideSubmit><input type="hidden" name="taskId" value={taskId} /><ConfirmSubmit message="Delete this task? This can't be undone." className="text-sm text-red-700 hover:underline">Delete task</ConfirmSubmit></ActionForm>;
}

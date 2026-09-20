import { createShare, revokeShare } from "@/actions/share";
import { ActionForm, ConfirmSubmit } from "./forms";
import { Card, Field, inputCls } from "./ui";
import { fmtDate } from "@/lib/utils";

type S = { id: string; label: string | null; createdAt: Date; expiresAt: Date | null };
export function SharePanel({ projectId, shares }: { projectId: string; shares: S[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">Client portal</h2>
      <p className="mb-3 mt-0.5 text-xs text-muted">A read-only page with progress, stages and the photos you mark <b>Share</b> in the gallery. No login needed.</p>
      <ul className="mb-3 space-y-1.5">{shares.map((s) => <li key={s.id} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{s.label || "Client link"}<span className="block text-xs text-muted">created {fmtDate(s.createdAt)}{s.expiresAt ? ` · expires ${fmtDate(s.expiresAt)}` : ""}</span></span><ActionForm action={revokeShare} hideSubmit><input type="hidden" name="id" value={s.id} /><ConfirmSubmit message="Revoke this link? The client will lose access immediately." className="text-xs text-red-700 hover:underline">Revoke</ConfirmSubmit></ActionForm></li>)}</ul>
      <ActionForm action={createShare} reset submit="Create link" size="sm" variant="secondary" className="grid gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="grid grid-cols-2 gap-2"><Field label="Label"><input name="label" className={`${inputCls} h-9`} placeholder="Mr Kamat" /></Field><Field label="Expires in (days)"><input name="days" type="number" min={1} max={365} className={`${inputCls} h-9`} placeholder="never" /></Field></div>
      </ActionForm>
    </Card>
  );
}

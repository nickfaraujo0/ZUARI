import { resetPassword, setUserActive } from "@/actions/users";
import { ActionForm, ConfirmSubmit } from "./forms";

export function UserAdmin({ id, name, active, canDeactivate, canReset }: { id: string; name: string; active: boolean; canDeactivate: boolean; canReset: boolean }) {
  return (
    <details className="group text-right">
      <summary className="cursor-pointer list-none text-xs font-medium text-river hover:underline">Manage</summary>
      <div className="mt-2 space-y-2 rounded-lg border border-line bg-stone-50 p-3 text-left">
        {canReset && active && <ActionForm action={resetPassword} submit="Reset password" variant="secondary" size="sm" submitClass="!mt-0"><input type="hidden" name="userId" value={id} /></ActionForm>}
        {canDeactivate && (
          <ActionForm action={setUserActive} hideSubmit>
            <input type="hidden" name="userId" value={id} /><input type="hidden" name="active" value={active ? "false" : "true"} />
            <ConfirmSubmit message={active ? `Deactivate ${name}? They will be signed out and unable to sign in.` : `Reactivate ${name}?`} className={`text-xs hover:underline ${active ? "text-red-700" : "text-river"}`}>{active ? "Deactivate account" : "Reactivate account"}</ConfirmSubmit>
          </ActionForm>
        )}
      </div>
    </details>
  );
}

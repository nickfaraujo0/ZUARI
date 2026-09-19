import { changePassword, updateProfile } from "@/actions/profile";
import { ActionForm } from "./forms";
import { Card, Field, inputCls } from "./ui";
import { ROLE_LABEL } from "@/lib/utils";

export function ProfileForms({ user, mobile }: { user: { name: string; email: string; title: string | null; phone: string | null; role: keyof typeof ROLE_LABEL }; mobile?: boolean }) {
  const cls = mobile ? `${inputCls} !h-12 !text-base` : inputCls;
  const btn = mobile ? "w-full" : "";
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-1 text-[15px] font-semibold">Profile</h2>
        <p className="mb-4 text-xs text-muted">{user.email} · {ROLE_LABEL[user.role]}</p>
        <ActionForm action={updateProfile} submit="Save profile" size={mobile ? "lg" : "md"} submitClass={btn} className="space-y-3">
          <Field label="Full name"><input name="name" required defaultValue={user.name} className={cls} /></Field>
          <Field label="Job title"><input name="title" defaultValue={user.title ?? ""} className={cls} /></Field>
          <Field label="Phone"><input name="phone" defaultValue={user.phone ?? ""} inputMode="tel" className={cls} /></Field>
        </ActionForm>
      </Card>
      <Card className="p-5">
        <h2 className="mb-1 text-[15px] font-semibold">Change password</h2>
        <p className="mb-4 text-xs text-muted">Changing it signs you out on all other devices.</p>
        <ActionForm action={changePassword} reset submit="Change password" variant="secondary" size={mobile ? "lg" : "md"} submitClass={btn} className="space-y-3">
          <Field label="Current password"><input name="current" type="password" autoComplete="current-password" required className={cls} /></Field>
          <Field label="New password" hint="At least 8 characters"><input name="next" type="password" autoComplete="new-password" minLength={8} required className={cls} /></Field>
          <Field label="Confirm new password"><input name="confirm" type="password" autoComplete="new-password" required className={cls} /></Field>
        </ActionForm>
      </Card>
    </div>
  );
}

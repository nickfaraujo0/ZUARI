import { changePassword, updatePreferences, updateProfile } from "@/actions/profile";
import { PushToggle } from "./push-toggle";
import { ActionForm } from "./forms";
import { Card, Field, inputCls } from "./ui";
import { ROLE_LABEL } from "@/lib/utils";

export function ProfileForms({ user, mobile, vapidKey = null }: { user: { name: string; email: string; title: string | null; phone: string | null; role: keyof typeof ROLE_LABEL; digest?: string; locale?: string; waOptIn?: boolean }; mobile?: boolean; vapidKey?: string | null }) {
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
        <h2 className="mb-1 text-[15px] font-semibold">Notifications &amp; language</h2>
        <p className="mb-4 text-xs text-muted">Choose how ZUARI reaches you and which language the site app uses.</p>
        <div className="mb-4"><PushToggle vapidKey={vapidKey} mobile={mobile} /></div>
        <ActionForm action={updatePreferences} submit="Save preferences" variant="secondary" size={mobile ? "lg" : "md"} submitClass={btn} className="space-y-3">
          <Field label="Email digest of unread notifications"><select name="digest" defaultValue={user.digest ?? "NONE"} className={cls}><option value="NONE">Off</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option></select></Field>
          <Field label="Site app language"><select name="locale" defaultValue={user.locale ?? "en"} className={cls}><option value="en">English</option><option value="hi">हिन्दी (Hindi)</option><option value="mr">मराठी (Marathi)</option><option value="kok">कोंकणी (Konkani)</option></select></Field>
          <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" name="waOptIn" defaultChecked={user.waOptIn} className="mt-0.5 size-4 accent-[#123C36]" /><span>Send urgent alerts to my WhatsApp <span className="block text-xs text-muted">Uses the phone number in your profile. You can also send site updates to ZUARI on WhatsApp.</span></span></label>
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

import Link from "next/link";
import { ActionForm } from "@/components/forms";
import { Field, inputCls } from "@/components/ui";
import { signup } from "@/actions/auth";

export const metadata = { title: "Create your workspace" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-serif text-4xl font-semibold text-river-deep">Start building.</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Create your company workspace. You&apos;ll be its first Director.</p>
      <ActionForm action={signup} submit="Create workspace" submitClass="w-full" size="lg" className="space-y-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Company</p>
        <Field label="Company name"><input name="companyName" required className={inputCls} placeholder="Coastal India Constructions" /></Field>
        <p className="pt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Your profile</p>
        <Field label="Full name"><input name="name" autoComplete="name" required className={inputCls} /></Field>
        <Field label="Work email"><input name="email" type="email" autoComplete="email" required className={inputCls} /></Field>
        <Field label="Password" hint="At least 8 characters"><input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputCls} /></Field>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">Already have an account? <Link href="/login" className="font-medium text-river underline underline-offset-4">Sign in</Link></p>
    </>
  );
}

import Link from "next/link";
import { ActionForm } from "@/components/forms";
import { Field, inputCls } from "@/components/ui";
import { requestPasswordReset } from "@/actions/auth";

export const metadata = { title: "Forgot password" };

export default function ForgotPassword() {
  return (
    <>
      <h1 className="font-serif text-4xl font-semibold text-river-deep">Reset your password.</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Enter your work email and we&apos;ll send you a reset link.</p>
      <ActionForm action={requestPasswordReset} submit="Send reset link" submitClass="w-full" size="lg" className="space-y-4">
        <Field label="Email"><input name="email" type="email" autoComplete="email" required autoFocus className={inputCls} placeholder="name@company.com" /></Field>
      </ActionForm>
      <p className="mt-6 text-sm text-muted"><Link href="/login" className="font-medium text-river underline underline-offset-4">Back to sign in</Link></p>
      <p className="mt-2 text-xs text-muted">No email arriving? Ask your project manager or director to issue a temporary password.</p>
    </>
  );
}

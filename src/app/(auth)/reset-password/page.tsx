import Link from "next/link";
import { ActionForm } from "@/components/forms";
import { Field, inputCls } from "@/components/ui";
import { completePasswordReset } from "@/actions/auth";

export const metadata = { title: "Choose a new password" };

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token;
  if (!token) return <><h1 className="font-serif text-4xl font-semibold text-river-deep">Link not valid.</h1><p className="mt-3 text-sm text-muted">This reset link is missing its token. <Link href="/forgot-password" className="font-medium text-river underline underline-offset-4">Request a new one</Link>.</p></>;
  return (
    <>
      <h1 className="font-serif text-4xl font-semibold text-river-deep">Choose a new password.</h1>
      <p className="mt-1 mb-8 text-sm text-muted">You&apos;ll be signed out everywhere else.</p>
      <ActionForm action={completePasswordReset} submit="Set new password" submitClass="w-full" size="lg" className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="New password" hint="At least 8 characters"><input name="next" type="password" autoComplete="new-password" minLength={8} required autoFocus className={inputCls} /></Field>
        <Field label="Confirm new password"><input name="confirm" type="password" autoComplete="new-password" required className={inputCls} /></Field>
      </ActionForm>
    </>
  );
}

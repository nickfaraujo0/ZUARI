import Link from "next/link";
import { ActionForm } from "@/components/forms";
import { Field, inputCls } from "@/components/ui";
import { login } from "@/actions/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const reset = (await searchParams).reset === "1";
  return (
    <>
      <h1 className="font-serif text-4xl font-semibold text-river-deep">Welcome back.</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Sign in to continue building progress together.</p>
      {reset && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Password updated. Sign in with your new password.</p>}
      <ActionForm action={login} submit="Sign in" submitClass="w-full" size="lg" className="space-y-4">
        <Field label="Email"><input name="email" type="email" autoComplete="email" required autoFocus className={inputCls} placeholder="name@company.com" /></Field>
        <Field label="Password"><input name="password" type="password" autoComplete="current-password" required className={inputCls} placeholder="••••••••" /></Field>
        <p className="text-right text-xs"><Link href="/forgot-password" className="text-river underline underline-offset-4">Forgot password?</Link></p>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">New to ZUARI? <Link href="/signup" className="font-medium text-river underline underline-offset-4">Create a company workspace</Link></p>
      <p className="mt-2 text-xs text-muted">Site team member? Ask your project manager for your sign-in details.</p>
    </>
  );
}

"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { btn, inputCls } from "./ui";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action";

export function Submit({ children, className, variant = "primary", size = "md", pending: pendingProp }: {
  pending?: boolean; children: React.ReactNode; className?: string; variant?: "primary" | "secondary" | "danger" | "ghost" | "sand"; size?: "sm" | "md" | "lg" }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending} className={cn(btn(variant, size), className)}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

type Act = (prev: ActionState, fd: FormData) => Promise<ActionState>;
export function ActionForm({ action, children, submit, className, reset, hideSubmit, submitClass, variant, size }: {
  action: Act; children: React.ReactNode; submit?: string; className?: string; reset?: boolean; hideSubmit?: boolean; submitClass?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "sand"; size?: "sm" | "md" | "lg";
}) {
  const [state, run, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && reset) ref.current?.reset(); }, [state, reset]);
  return (
    // Submitted via onSubmit (not the form `action` prop) so React 19 does not wipe the fields when the action returns an error.
    <form ref={ref} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => { run(fd); }); }} className={className}>
      {children}
      {state?.error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      {state?.ok && state.message && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.message}</p>}
      {!hideSubmit && <Submit pending={pending} className={cn("mt-4", submitClass)} variant={variant} size={size}>{submit ?? "Save"}</Submit>}
    </form>
  );
}

/** A <select> that submits its parent form as soon as it changes (inline status/priority editing). */
export function AutoSelect({ name, options, defaultValue, className }: { name: string; options: { value: string; label: string }[]; defaultValue: string; className?: string }) {
  return (
    <select name={name} defaultValue={defaultValue} aria-label={name} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={cn(inputCls, "h-8 w-auto pr-7 text-[13px]", className)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function ConfirmSubmit({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }} className={className}>{children}</button>;
}

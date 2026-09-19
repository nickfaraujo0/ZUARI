"use client";
import { logout } from "@/actions/auth";

/** Sign-out that also wipes this phone's cached pages so the next person can't see them offline. */
export function SignOut({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <form action={logout} onSubmit={() => { try { if (typeof caches !== "undefined") void caches.delete("zuari-pages-v1"); try { localStorage.removeItem("zuari:warm"); } catch {} } catch {} }}>
      <button className={className}>{children}</button>
    </form>
  );
}

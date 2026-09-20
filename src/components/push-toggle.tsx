"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { removePushSubscription, savePushSubscription } from "@/actions/push";

const b64 = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };

/** Turns web-push notifications on or off for this device. */
export function PushToggle({ vapidKey, mobile }: { vapidKey: string | null; mobile?: boolean }) {
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "off" | "on">("loading");
  const [err, setErr] = useState("");
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      setState((await reg?.pushManager.getSubscription()) ? "on" : "off");
    }, 0);
    return () => clearTimeout(t);
  }, [vapidKey]);
  async function enable() {
    setErr("");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapidKey!) });
      const r = await savePushSubscription(sub.toJSON());
      if (!r.ok) { await sub.unsubscribe(); return setErr(r.error ?? "Could not save."); }
      setState("on");
    } catch { setErr("Could not turn on notifications on this device."); }
  }
  async function disable() {
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
    setState("off");
  }
  const btn = `inline-flex items-center gap-2 rounded-lg font-medium ${mobile ? "h-12 px-5 text-base" : "h-10 px-4 text-sm"}`;
  return (
    <div>
      {state === "unsupported" && <p className="text-sm text-muted">Push notifications aren&apos;t available in this browser{vapidKey ? "" : " (not configured on the server)"}.</p>}
      {state === "denied" && <p className="text-sm text-amber-800">Notifications are blocked. Allow them in your browser&apos;s site settings, then reload.</p>}
      {state === "off" && <button onClick={enable} className={`${btn} bg-river text-ivory`}><Bell className="size-4" />Turn on notifications</button>}
      {state === "on" && <div className="flex items-center gap-3"><span className="text-sm text-emerald-800">Notifications are on for this device.</span><button onClick={disable} className={`${btn} border border-line bg-white`}><BellOff className="size-4" />Turn off</button></div>}
      {err && <p role="alert" className="mt-2 text-sm text-red-800">{err}</p>}
    </div>
  );
}

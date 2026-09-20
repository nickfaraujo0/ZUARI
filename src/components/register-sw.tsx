"use client";
import { useEffect } from "react";

const WARM = ["/site", "/site/tasks", "/site/progress", "/site/more", "/site/notifications", "/site/add-progress", "/site/report-issue", "/site/site-update", "/site/attendance", "/site/materials", "/site/drawings"];

/** Registers the ZUARI Site service worker (production only) and pre-caches the core screens. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async () => {
      const reg = await navigator.serviceWorker.ready;
      let last = 0;
      try { last = Number(localStorage.getItem("zuari:warm") ?? 0); } catch {}
      if (navigator.onLine && Date.now() - last > 10 * 60_000) {
        reg.active?.postMessage({ type: "warm", urls: WARM });
        try { localStorage.setItem("zuari:warm", String(Date.now())); } catch {}
      }
    }).catch(() => {});
  }, []);
  return null;
}

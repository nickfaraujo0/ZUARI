/* ZUARI Site service worker: lets the mobile app open and capture with no signal.
   - Hashed static assets: cache-first.
   - /site pages: network-first, cached copy when offline.
   - Nothing outside /site is cached. Pages cache is wiped on sign-out. */
const STATIC = "zuari-static-v1";
const PAGES = "zuari-pages-v1";
const MAX_PAGES = 60;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== STATIC && k !== PAGES) await caches.delete(k);
  await self.clients.claim();
})()));

const isStatic = (u) => u.pathname.startsWith("/_next/static/") || u.pathname === "/manifest.webmanifest" || /^\/(icon|apple-icon)/.test(u.pathname);

async function putPage(url, res) {
  const c = await caches.open(PAGES);
  await c.put(url, res);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await c.delete(k);
}
const offlinePage = () => new Response(
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · ZUARI Site</title>' +
  '<body style="font-family:system-ui;background:#F5F2EA;color:#18201E;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center">' +
  '<div><h1 style="font-size:28px;color:#123C36;margin:0 0 8px">You are offline</h1><p style="margin:0 0 20px;color:#6B7572">This page has not been opened on this phone yet. Anything you already submitted is safe and uploads automatically when signal returns.</p>' +
  '<a href="/site" style="display:inline-block;background:#123C36;color:#F5F2EA;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:600">Try Home</a></div></body>',
  { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    e.respondWith((async () => {
      const c = await caches.open(STATIC);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
    return;
  }
  if (req.mode === "navigate" && url.pathname.startsWith("/site")) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) e.waitUntil(putPage(req.url, res.clone()));
        return res;
      } catch {
        const c = await caches.open(PAGES);
        return (await c.match(req.url, { ignoreVary: true })) || offlinePage();
      }
    })());
  }
});

/** Pre-cache the core capture screens (and the JS/CSS/fonts they need) right after sign-in. */
async function warm(urls) {
  const st = await caches.open(STATIC);
  for (const u of urls) {
    try {
      const abs = new URL(u, self.location.origin).href;
      const res = await fetch(abs, { credentials: "same-origin" });
      if (!res.ok || res.redirected) continue;
      const html = await res.clone().text();
      await putPage(abs, res);
      for (const a of new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) || [])) {
        if (await st.match(a)) continue;
        try {
          const ar = await fetch(a);
          if (!ar.ok) continue;
          await st.put(a, ar.clone());
          if (a.split("?")[0].endsWith(".css")) {
            const css = await ar.text();
            for (const m of new Set(css.match(/\/_next\/static\/media\/[^"')\s]+/g) || [])) {
              if (await st.match(m)) continue;
              const fr = await fetch(m);
              if (fr.ok) await st.put(m, fr);
            }
          }
        } catch { /* asset unavailable: skip */ }
      }
    } catch { /* offline or blocked: skip */ }
  }
}
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "warm") e.waitUntil(warm(e.data.urls || []));
  if (e.data && e.data.type === "clear") e.waitUntil(caches.delete(PAGES));
});

// ── Web push ─────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "ZUARI", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "ZUARI", { body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png", data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if ("focus" in c) { await c.focus(); if ("navigate" in c) { try { await c.navigate(url); } catch { /* cross-origin */ } } return; }
    await self.clients.openWindow(url);
  })());
});

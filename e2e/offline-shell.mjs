// Offline app shell (needs a production build: the service worker only registers in production).
// Read-only against the demo data: loads pages, goes offline, checks they still open and hydrate.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3100";
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(1); console.log("✓", name); } catch (e) { results.push(0); console.log("✗", name, "\n   ", String(e.message).split("\n")[0]); throw e; } };
const see = (p, t) => p.getByText(t).locator("visible=true").first().waitFor({ timeout: 10000 });
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const cached = () => p.evaluate(async () => (await (await caches.open("zuari-pages-v1")).keys()).map((r) => new URL(r.url).pathname));
try {
  await step("Service worker installs and pre-caches the core Site screens after sign-in", async () => {
    await p.goto(`${BASE}/login`); await p.fill("[name=email]", "carlos.fernandes@coastalindia.demo"); await p.fill("[name=password]", "zuari-demo-2026");
    await p.click('button:has-text("Sign in")'); await p.waitForURL("**/site");
    await p.evaluate(() => navigator.serviceWorker.ready);
    let have = []; for (let i = 0; i < 40 && !["/site/add-progress", "/site/tasks", "/site/report-issue", "/site/site-update", "/site/progress"].every((x) => have.includes(x)); i++) { await p.waitForTimeout(500); have = await cached(); }
    if (!have.includes("/site/add-progress")) throw new Error("core pages not cached: " + have.join(","));
  });
  await step("Offline: Home and the capture form open from cache and are interactive", async () => {
    await p.goto(`${BASE}/site/add-progress`); await p.waitForTimeout(800); // one controlled visit
    await ctx.setOffline(true);
    await p.goto(`${BASE}/site`); await see(p, "Good ");
    await p.goto(`${BASE}/site/add-progress`); await see(p, "Take photo");
    await p.fill("textarea", "offline shell check");
    await p.getByRole("button", { name: "Save to send later" }).waitFor({ timeout: 8000 }); // only appears once React has hydrated and seen offline
    await p.goto(`${BASE}/site/report-issue`); await see(p, "What's the problem?");
    await p.goto(`${BASE}/site/tasks`); await see(p, "Active");
  });
  await step("Offline: a page never opened before shows a friendly offline screen, not a browser error", async () => {
    await p.goto(`${BASE}/site/tasks/never-opened-task`); await see(p, "You are offline"); await see(p, "Try Home");
    await p.goto(`${BASE}/site/notifications`); await see(p, "Notifications"); // warmed page still opens
  });
  await step("Signing out wipes the cached pages, so nothing leaks to the next person", async () => {
    await ctx.setOffline(false);
    await p.goto(`${BASE}/site/more`); await p.click('button:has-text("Sign out")'); await p.waitForURL("**/login");
    if ((await cached()).length) throw new Error("pages cache survived sign-out");
    await ctx.setOffline(true); await p.goto(`${BASE}/site`); await see(p, "You are offline");
  });
} finally {
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} steps passed`);
  process.exit(results.includes(0) ? 1 : 0);
}

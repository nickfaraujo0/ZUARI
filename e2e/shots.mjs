import { chromium } from "playwright";
const [BASE, OUT] = [process.env.BASE ?? "http://localhost:3100", process.argv[2]];
const b = await chromium.launch({ channel: "chrome" });
async function login(ctx, email) { const p = await ctx.newPage(); await p.goto(`${BASE}/login`); await p.fill("[name=email]", email); await p.fill("[name=password]", "zuari-demo-2026"); await p.click('button:has-text("Sign in")'); await p.waitForURL(/dashboard|site/); return p; }
const d = await login(await b.newContext({ viewport: { width: 1360, height: 860 } }), "nick.araujo@coastalindia.demo");
await d.waitForTimeout(600); await d.screenshot({ path: `${OUT}/dashboard.png` });
await d.click('a:has-text("Dona Paula Villa") >> nth=0'); await d.waitForLoadState("networkidle"); await d.waitForTimeout(500); await d.screenshot({ path: `${OUT}/project.png` });
await d.goto(d.url().replace(/\/?$/, "/timeline")); await d.waitForTimeout(500); await d.screenshot({ path: `${OUT}/timeline.png`, clip: { x: 0, y: 0, width: 1360, height: 640 } });
const m = await login(await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), "carlos.fernandes@coastalindia.demo");
await m.waitForTimeout(700); await m.screenshot({ path: `${OUT}/mobile-home.png` });
await m.goto(`${BASE}/site/add-progress`); await m.waitForTimeout(600); await m.screenshot({ path: `${OUT}/mobile-capture.png` });
await b.close();

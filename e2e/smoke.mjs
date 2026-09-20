// Route sweep (read-only, demo data): every page loads for each role with no errors; forbidden pages are blocked.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3100", SHOTS = process.argv[2];
const PW = "zuari-demo-2026";
const browser = await chromium.launch({ channel: "chrome" });
let bad = 0, total = 0;
async function session(email, mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1360, height: 860 } });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error" && !/tile\.openstreetmap|ERR_INTERNET|net::ERR/.test(m.text() + (m.location().url ?? ""))) errs.push(m.text().slice(0, 140)); });
  await p.goto(`${BASE}/login`); await p.fill("[name=email]", email); await p.fill("[name=password]", PW); await p.click('button:has-text("Sign in")'); await p.waitForURL(/dashboard|site/);
  return { p, errs };
}
async function visit({ p, errs }, path, { expect = 200, shot, text } = {}) {
  total++; errs.length = 0;
  let r; try { r = await p.goto(BASE + path, { waitUntil: "load", timeout: 60000 }); await p.waitForTimeout(500); } catch (e) { bad++; return void console.log("✗", path, "→ page did not load:", String(e.message).split("\n")[0]); } const url = new URL(p.url()).pathname;
  const body = await p.locator("body").innerText();
  let why = "";
  if (expect === "redirect" ? url === path : r.status() !== expect) why = `status ${r.status()} at ${url}`;
  else if (/Application error|Something went wrong|Unhandled Runtime Error/.test(body)) why = "error text on page";
  else if (text && !body.toLowerCase().includes(text.toLowerCase())) why = `missing "${text}"`;
  else if (errs.length && expect !== 404) why = "console: " + errs[0];
  if (shot) await p.screenshot({ path: `${SHOTS}/${shot}.png`, ...(shot.startsWith("m-") ? {} : { clip: { x: 0, y: 0, width: 1360, height: 860 } }) });
  if (why) { bad++; console.log("✗", path, "→", why); }
}
const dir = await session("nick.araujo@coastalindia.demo");
await dir.p.goto(`${BASE}/projects`); const dona = (await dir.p.locator('a:has-text("Dona Paula Villa")').first().getAttribute("href"));
await dir.p.goto(`${BASE}${dona}/tasks`); const taskHref = await dir.p.locator('a:has-text("Edit")').first().getAttribute("href");
for (const [path, o] of [["/dashboard", {}], ["/projects", {}], ["/projects/new", {}], ["/tasks", {}], ["/tasks?status=open", {}], ["/issues", {}], ["/issues?show=all", {}], ["/photos", {}], ["/team", {}], ["/notifications", {}], ["/profile", {}], ["/search?q=villa", { text: "Dona Paula Villa" }],
  [dona, {}], [`${dona}/timeline`, { shot: "timeline" }], [`${dona}/tasks`, {}], [taskHref, {}], [`${dona}/site`, {}], [`${dona}/photos`, {}], [`${dona}/photos?view=journal`, { shot: "journal" }], [`${dona}/issues?show=all`, {}], [`${dona}/team`, {}], [`${dona}/edit`, {}]])
  await visit(dir, path, o);
await dir.p.goto(`${BASE}/procurement`); const poHref = await dir.p.locator('a[href^="/procurement/c"]').first().getAttribute("href");
const today = new Date().toISOString().slice(0, 10);
for (const [path, o] of [["/contractors", { text: "Fernandes Electricals" }], ["/suppliers", { text: "Sagar Steel Traders" }], ["/workforce", { text: "Ramesh Gaonkar" }], ["/materials", { text: "Stock on site" }], ["/procurement", { text: "PO-" }], [poHref, { text: "Order lines" }],
  ["/budget", { text: "cost overview", shot: "budget" }], ["/expenses", {}], ["/expenses?status=PENDING", {}], ["/payments", {}], ["/documents", { text: "Ground floor plan" }], ["/drawings", { text: "Structural details", shot: "drawings" }], ["/analytics", { text: "Schedule performance", shot: "analytics" }],
  ["/reports", {}], [`/reports/daily?project=${dona.split("/").pop()}&date=${today}`, { text: "Daily Site Report", shot: "daily-report" }], ["/calendar", { shot: "calendar" }], ["/calendar?m=2026-08", {}], ["/timeline", { shot: "portfolio-timeline" }], ["/map", { text: "Dona Paula Villa" }], ["/settings", {}], [`${dona}/documents`, {}], ["/photos?block=Main", {}], ["/inspections", { text: "Pass rate" }], ["/safety", { text: "Days without incident" }], ["/bills", {}], ["/exports", {}], ["/ask", { text: "Project health" }], [`${dona}/handover`, { text: "Project Passport" }], [`${dona}/passport`, { text: "Project Passport" }], [`${dona}/compare`, {}]])
  await visit(dir, path, o);
await dir.p.goto(`${BASE}/inspections`); const insHref = await dir.p.locator('a[href^="/inspections/c"]').first().getAttribute("href"); await visit(dir, insHref, {});
await visit(dir, "/projects/does-not-exist", { expect: 404 });
const pm = await session("priya.naik@coastalindia.demo");
for (const path of ["/dashboard", "/projects", "/tasks", "/team", "/profile", "/workforce", "/materials", "/procurement", "/documents", "/analytics", "/reports", "/calendar", "/timeline", "/contractors", "/suppliers", "/inspections", "/safety", "/bills", "/exports", "/ask"]) await visit(pm, path);
for (const path of ["/projects/new", "/budget", "/expenses", "/payments", "/settings"]) await visit(pm, path, { expect: 404 });
const acc = await session("maria.gomes@coastalindia.demo");
for (const path of ["/dashboard", "/projects", "/budget", "/expenses", "/payments", "/procurement", "/documents", "/analytics", "/contractors", "/suppliers", "/calendar", "/map", "/profile", "/bills", "/exports", "/ask"]) await visit(acc, path);
for (const path of ["/workforce", "/materials", "/tasks", "/photos", "/issues", "/team", "/reports", "/settings", "/inspections", "/safety"]) await visit(acc, path, { expect: 404 });
await visit(acc, "/site", { expect: "redirect" });
const sup = await session("carlos.fernandes@coastalindia.demo", true);
for (const [path, o] of [["/site", {}], ["/site/tasks", {}], ["/site/tasks?show=done", {}], ["/site/progress", { shot: "m-progress" }], ["/site/more", {}], ["/site/notifications", {}], ["/site/profile", {}], ["/site/add-progress", {}], ["/site/report-issue", { shot: "m-issue" }], ["/site/site-update", {}]]) await visit(sup, path, o);
await sup.p.goto(`${BASE}/site/tasks`); const st = await sup.p.locator('a[href^="/site/tasks/c"]').first().getAttribute("href");
await visit(sup, st, { shot: "m-task" });
for (const path of ["/site/attendance", "/site/materials", "/site/drawings", "/site/inspections", "/site/safety", "/site/delay"]) await visit(sup, path);
await visit(sup, "/documents", { expect: "redirect" }); await visit(sup, "/budget", { expect: "redirect" });
for (const who of ["vikram.shetty", "suresh.fernandes"]) {
  const s2 = await session(who + "@coastalindia.demo", true);
  for (const path of ["/site", "/site/tasks", "/site/progress", "/site/more", "/site/drawings", "/site/profile"]) await visit(s2, path);
  if (who.startsWith("vikram")) for (const path of ["/site/attendance", "/site/materials", "/site/inspections"]) await visit(s2, path);
  else { await visit(s2, "/site/materials", { expect: "redirect" }); await visit(s2, "/site/inspections", { expect: "redirect" }); await visit(s2, "/site/safety", {}); }
  await visit(s2, "/dashboard", { expect: "redirect" });
}
await visit(sup, "/dashboard", { expect: "redirect" }); await visit(sup, dona, { expect: "redirect" });
await browser.close();
console.log(`${total - bad}/${total} pages OK`); process.exit(bad ? 1 : 0);

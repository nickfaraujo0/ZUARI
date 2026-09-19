// Route sweep (read-only, demo data): every page loads for each role with no errors; forbidden pages are blocked.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3100", SHOTS = process.argv[2];
const PW = "zuari-demo-2026";
const browser = await chromium.launch({ channel: "chrome" });
let bad = 0, total = 0;
async function session(email, mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1360, height: 860 } });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
  await p.goto(`${BASE}/login`); await p.fill("[name=email]", email); await p.fill("[name=password]", PW); await p.click('button:has-text("Sign in")'); await p.waitForURL(/dashboard|site/);
  return { p, errs };
}
async function visit({ p, errs }, path, { expect = 200, shot, text } = {}) {
  total++; errs.length = 0;
  const r = await p.goto(BASE + path, { waitUntil: "networkidle" }); const url = new URL(p.url()).pathname;
  const body = await p.locator("body").innerText();
  let why = "";
  if (expect === "redirect" ? url === path : r.status() !== expect) why = `status ${r.status()} at ${url}`;
  else if (/Application error|Something went wrong|Unhandled Runtime Error/.test(body)) why = "error text on page";
  else if (text && !body.includes(text)) why = `missing "${text}"`;
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
await visit(dir, "/projects/does-not-exist", { expect: 404 });
const pm = await session("priya.naik@coastalindia.demo");
for (const path of ["/dashboard", "/projects", "/tasks", "/team", "/profile"]) await visit(pm, path);
await visit(pm, "/projects/new", { expect: 404 });
const sup = await session("carlos.fernandes@coastalindia.demo", true);
for (const [path, o] of [["/site", {}], ["/site/tasks", {}], ["/site/tasks?show=done", {}], ["/site/progress", { shot: "m-progress" }], ["/site/more", {}], ["/site/notifications", {}], ["/site/profile", {}], ["/site/add-progress", {}], ["/site/report-issue", { shot: "m-issue" }], ["/site/site-update", {}]]) await visit(sup, path, o);
await sup.p.goto(`${BASE}/site/tasks`); const st = await sup.p.locator('a[href^="/site/tasks/c"]').first().getAttribute("href");
await visit(sup, st, { shot: "m-task" });
await visit(sup, "/dashboard", { expect: "redirect" }); await visit(sup, dona, { expect: "redirect" });
await browser.close();
console.log(`${total - bad}/${total} pages OK`); process.exit(bad ? 1 : 0);

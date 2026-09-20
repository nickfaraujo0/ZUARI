// Feature tests: profile, password, lockout, admin reset/deactivate, comments, edit project, offline outbox.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
const LOG = process.env.SERVER_LOG ?? "/tmp/zuari-dev.log"; // where the server prints dev emails
const BASE = process.env.BASE ?? "http://localhost:3100";
const run = Date.now().toString(36);
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(1); console.log("✓", name); } catch (e) { results.push(0); console.log("✗", name, "\n   ", String(e.message).split("\n")[0]); throw e; } };
const see = (p, t) => p.getByText(t).locator("visible=true").first().waitFor({ timeout: 8000 });
const login = async (p, email, pw) => { await p.goto(`${BASE}/login`); await p.fill("[name=email]", email); await p.fill("[name=password]", pw); await p.click('button:has-text("Sign in")'); };
const signOut = async (p) => { await p.locator("header details").last().locator("summary").click(); await p.click('button:has-text("Sign out")'); await p.waitForURL("**/login"); };

const browser = await chromium.launch({ channel: "chrome" });
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const d = await dctx.newPage(); d.on("dialog", (x) => x.accept());
const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const ph = await pctx.newPage();
const consoleErrs = []; ph.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 160)); });
const dEmail = `dir.${run}@e2e.test`, sEmail = `sup.${run}@e2e.test`;
let dPass = "first-password-1", sPass, pid;

try {
  await step("Director signs up, creates a project, then edits its details", async () => {
    await d.goto(`${BASE}/signup`);
    await d.fill("[name=companyName]", `E2E Extras ${run}`); await d.fill("[name=name]", "Dina Director"); await d.fill("[name=email]", dEmail); await d.fill("[name=password]", dPass);
    await d.click('button:has-text("Create workspace")'); await d.waitForURL("**/dashboard");
    await d.goto(`${BASE}/projects/new`);
    await d.fill("[name=name]", `Extras Villa ${run}`); await d.fill("[name=client]", "Client"); await d.fill("[name=location]", "Goa"); await d.fill("[name=budget]", "5000000");
    await d.click('button:has-text("Create project")'); await d.waitForURL(/\/projects\/(?!new)[a-z0-9]+$/);
    pid = d.url().split("/").pop();
    await d.click('a:has-text("Edit project details")');
    await d.fill("[name=name]", `Extras Villa Renamed ${run}`); await d.fill("[name=budget]", "7500000");
    await d.click('button:has-text("Save changes")'); await d.waitForURL(`**/projects/${pid}`);
    await see(d, `Extras Villa Renamed ${run}`); await see(d, "₹75.0 L");
  });
  await step("Project workspace has a working Documents tab (empty state, upload form)", async () => { await d.getByRole("link", { name: "Documents" }).first().click(); await d.waitForURL(/\/documents$/); await see(d, "No documents yet"); await see(d, "Upload a document"); });
  await step("Director updates profile", async () => {
    await d.goto(`${BASE}/profile`); await d.fill("[name=phone]", "+91 98000 00000"); await d.fill("[name=title]", "Managing Director");
    await d.click('button:has-text("Save profile")'); await see(d, "Profile saved");
  });
  await step("Password change: wrong current is rejected, correct works, new password signs in", async () => {
    await d.fill("[name=current]", "not-the-password"); await d.fill("[name=next]", "second-password-2"); await d.fill("[name=confirm]", "second-password-2");
    await d.click('button:has-text("Change password")'); await see(d, "current password is incorrect");
    await d.fill("[name=current]", dPass); await d.click('button:has-text("Change password")'); await see(d, "Password changed");
    dPass = "second-password-2";
    await signOut(d); await login(d, dEmail, "first-password-1"); await see(d, "Invalid email or password");
    await login(d, dEmail, dPass); await d.waitForURL("**/dashboard");
  });
  await step("Director adds a supervisor and a task", async () => {
    await d.goto(`${BASE}/projects/${pid}/team`); await d.fill("[name=name]", "Sid Supervisor"); await d.fill("[name=email]", sEmail);
    await d.click('button:has-text("Create account")'); sPass = (await d.getByRole("status").first().innerText()).match(/password (\S+)/)?.[1];
    await d.goto(`${BASE}/projects/${pid}/tasks`); await d.click('summary:has-text("Create task")'); await d.fill("[name=title]", "Slab shuttering — Floor 1");
    await d.selectOption("[name=assigneeId]", { label: "Sid Supervisor · Site Supervisor" }); await d.click('button:has-text("Create task")'); await see(d, "Task created");
  });
  await step("Lockout: 5 wrong passwords lock the account, even for the right password", async () => {
    const anon = await (await browser.newContext()).newPage();
    for (let i = 0; i < 5; i++) { await login(anon, sEmail, "wrong-" + i); await see(anon, "Invalid email or password"); }
    await login(anon, sEmail, sPass); await see(anon, "Too many failed attempts");
  });
  await step("Manager resets the locked supervisor's password; new temp password works", async () => {
    await d.goto(`${BASE}/team`);
    const row = d.locator("li", { hasText: "Sid Supervisor" }); await row.locator("summary:has-text('Manage')").click(); await row.locator("button:has-text('Reset password')").click();
    sPass = (await d.getByRole("status").first().innerText()).match(/: (Zu-\S+) —/)?.[1]; if (!sPass) throw new Error("no temp password");
    await login(ph, sEmail, sPass); await ph.waitForURL("**/site");
  });
  await step("Task discussion: manager comments, supervisor sees it and replies", async () => {
    await d.goto(`${BASE}/projects/${pid}/tasks`); await d.click('a:has-text("Edit") >> nth=0');
    await d.fill("textarea[name=body]", "Please confirm shuttering height before pour."); await d.click('button:has-text("Post comment")'); await see(d, "Comment added");
    await ph.goto(`${BASE}/site/tasks`); await ph.click("text=Slab shuttering — Floor 1"); await see(ph, "Please confirm shuttering height before pour.");
    await ph.fill("textarea[name=body]", "Confirmed, 3.2 m."); await ph.click('button:has-text("Post comment")'); await see(ph, "Comment added");
    await d.goto(`${BASE}/notifications`); await see(d, "Sid Supervisor commented");
  });
  await step("Offline: submission is saved on the phone, then uploads automatically when signal returns", async () => {
    await ph.goto(`${BASE}/site/tasks`); await ph.click("text=Slab shuttering — Floor 1"); await ph.click("text=Update this task");
    await ph.setInputFiles("input[type=file][multiple]", "e2e/site-photo.jpg"); await ph.locator("img[alt=Selected]").waitFor();
    await ph.fill("textarea", "Shuttering done offline.");
    await pctx.setOffline(true);
    await see(ph, "You're offline"); await ph.click('button:has-text("Save to send later")'); await see(ph, "Saved on this phone");
    await ph.evaluate(() => new Promise((res) => { const r = indexedDB.open("zuari-outbox", 1); r.onsuccess = () => { const g = r.result.transaction("items").objectStore("items").getAll(); g.onsuccess = () => { window.__copy = g.result[0]; res(); }; }; }));
    await pctx.setOffline(false);
    let ok = false;
    for (let i = 0; i < 20 && !ok; i++) { await d.waitForTimeout(1500); await d.goto(`${BASE}/projects/${pid}/photos`); ok = (await d.locator('main a img[src^="/api/photos/"]').count()) === 1; }
    if (!ok) {
      const q = await ph.evaluate(() => new Promise((res) => { const r = indexedDB.open("zuari-outbox", 1); r.onsuccess = () => { const g = r.result.transaction("items").objectStore("items").getAll(); g.onsuccess = () => res(g.result.map((i) => ({ id: i.id, kind: i.kind, error: i.error, photos: i.photos.length, fields: i.fields.length }))); }; r.onerror = () => res("idb error"); }));
      console.log("   outbox:", JSON.stringify(q), "| online:", await ph.evaluate(() => navigator.onLine), "| console errors:", JSON.stringify(consoleErrs.slice(-3)));
      throw new Error("queued photo never reached the office");
    }
    await d.goto(`${BASE}/projects/${pid}/tasks`); await d.click('a:has-text("Edit") >> nth=0'); await see(d, "Shuttering done offline.");
  });
  await step("Outbox safety: another user's item is never uploaded; a replay of a received update is not duplicated", async () => {
    const put = (uid) => ph.evaluate((uid) => new Promise((res) => { const r = indexedDB.open("zuari-outbox", 1); r.onsuccess = () => { const t = r.result.transaction("items", "readwrite"); t.objectStore("items").put({ ...window.__copy, userId: uid ?? window.__copy.userId }); t.oncomplete = () => { dispatchEvent(new Event("online")); res(); }; }; }), uid);
    const count = () => ph.evaluate(() => new Promise((res) => { const r = indexedDB.open("zuari-outbox", 1); r.onsuccess = () => { const g = r.result.transaction("items").objectStore("items").getAll(); g.onsuccess = () => res(g.result.length); }; }));
    await put("someone-else"); await ph.waitForTimeout(3000);
    if ((await count()) !== 1) throw new Error("an item owned by another user was uploaded or removed");
    await ph.evaluate(() => new Promise((res) => { const r = indexedDB.open("zuari-outbox", 1); r.onsuccess = () => { const t = r.result.transaction("items", "readwrite"); t.objectStore("items").delete(window.__copy.id); t.oncomplete = () => res(); }; }));
    await put(); let n = 1; for (let i = 0; i < 16 && n; i++) { await ph.waitForTimeout(500); n = await count(); }
    if (n) throw new Error("replayed item was not acknowledged");
    await d.goto(`${BASE}/projects/${pid}/photos`);
    if ((await d.locator('main a img[src^="/api/photos/"]').count()) !== 1) throw new Error("replay created a duplicate photo");
  });
  await step("Deactivated users are signed out and blocked; reactivating restores access", async () => {
    await d.goto(`${BASE}/team`);
    let row = d.locator("li", { hasText: "Sid Supervisor" }); await row.locator("summary:has-text('Manage')").click(); await row.locator("button:has-text('Deactivate account')").click(); await see(d, "Cannot sign in");
    await ph.goto(`${BASE}/site`); await ph.waitForURL("**/login");
    await d.goto(`${BASE}/team`); row = d.locator("li", { hasText: "Sid Supervisor" });
    await row.locator("summary:has-text('Manage')").click(); await row.locator("button:has-text('Reactivate account')").click(); await d.getByText("Cannot sign in").waitFor({ state: "detached", timeout: 8000 });
    await login(ph, sEmail, sPass); await ph.waitForURL("**/site");
  });
  await step("Forgot password: emailed link sets a new password once; unknown emails get the same answer", async () => {
    const anon = await (await browser.newContext()).newPage();
    const before = readFileSync(LOG, "utf8").length;
    await anon.goto(`${BASE}/forgot-password`); await anon.fill("[name=email]", dEmail); await anon.click('button:has-text("Send reset link")'); await see(anon, "reset link is on its way");
    let link; for (let i = 0; i < 12 && !link; i++) { await anon.waitForTimeout(500); link = readFileSync(LOG, "utf8").slice(before).match(/http\S*\/reset-password\?token=[\w-]+/)?.[0]; }
    if (!link) throw new Error("no reset email was produced");
    const mid = readFileSync(LOG, "utf8").length;
    await anon.goto(`${BASE}/forgot-password`); await anon.fill("[name=email]", `nobody.${run}@e2e.test`); await anon.click('button:has-text("Send reset link")'); await see(anon, "reset link is on its way");
    await anon.waitForTimeout(1200); if (readFileSync(LOG, "utf8").slice(mid).includes("nobody.")) throw new Error("mail sent to an unknown address");
    await anon.goto(link); await anon.fill("[name=next]", "third-password-3"); await anon.fill("[name=confirm]", "third-password-3"); await anon.click('button:has-text("Set new password")');
    await anon.waitForURL(/login\?reset=1/); await see(anon, "Password updated");
    await login(anon, dEmail, "third-password-3"); await anon.waitForURL("**/dashboard");
    const again = await (await browser.newContext()).newPage();
    await again.goto(link); await again.fill("[name=next]", "fourth-password-4"); await again.fill("[name=confirm]", "fourth-password-4"); await again.click('button:has-text("Set new password")'); await see(again, "invalid or has expired");
  });
} finally {
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} steps passed`);
  process.exit(results.includes(0) ? 1 : 0);
}

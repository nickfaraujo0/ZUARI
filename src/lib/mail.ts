import "server-only";

/**
 * Sends transactional email through Resend's HTTP API when RESEND_API_KEY + MAIL_FROM are set.
 * Without them (local dev) the message is printed to the server log so flows stay testable.
 */
export async function sendMail(m: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.log(`[mail:dev] To: ${m.to}\n[mail:dev] Subject: ${m.subject}\n[mail:dev] ${m.text.replace(/\n/g, "\n[mail:dev] ")}`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: m.to, subject: m.subject, text: m.text }) });
  if (!r.ok) throw new Error(`Mail provider responded ${r.status}`);
}
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");

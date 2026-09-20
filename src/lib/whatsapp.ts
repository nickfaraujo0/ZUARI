import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { waNumber } from "./phone";

const graph = () => (process.env.WHATSAPP_GRAPH_URL ?? "https://graph.facebook.com").replace(/\/$/, "");
export const waEnabled = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

/**
 * Sends a text message through the WhatsApp Cloud API. Free-form text is only delivered inside WhatsApp's
 * 24-hour customer-service window; outside it Meta requires an approved template. Without credentials the
 * message is printed to the server log.
 */
export async function sendWhatsApp(to: string, text: string): Promise<boolean> {
  if (!waEnabled()) { console.log(`[wa:dev] to ${waNumber(to)}: ${text.replace(/\n/g, " ⏎ ")}`); return false; }
  try {
    const r = await fetch(`${graph()}/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: waNumber(to), type: "text", text: { body: text.slice(0, 4000) } }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.error("[wa] send failed", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) { console.error("[wa] send error", e); return false; }
}

export async function downloadMedia(mediaId: string): Promise<Buffer | null> {
  try {
    const h = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
    const meta = await fetch(`${graph()}/v20.0/${encodeURIComponent(mediaId)}`, { headers: h, signal: AbortSignal.timeout(8000) });
    if (!meta.ok) return null;
    const { url } = (await meta.json()) as { url?: string };
    if (!url) return null;
    const bin = await fetch(url, { headers: h, signal: AbortSignal.timeout(15000) });
    return bin.ok ? Buffer.from(await bin.arrayBuffer()) : null;
  } catch { return null; }
}

/** Meta signs every webhook body with the app secret (X-Hub-Signature-256). Unsigned or mis-signed requests are rejected. */
export function verifySignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = createHmac("sha256", secret).update(raw).digest();
  const got = Buffer.from(header.slice(7), "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

import { handleInbound } from "@/lib/whatsapp-inbound";
import { verifySignature } from "@/lib/whatsapp";

// Meta webhook verification handshake.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}
// Incoming messages: only accepted with a valid signature, so nobody can forge site updates.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response("Bad request", { status: 400 }); }
  await handleInbound(body);
  return new Response("ok", { status: 200 });
}

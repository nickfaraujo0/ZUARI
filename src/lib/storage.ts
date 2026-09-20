import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { UserError } from "./errors";

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");
export const MAX_PHOTO = 10 * 1024 * 1024;
export const MAX_PHOTOS = 8;

/** Identify by magic bytes — never trust the client-supplied MIME type or filename. */
export function sniff(b: Buffer): { mime: string; ext: string } | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (b.length > 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}
const safePath = (key: string) => {
  const p = path.resolve(/*turbopackIgnore: true*/ ROOT, key);
  if (!p.startsWith(ROOT + path.sep)) throw new Error("bad storage key");
  return p;
};

export async function storeImage(buf: Buffer, companyId: string, projectId: string) {
  const t = sniff(buf);
  if (!t) throw new UserError("Only JPEG, PNG or WebP photos are supported.");
  if (buf.length > MAX_PHOTO) throw new UserError("Each photo must be under 10 MB.");
  const key = `${companyId}/${projectId}/${randomUUID()}.${t.ext}`;
  const p = safePath(key);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(p), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ p, buf);
  return { key, mime: t.mime, size: buf.length };
}
export const readImage = (key: string) => readFile(/*turbopackIgnore: true*/ safePath(key));

export async function storeFiles(list: File[], companyId: string, projectId: string) {
  if (list.length > MAX_PHOTOS) throw new UserError(`You can add up to ${MAX_PHOTOS} photos at a time.`);
  const out = [];
  for (const f of list) out.push(await storeImage(Buffer.from(await f.arrayBuffer()), companyId, projectId));
  return out;
}

// ── Documents (drawings, contracts, invoices …) ────────────────
export const MAX_DOC = 25 * 1024 * 1024;
const DOC_EXT: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
/** Type is decided by content (magic bytes) and a whitelisted extension, never by the browser-supplied MIME. */
export function sniffDoc(buf: Buffer, filename: string): { ext: string; mime: string } | null {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString() === "%PDF-") return ext === "pdf" ? { ext, mime: DOC_EXT.pdf } : { ext: "pdf", mime: DOC_EXT.pdf };
  const img = sniff(buf);
  if (img) return { ext: img.ext, mime: img.mime };
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04 && ["docx", "xlsx", "pptx"].includes(ext)) return { ext, mime: DOC_EXT[ext] };
  return null;
}
export const cleanName = (n: string) => n.replace(/[/\\]/g, "_").replace(/[^\w.\- ()]+/g, "_").slice(-120) || "document";
export async function storeDocument(file: File, companyId: string, projectId: string) {
  if (file.size > MAX_DOC) throw new UserError("Files must be under 25 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const t = sniffDoc(buf, file.name);
  if (!t) throw new UserError("Unsupported file. Upload a PDF, image (PNG/JPG/WebP), Word, Excel or PowerPoint file.");
  const key = `${companyId}/${projectId}/docs/${randomUUID()}.${t.ext}`;
  const p = safePath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, buf);
  return { key, mime: t.mime, size: buf.length, filename: cleanName(file.name) };
}
export async function removeFiles(keys: string[]) {
  const { unlink } = await import("node:fs/promises");
  await Promise.all(keys.map((k) => unlink(/*turbopackIgnore: true*/ safePath(k)).catch(() => {})));
}

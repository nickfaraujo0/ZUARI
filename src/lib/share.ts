import "server-only";
import { createHash } from "node:crypto";

/** Client-portal tokens are stored only as SHA-256 hashes. */
export const shareHash = (t: string) => createHash("sha256").update(t).digest("hex");

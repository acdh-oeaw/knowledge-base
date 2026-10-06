import { createHash } from "node:crypto";

/** Hex-encoded SHA-256 digest of an asset's bytes, as recorded in `assets.content_hash`. */
export function getContentHash(input: Buffer): string {
	return createHash("sha256").update(input).digest("hex");
}

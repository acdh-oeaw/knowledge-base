import { extname } from "node:path";

import slugify from "@sindresorhus/slugify";

/**
 * How a stored asset is delivered over HTTP: the filename a browser saves it under, and whether it
 * opens in the tab or downloads.
 *
 * Shared by every route that serves an asset — the public API's by-key and documents-policies
 * routes, and the dashboard's own two — so the same file reached through any of them saves under
 * the same name. It lives here rather than in either app because that is the only place both can
 * see.
 */

/** Extensions for the mime types we accept but whose storage keys carry no extension. */
const mimeTypeExtensions = new Map([
	["image/jpeg", ".jpg"],
	["image/png", ".png"],
	["image/webp", ".webp"],
	["image/avif", ".avif"],
	["image/svg+xml", ".svg"],
	["application/pdf", ".pdf"],
	["application/msword", ".doc"],
	["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
	["application/vnd.ms-excel", ".xls"],
	["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
	["application/vnd.ms-powerpoint", ".ppt"],
	["application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"],
	["text/plain", ".txt"],
	["application/zip", ".zip"],
]);

export interface DownloadableAsset {
	filename: string | null;
	key: string;
	label: string;
	mimeType: string;
}

/**
 * The original upload filename when we still have it, otherwise one built from the asset's label so
 * a download never lands as a bare uuid. Storage keys are `prefix/uuid` with no extension, so the
 * extension is inferred from the mime type.
 */
export function getDownloadFilename(asset: DownloadableAsset): string {
	if (asset.filename != null) {
		return asset.filename;
	}

	const extension = (extname(asset.key) || mimeTypeExtensions.get(asset.mimeType)) ?? "";

	return `${slugify(asset.label)}${extension}`;
}

/**
 * Types a browser renders itself open in place; everything else downloads. "Click here to see the
 * flyer" should show the flyer, not drop a file in the downloads folder.
 */
export function getContentDisposition(asset: DownloadableAsset): "attachment" | "inline" {
	const isViewable = asset.mimeType === "application/pdf" || asset.mimeType.startsWith("image/");

	return isViewable ? "inline" : "attachment";
}

/**
 * A `Content-Disposition` header carrying the filename twice, as RFC 6266 prescribes: a plain
 * `filename` stripped to ascii for anything that only understands that, and a `filename*` that
 * survives non-ascii. Migrated filenames are full of accented characters, and a bare
 * `filename="Persée.pdf"` reaches the browser mangled.
 */
export function getContentDispositionHeader(
	asset: DownloadableAsset,
	disposition = getContentDisposition(asset),
): string {
	const filename = getDownloadFilename(asset);

	// Quotes and backslashes would end the quoted string early; the rest is dropped to ascii, which
	// only the fallback needs to be.
	const ascii = filename.replaceAll(/["\\]/g, "").replaceAll(/[^\u0020-\u007E]/g, "_");

	return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

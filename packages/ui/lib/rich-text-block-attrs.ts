import type { JSONContent } from "@tiptap/core";

/**
 * How a block's attributes are read back and written out.
 *
 * Node attributes arrive from three directions — the editor's own commands, a stored document, and
 * pasted HTML — and only the first is trustworthy. Everything here therefore takes `unknown` and
 * returns a value the schema accepts, so a hand-edited database row or a paste from another page
 * degrades to a default instead of putting the editor into a state it cannot render.
 */

/** Whether a caption is suppressed, taken from the asset, or written for this block alone. */
export type ImageCaptionMode = "hidden" | "inherit" | "override";

export function normalizeImageCaptionMode(value: unknown): ImageCaptionMode {
	return value === "hidden" || value === "override" || value === "inherit" ? value : "inherit";
}

/** Mirrors `imageLayoutEnum` in `@dariah-eric/database` — the stored column is a closed set. */
export type ImageLayout = "default" | "wide" | "full" | "float-start" | "float-end";

const imageLayouts = new Set<ImageLayout>(["default", "wide", "full", "float-start", "float-end"]);

export function normalizeImageLayout(value: unknown): ImageLayout {
	return imageLayouts.has(value as ImageLayout) ? (value as ImageLayout) : "default";
}

/** Mirrors `galleryLayoutEnum` in `@dariah-eric/database` — the stored column is a closed set. */
export type GalleryLayout = "carousel" | "grid";

export function normalizeGalleryLayout(value: unknown): GalleryLayout {
	return value === "carousel" ? "carousel" : "grid";
}

export type CalloutIntent = "neutral" | "info" | "warning" | "danger" | "success";

export function normalizeCalloutIntent(intent: unknown): CalloutIntent {
	/** `default` is the name this intent had before the palette gained the other four. */
	if (intent === "default") {
		return "neutral";
	}
	if (
		intent === "neutral" ||
		intent === "info" ||
		intent === "warning" ||
		intent === "danger" ||
		intent === "success"
	) {
		return intent;
	}
	return "info";
}

export type ButtonLinkVariant = "primary" | "secondary" | "outline";

export function normalizeButtonLinkVariant(value: unknown): ButtonLinkVariant {
	if (value === "primary" || value === "secondary" || value === "outline") {
		return value;
	}
	return "primary";
}

export type MediaTextSide = "start" | "end";

export function normalizeMediaTextSide(value: unknown): MediaTextSide {
	return value === "end" ? "end" : "start";
}

/** Serialize a richtext caption for storage in an HTML `data-caption` attribute (copy/paste). */
export function serializeCaptionAttr(caption: JSONContent | null): string | null {
	return caption != null ? JSON.stringify(caption) : null;
}

/** Parse a `data-caption` attribute back into richtext JSON; invalid/empty values become null. */
export function parseCaptionAttr(value: string | null | undefined): JSONContent | null {
	if (value == null || value === "") {
		return null;
	}
	try {
		return JSON.parse(value) as JSONContent;
	} catch {
		return null;
	}
}

/**
 * A caption written by something other than this editor — a `<caption>` element on an imported or
 * pasted table — as a caption document.
 *
 * Text only. The formatting a foreign caption carries would have to be parsed against the caption
 * editor's own schema to survive a round-trip, and reaching for that here would mean parsing HTML
 * inside an attribute parser. Captions authored here travel as JSON in `data-caption` and never
 * take this path; this is what keeps an imported caption from being dropped entirely.
 */
export function captionFromElementText(text: string | null | undefined): JSONContent | null {
	const trimmed = text?.trim();

	if (trimmed == null || trimmed === "") {
		return null;
	}

	return {
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text: trimmed }] }],
	};
}

/**
 * One image of a gallery node. `alt` and `assetCaption` are copies of the asset's own metadata,
 * kept beside the key for rendering and for an `inherit` caption; only the key is persisted.
 */
export interface GalleryItemAttrs {
	imageKey: string | null;
	imageUrl: string | null;
	alt: string | null;
	assetCaption: JSONContent | null;
	caption: JSONContent | null;
	captionMode: ImageCaptionMode;
}

export function toGalleryItem(value: unknown): GalleryItemAttrs | null {
	if (typeof value !== "object" || value == null) {
		return null;
	}

	const item = value as Record<string, unknown>;

	return {
		imageKey: typeof item.imageKey === "string" ? item.imageKey : null,
		imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
		alt: typeof item.alt === "string" ? item.alt : null,
		assetCaption: (item.assetCaption as JSONContent | null) ?? null,
		caption: (item.caption as JSONContent | null) ?? null,
		captionMode: normalizeImageCaptionMode(item.captionMode),
	};
}

/** An item without a key points at no asset, so it would render as a hole — drop it instead. */
export function normalizeGalleryItems(value: unknown): Array<GalleryItemAttrs> {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((item) => toGalleryItem(item))
		.filter((item): item is GalleryItemAttrs => item?.imageKey != null);
}

/** Gallery items survive a round trip through HTML (copy/paste, import) as one JSON attribute. */
export function serializeGalleryItemsAttr(items: Array<GalleryItemAttrs>): string {
	return JSON.stringify(items);
}

export function parseGalleryItemsAttr(value: string | null | undefined): Array<GalleryItemAttrs> {
	if (value == null || value === "") {
		return [];
	}
	try {
		return normalizeGalleryItems(JSON.parse(value));
	} catch {
		return [];
	}
}

/** Which of the two captions a block actually shows, given the mode it is in. */
export function resolveImageCaption(
	captionMode: ImageCaptionMode,
	caption: JSONContent | null,
	assetCaption: JSONContent | null,
): JSONContent | null {
	if (captionMode === "hidden") {
		return null;
	}
	return captionMode === "override" ? caption : assetCaption;
}

/**
 * Who a quote is attributed to. Either a person in the knowledge base — stored by document id, so
 * the read path can resolve their current name, portrait and page — or a name typed in for someone
 * who has no entry of their own.
 *
 * A person keeps the name they had when picked beside the id. It is a fallback, not the source of
 * truth: it lets the editor and a preview name the author without a lookup, and keeps the byline
 * readable should the entry later be unpublished. Their portrait is the one on their entry.
 *
 * A typed-in author may have a picture of their own, stored by asset key like every other image.
 * `imageUrl` is only for display in the editor: urls are signed when the document is loaded, and
 * dropped again when it is saved, so a stored document never holds one that could go stale.
 */
export type QuoteAuthor =
	| { kind: "person"; entityId: string; name: string }
	| { kind: "text"; name: string; imageKey?: string; imageUrl?: string };

export function toQuoteAuthor(value: unknown): QuoteAuthor | null {
	if (value === null || typeof value !== "object") {
		return null;
	}
	const { kind, entityId, name, imageKey, imageUrl } = value as Record<string, unknown>;
	const trimmedName = typeof name === "string" ? name.trim() : "";

	if (kind === "person" && typeof entityId === "string" && entityId !== "") {
		return { kind: "person", entityId, name: trimmedName };
	}
	if (kind === "text" && trimmedName !== "") {
		return {
			kind: "text",
			name: trimmedName,
			...(typeof imageKey === "string" && imageKey !== "" ? { imageKey } : {}),
			...(typeof imageKey === "string" && imageKey !== "" && typeof imageUrl === "string"
				? { imageUrl }
				: {}),
		};
	}

	return null;
}

export function normalizeQuoteAuthors(value: unknown): Array<QuoteAuthor> {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap((item) => {
		const author = toQuoteAuthor(item);
		return author != null ? [author] : [];
	});
}

export function serializeQuoteAuthorsAttr(authors: Array<QuoteAuthor>): string | null {
	return authors.length > 0 ? JSON.stringify(authors) : null;
}

export function parseQuoteAuthorsAttr(value: string | null | undefined): Array<QuoteAuthor> {
	if (value == null || value === "") {
		return [];
	}
	try {
		return normalizeQuoteAuthors(JSON.parse(value));
	} catch {
		return [];
	}
}

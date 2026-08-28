import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type { JSONContent } from "@tiptap/core";

import type { ContentBlockInput } from "@/lib/content-block-input";

/** Mirrors `imageLayoutEnum` in `@dariah-eric/database`. */
type ImageLayout = "default" | "wide" | "full" | "float-start" | "float-end";

const imageLayouts = new Set<ImageLayout>(["default", "wide", "full", "float-start", "float-end"]);

function normalizeImageLayout(value: unknown): ImageLayout {
	return imageLayouts.has(value as ImageLayout) ? (value as ImageLayout) : "default";
}

/** Mirrors `galleryLayoutEnum` in `@dariah-eric/database`. */
type GalleryLayout = "carousel" | "grid";

function normalizeGalleryLayout(value: unknown): GalleryLayout {
	return value === "carousel" ? "carousel" : "grid";
}

/** A stored block predating `captionMode` is read as whichever mode its caption implies. */
function normalizeCaptionMode(
	value: unknown,
	caption: JSONContent | null | undefined,
): ImageCaptionMode {
	if (value === "hidden" || value === "inherit" || value === "override") {
		return value;
	}
	return caption != null ? "override" : "inherit";
}

interface RichTextBlock {
	type: "rich_text";
	content?: JSONContent;
}

interface ImageBlock {
	type: "image";
	content?: {
		imageKey?: string;
		imageUrl?: string;
		alt?: string | null;
		assetCaption?: JSONContent | null;
		caption?: JSONContent | null;
		captionMode?: ImageCaptionMode;
		layout?: ImageLayout;
	};
}

interface EmbedBlock {
	type: "embed";
	content?: { url?: string; title?: string; caption?: JSONContent | null };
}

interface CalloutBlock {
	type: "callout";
	content?: {
		intent?: "neutral" | "info" | "warning" | "danger" | "success";
		title?: string;
	};
	children?: Array<MergeableBlock>;
}

interface AccordionBlock {
	type: "accordion";
	children?: Array<AccordionItemBlock>;
}

interface AccordionItemBlock {
	type: "accordion_item";
	content?: { title?: string };
	children?: Array<MergeableBlock>;
}

interface MediaTextBlock {
	type: "media_text";
	content?: {
		imageKey?: string;
		imageUrl?: string;
		alt?: string | null;
		assetCaption?: JSONContent | null;
		caption?: JSONContent | null;
		captionMode?: ImageCaptionMode;
		side?: "start" | "end";
		content?: JSONContent;
	};
}

interface GalleryBlock {
	type: "gallery";
	content?: {
		layout?: GalleryLayout;
		/** The gallery's own caption — what the set shows — as opposed to an item's image credit. */
		caption?: JSONContent | null;
		items?: Array<{
			imageKey?: string;
			imageUrl?: string;
			/**
			 * The joined asset row, as the read path assembles it. Gallery items have no `alt` /
			 * `assetCaption` columns of their own — those live on the asset, and the node carries a copy
			 * so it can render the image and resolve an `inherit` caption without a fetch.
			 */
			asset?: { alt?: string | null; caption?: JSONContent | null };
			caption?: JSONContent | null;
			captionMode?: ImageCaptionMode;
		}>;
	};
}

export type MergeableBlock =
	| RichTextBlock
	| ImageBlock
	| EmbedBlock
	| CalloutBlock
	| AccordionBlock
	| MediaTextBlock
	| GalleryBlock;

/**
 * Merges an ordered sequence of content blocks into a single Tiptap document. Typed blocks become
 * custom nodes; rich_text blocks contribute their child nodes directly. The result is used as the
 * content of the unified editor.
 *
 * Containers recurse: a callout's children are merged into its node's content the same way a
 * field's blocks are merged into the document, so a body made of a paragraph, an image and another
 * paragraph arrives as three nodes inside one callout — and the image is an `assetImage` node
 * again, which is how it can be edited in place.
 */
export function mergeBlocksToDocument(blocks: Array<MergeableBlock>): JSONContent {
	const nodes = mergeBlocksToNodes(blocks);

	if (nodes.length === 0) {
		nodes.push({ type: "paragraph" });
	}

	return { type: "doc", content: nodes };
}

/** The nodes one level of blocks becomes — the document's children, or a container's. */
function mergeBlocksToNodes(blocks: Array<MergeableBlock>): Array<JSONContent> {
	const nodes: Array<JSONContent> = [];

	for (const block of blocks) {
		if (block.type === "rich_text") {
			const children = block.content?.content ?? [];
			nodes.push(...children);
		} else if (block.type === "image") {
			const captionMode = normalizeCaptionMode(block.content?.captionMode, block.content?.caption);
			nodes.push({
				type: "assetImage",
				attrs: {
					imageKey: block.content?.imageKey ?? null,
					imageUrl: block.content?.imageUrl ?? null,
					alt: block.content?.alt ?? null,
					assetCaption: block.content?.assetCaption ?? null,
					caption: block.content?.caption ?? null,
					captionMode,
					layout: normalizeImageLayout(block.content?.layout),
				},
			});
		} else if (block.type === "gallery") {
			nodes.push({
				type: "galleryBlock",
				attrs: {
					layout: normalizeGalleryLayout(block.content?.layout),
					caption: block.content?.caption ?? null,
					items: (block.content?.items ?? []).map((item) => {
						return {
							imageKey: item.imageKey ?? null,
							imageUrl: item.imageUrl ?? null,
							alt: item.asset?.alt ?? null,
							assetCaption: item.asset?.caption ?? null,
							caption: item.caption ?? null,
							captionMode: normalizeCaptionMode(item.captionMode, item.caption),
						};
					}),
				},
			});
		} else if (block.type === "media_text") {
			const captionMode = normalizeCaptionMode(block.content?.captionMode, block.content?.caption);
			// The stored body is a document; the node holds its children as real nested content.
			const body = block.content?.content?.content ?? [];
			nodes.push({
				type: "mediaTextBlock",
				attrs: {
					imageKey: block.content?.imageKey ?? null,
					imageUrl: block.content?.imageUrl ?? null,
					alt: block.content?.alt ?? null,
					assetCaption: block.content?.assetCaption ?? null,
					caption: block.content?.caption ?? null,
					captionMode,
					side: block.content?.side ?? "start",
				},
				content: body.length > 0 ? body : [{ type: "paragraph" }],
			});
		} else if (block.type === "embed") {
			nodes.push({
				type: "embedBlock",
				attrs: {
					url: block.content?.url ?? null,
					title: block.content?.title ?? null,
					caption: block.content?.caption ?? null,
				},
			});
		} else if (block.type === "accordion") {
			const items = (block.children ?? []).map((item) => {
				const body = mergeBlocksToNodes(item.children ?? []);

				return {
					type: "accordionItem",
					attrs: { title: item.content?.title ?? "" },
					// A panel's content spec requires at least one block, so an empty one opens with a
					// paragraph rather than a node the schema would refuse.
					content: body.length > 0 ? body : [{ type: "paragraph" }],
				};
			});

			// Same reasoning one level up: an accordion with no panels is not a valid node.
			nodes.push({
				type: "accordionBlock",
				content:
					items.length > 0
						? items
						: [
								{
									type: "accordionItem",
									attrs: { title: "" },
									content: [{ type: "paragraph" }],
								},
							],
			});
		} else {
			const body = mergeBlocksToNodes(block.children ?? []);

			nodes.push({
				type: "calloutBlock",
				attrs: {
					intent: block.content?.intent ?? "info",
					title: block.content?.title ?? null,
				},
				content: body.length > 0 ? body : [{ type: "paragraph" }],
			});
		}
	}

	return nodes;
}

/**
 * Splits a unified Tiptap document back into an ordered array of ContentBlockInputs. Custom nodes
 * become their corresponding typed blocks; runs of other nodes become rich_text blocks. All
 * produced blocks are treated as new (no `id` / `position`) so the server will delete the old
 * blocks and re-insert.
 *
 * Containers recurse into their own children, and this is where the tree earns its keep: an image
 * inside a callout is split out exactly like an image at the top level, so it is stored as an
 * `image` block with a real reference to its asset rather than as a key inside somebody's
 * document.
 */
export function splitDocumentToBlocks(doc: JSONContent): Array<ContentBlockInput> {
	return splitNodesToBlocks(doc.content ?? []);
}

function splitNodesToBlocks(nodes: Array<JSONContent>): Array<ContentBlockInput> {
	const blocks: Array<ContentBlockInput> = [];
	let richTextRun: Array<JSONContent> = [];

	function flushRichText() {
		if (richTextRun.length === 0) {
			return;
		}
		blocks.push({
			id: crypto.randomUUID(),
			type: "rich_text",
			content: { type: "doc", content: richTextRun },
		});
		richTextRun = [];
	}

	for (const node of nodes) {
		if (node.type === "assetImage") {
			flushRichText();
			blocks.push({
				id: crypto.randomUUID(),
				type: "image",
				content: {
					imageKey: (node.attrs?.imageKey as string | null | undefined) ?? undefined,
					imageUrl: (node.attrs?.imageUrl as string | null | undefined) ?? undefined,
					alt: (node.attrs?.alt as string | null | undefined) ?? undefined,
					assetCaption: (node.attrs?.assetCaption as JSONContent | null | undefined) ?? undefined,
					caption: (node.attrs?.caption as JSONContent | null | undefined) ?? undefined,
					captionMode:
						(node.attrs?.captionMode as ImageCaptionMode | null | undefined) ?? "inherit",
					layout: normalizeImageLayout(node.attrs?.layout),
				},
			});
		} else if (node.type === "galleryBlock") {
			// Items are only ever storable by key, and `createGalleryItems` drops the rest. A gallery
			// that keeps none of them would persist as an empty block the author cannot see or delete,
			// so the node goes too. Unlike a media block there is no prose at stake.
			const storedItems = node.attrs?.items as Array<Record<string, unknown>> | null | undefined;
			const items = (Array.isArray(storedItems) ? storedItems : []).filter(
				(item) => typeof item.imageKey === "string" && item.imageKey !== "",
			);

			if (items.length === 0) {
				continue;
			}

			flushRichText();
			blocks.push({
				id: crypto.randomUUID(),
				type: "gallery",
				content: {
					layout: normalizeGalleryLayout(node.attrs?.layout),
					caption: (node.attrs?.caption as JSONContent | null | undefined) ?? undefined,
					items: items.map((item) => {
						const caption = (item.caption as JSONContent | null | undefined) ?? undefined;
						return {
							imageKey: item.imageKey as string,
							imageUrl: (item.imageUrl as string | null | undefined) ?? undefined,
							caption,
							captionMode: normalizeCaptionMode(item.captionMode, caption),
						};
					}),
				},
			});
		} else if (node.type === "mediaTextBlock") {
			const imageKey = node.attrs?.imageKey as string | null | undefined;
			const body = node.content ?? [];

			// `upsertTypedContentBlock` drops a media block that has no asset to bind to, which would
			// take the prose with it. Demote an image-less block to an ordinary rich text run so the
			// text an author already wrote survives the save.
			if (imageKey == null || imageKey === "") {
				richTextRun.push(...body);
				continue;
			}

			flushRichText();
			blocks.push({
				id: crypto.randomUUID(),
				type: "media_text",
				content: {
					imageKey,
					imageUrl: (node.attrs?.imageUrl as string | null | undefined) ?? undefined,
					alt: (node.attrs?.alt as string | null | undefined) ?? undefined,
					assetCaption: (node.attrs?.assetCaption as JSONContent | null | undefined) ?? undefined,
					caption: (node.attrs?.caption as JSONContent | null | undefined) ?? undefined,
					captionMode:
						(node.attrs?.captionMode as ImageCaptionMode | null | undefined) ?? "inherit",
					side: node.attrs?.side === "end" ? "end" : "start",
					content: { type: "doc", content: body },
				},
			});
		} else if (node.type === "embedBlock") {
			flushRichText();
			blocks.push({
				id: crypto.randomUUID(),
				type: "embed",
				content: {
					url: (node.attrs?.url as string | null | undefined) ?? undefined,
					title: (node.attrs?.title as string | null | undefined) ?? undefined,
					caption: (node.attrs?.caption as JSONContent | null | undefined) ?? undefined,
				},
			});
		} else if (node.type === "calloutBlock") {
			flushRichText();
			blocks.push({
				id: crypto.randomUUID(),
				type: "callout",
				content: {
					intent:
						node.attrs?.intent === "default"
							? "neutral"
							: ((node.attrs?.intent as
									| "neutral"
									| "info"
									| "warning"
									| "danger"
									| "success"
									| undefined) ?? "info"),
					title: (node.attrs?.title as string | null | undefined) ?? undefined,
				},
				children: splitNodesToBlocks(node.content ?? []) as CalloutChildren,
			});
		} else if (node.type === "accordionBlock") {
			const items = (node.content ?? []).flatMap((item) => {
				if (item.type !== "accordionItem") {
					return [];
				}

				return [
					{
						id: crypto.randomUUID(),
						type: "accordion_item" as const,
						content: { title: ((item.attrs?.title as string | null | undefined) ?? "").trim() },
						children: splitNodesToBlocks(item.content ?? []) as CalloutChildren,
					},
				];
			});

			// An accordion with no panels left is not something an author can see or delete, and there is
			// no prose in it to rescue — the panels' bodies went with them. Same call as an empty gallery.
			if (items.length === 0) {
				continue;
			}

			flushRichText();
			blocks.push({ id: crypto.randomUUID(), type: "accordion", children: items });
		} else {
			richTextRun.push(node);
		}
	}

	flushRichText();

	return blocks;
}

/**
 * A container's body, as the input schema types it. The cast is safe by construction: the editor's
 * schema keeps containers out of `block`, so nothing a container holds can itself be one.
 */
type CalloutChildren = Extract<ContentBlockInput, { type: "callout" }>["children"];

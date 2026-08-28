import { type ImageCaptionMode, resolveImageCaption } from "@dariah-eric/database/image-captions";
import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import type { ContentBlockInput } from "@/lib/content-block-input";
import { mergeBlocksToDocument, splitDocumentToBlocks } from "@/lib/content-blocks-document";

const assetCaption: JSONContent = {
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text: "Asset caption" }] }],
};
const blockCaption: JSONContent = {
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text: "Block caption" }] }],
};

describe("resolveImageCaption", () => {
	it("inherits the asset caption", () => {
		expect(
			resolveImageCaption({ assetCaption, blockCaption, captionMode: "inherit" }),
		).toStrictEqual({ caption: assetCaption, source: "asset" });
	});

	it("uses a placement override", () => {
		expect(
			resolveImageCaption({ assetCaption, blockCaption, captionMode: "override" }),
		).toStrictEqual({ caption: blockCaption, source: "block" });
	});

	it("can suppress a caption for one placement", () => {
		expect(
			resolveImageCaption({ assetCaption, blockCaption, captionMode: "hidden" }),
		).toStrictEqual({
			caption: null,
			source: null,
		});
	});
});

describe("image content-block document conversion", () => {
	it("keeps inherited asset metadata separate from the placement override", () => {
		const document = mergeBlocksToDocument([
			{
				type: "image",
				content: {
					imageKey: "images/example.jpg",
					imageUrl: "https://example.com/image.jpg",
					alt: "Alternative text",
					assetCaption,
					caption: blockCaption,
					captionMode: "inherit",
				},
			},
		]);

		expect(document.content?.[0]?.attrs).toMatchObject({
			alt: "Alternative text",
			assetCaption,
			caption: blockCaption,
			captionMode: "inherit",
		});

		expect(contentOf(splitDocumentToBlocks(document)[0])).toMatchObject({
			alt: "Alternative text",
			assetCaption,
			caption: blockCaption,
			captionMode: "inherit",
		});
	});

	it("treats legacy non-null block captions as overrides", () => {
		const document = mergeBlocksToDocument([
			{
				type: "image",
				content: { imageKey: "images/example.jpg", caption: blockCaption },
			},
		]);

		expect(document.content?.[0]?.attrs?.captionMode).toBe("override");
	});
});

/** The `content` of a produced block; a container carries none, since its body is its children. */
function contentOf(block: ContentBlockInput | undefined): unknown {
	return block != null && "content" in block ? block.content : undefined;
}

describe("callout content-block document conversion", () => {
	it("keeps callouts inline while round-tripping them as separate blocks", () => {
		const content: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "Take care" }] }],
		};
		const document = mergeBlocksToDocument([
			{ type: "rich_text", content: blockCaption },
			{
				type: "callout",
				content: { intent: "warning", title: "Important" },
				children: [{ type: "rich_text", content }],
			},
			{ type: "rich_text", content: assetCaption },
		]);

		expect(document.content?.map((node) => node.type)).toStrictEqual([
			"paragraph",
			"calloutBlock",
			"paragraph",
		]);
		expect(splitDocumentToBlocks(document).map((block) => block.type)).toStrictEqual([
			"rich_text",
			"callout",
			"rich_text",
		]);
		const callout = splitDocumentToBlocks(document)[1];

		expect(contentOf(callout)).toStrictEqual({ intent: "warning", title: "Important" });
		// The body is the callout's children now, and it survives as the block it was written as.
		expect(
			(callout as Extract<typeof callout, { type: "callout" }>).children?.map(
				(child) => child.type,
			),
		).toStrictEqual(["rich_text"]);
	});

	it("normalizes the legacy default intent to neutral", () => {
		const blocks = splitDocumentToBlocks({
			type: "doc",
			content: [
				{
					type: "calloutBlock",
					attrs: { intent: "default", title: null },
					content: blockCaption.content,
				},
			],
		});

		expect(contentOf(blocks[0])).toMatchObject({ intent: "neutral" });
	});
});

/**
 * Hero blocks and gallery items joined the caption model after rows already existed, so both carry
 * a fallback for rows written before `caption_mode`: what the fallback must produce differs, and
 * getting it backwards silently rewrites published captions.
 */
describe("caption mode of rows written before the column existed", () => {
	function fallbackCaptionMode(caption: JSONContent | null): ImageCaptionMode {
		return caption != null ? "override" : "inherit";
	}

	it("keeps showing a gallery item's own caption", () => {
		/* Gallery items always rendered their caption verbatim, so an authored caption stays visible
		   rather than being replaced by the asset's. */
		expect(
			resolveImageCaption({
				assetCaption,
				blockCaption,
				captionMode: fallbackCaptionMode(blockCaption),
			}),
		).toStrictEqual({ caption: blockCaption, source: "block" });
	});

	it("surfaces the asset caption for a gallery item that never had one", () => {
		expect(
			resolveImageCaption({
				assetCaption,
				blockCaption: null,
				captionMode: fallbackCaptionMode(null),
			}),
		).toStrictEqual({ caption: assetCaption, source: "asset" });
	});

	it("keeps serving the asset caption for a hero, which never had a caption of its own", () => {
		expect(
			resolveImageCaption({
				assetCaption,
				blockCaption: null,
				captionMode: fallbackCaptionMode(null),
			}),
		).toStrictEqual({ caption: assetCaption, source: "asset" });
	});
});

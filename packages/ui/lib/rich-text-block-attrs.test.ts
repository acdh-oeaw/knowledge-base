import type { JSONContent } from "@tiptap/core";
import { assert, describe, test } from "vitest";

import {
	type GalleryItemAttrs,
	captionFromElementText,
	normalizeButtonLinkVariant,
	normalizeCalloutIntent,
	normalizeGalleryItems,
	normalizeGalleryLayout,
	normalizeImageCaptionMode,
	normalizeImageLayout,
	normalizeMediaTextSide,
	parseCaptionAttr,
	parseGalleryItemsAttr,
	resolveImageCaption,
	serializeCaptionAttr,
	serializeGalleryItemsAttr,
} from "@/lib/rich-text-block-attrs";

function caption(text: string): JSONContent {
	return {
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text }] }],
	};
}

function galleryItem(overrides: Partial<GalleryItemAttrs> = {}): GalleryItemAttrs {
	return {
		imageKey: "images/one.jpg",
		imageUrl: "https://example.com/one.jpg",
		alt: "One",
		assetCaption: null,
		caption: null,
		captionMode: "inherit",
		...overrides,
	};
}

/**
 * These attributes leave the editor as HTML whenever a block is copied, and come back as whatever
 * the clipboard happened to hold. The parse side therefore has to survive input the editor did not
 * write — a truncated paste, an attribute from an older shape, or nothing at all.
 */
describe("caption attribute", () => {
	test("carries a caption through a copy/paste round trip", () => {
		const original = caption("A caption");

		assert.deepEqual(parseCaptionAttr(serializeCaptionAttr(original)), original);
	});

	test("writes no attribute for a block without a caption", () => {
		assert.strictEqual(serializeCaptionAttr(null), null);
	});

	test.each([
		["missing", undefined],
		["null", null],
		["empty", ""],
	])("reads a %s attribute as no caption", (_label, value) => {
		assert.strictEqual(parseCaptionAttr(value), null);
	});

	test("reads a truncated paste as no caption rather than throwing", () => {
		const truncated = JSON.stringify(caption("A caption")).slice(0, 20);

		assert.strictEqual(parseCaptionAttr(truncated), null);
	});
});

/**
 * A `<caption>` written elsewhere — an imported or pasted table — is the one caption that never
 * arrives as JSON, so it is read as text instead of being dropped.
 */
describe("caption from a foreign element", () => {
	test("reads the element's text as a caption document", () => {
		assert.deepEqual(captionFromElementText("A caption"), caption("A caption"));
	});

	test("trims the whitespace that markup indentation leaves behind", () => {
		assert.deepEqual(captionFromElementText("\n\t A caption \n"), caption("A caption"));
	});

	test.each([
		["missing", undefined],
		["null", null],
		["empty", ""],
		["whitespace-only", "   "],
	])("reads a %s element as no caption", (_label, value) => {
		assert.strictEqual(captionFromElementText(value), null);
	});
});

describe("gallery items attribute", () => {
	test("carries items through a copy/paste round trip in order", () => {
		const items = [
			galleryItem({ imageKey: "images/one.jpg", alt: "One" }),
			galleryItem({ imageKey: "images/two.jpg", alt: "Two", captionMode: "override" }),
		];

		assert.deepEqual(parseGalleryItemsAttr(serializeGalleryItemsAttr(items)), items);
	});

	test.each([
		["missing", undefined],
		["null", null],
		["empty", ""],
		["malformed", "{not json"],
	])("reads a %s attribute as no items", (_label, value) => {
		assert.deepEqual(parseGalleryItemsAttr(value), []);
	});

	test("drops an item with no image key, which would render as a hole", () => {
		const items = parseGalleryItemsAttr(
			JSON.stringify([galleryItem(), { ...galleryItem(), imageKey: null }]),
		);

		assert.lengthOf(items, 1);
		assert.strictEqual(items[0]?.imageKey, "images/one.jpg");
	});

	test("reads a value that is not an array as no items", () => {
		assert.deepEqual(parseGalleryItemsAttr(JSON.stringify({ imageKey: "images/one.jpg" })), []);
	});

	test("fills in the fields a foreign item is missing", () => {
		const items = parseGalleryItemsAttr(JSON.stringify([{ imageKey: "images/one.jpg" }]));

		assert.deepEqual(items, [
			{
				imageKey: "images/one.jpg",
				imageUrl: null,
				alt: null,
				assetCaption: null,
				caption: null,
				captionMode: "inherit",
			},
		]);
	});

	test("ignores entries that are not objects", () => {
		assert.deepEqual(normalizeGalleryItems(["images/one.jpg", null, 7]), []);
	});
});

/**
 * Every normalizer backs a closed set the database also enforces, so an unknown value means the row
 * predates the current shape or was hand-edited. Falling back beats refusing to render.
 */
describe("attribute normalizers", () => {
	test.each([
		["default", "default"],
		["wide", "wide"],
		["full", "full"],
		["float-start", "float-start"],
		["float-end", "float-end"],
	])("keeps the stored image layout %s", (value, expected) => {
		assert.strictEqual(normalizeImageLayout(value), expected);
	});

	test.each([["centred"], [null], [undefined], [7]])(
		"falls back to the default image layout for %s",
		(value) => {
			assert.strictEqual(normalizeImageLayout(value), "default");
		},
	);

	test.each([
		["carousel", "carousel"],
		["grid", "grid"],
		["mosaic", "grid"],
		[null, "grid"],
	])("normalizes the gallery layout %s", (value, expected) => {
		assert.strictEqual(normalizeGalleryLayout(value), expected);
	});

	test.each([
		["neutral", "neutral"],
		["info", "info"],
		["warning", "warning"],
		["danger", "danger"],
		["success", "success"],
	])("keeps the stored callout intent %s", (value, expected) => {
		assert.strictEqual(normalizeCalloutIntent(value), expected);
	});

	test("maps the retired `default` callout intent onto neutral", () => {
		assert.strictEqual(normalizeCalloutIntent("default"), "neutral");
	});

	test.each([["shouty"], [null], [undefined]])(
		"falls back to the info callout intent for %s",
		(value) => {
			assert.strictEqual(normalizeCalloutIntent(value), "info");
		},
	);

	test.each([
		["primary", "primary"],
		["secondary", "secondary"],
		["outline", "outline"],
		["ghost", "primary"],
		[null, "primary"],
	])("normalizes the button link variant %s", (value, expected) => {
		assert.strictEqual(normalizeButtonLinkVariant(value), expected);
	});

	test.each([
		["start", "start"],
		["end", "end"],
		["middle", "start"],
		[null, "start"],
	])("normalizes the media and text side %s", (value, expected) => {
		assert.strictEqual(normalizeMediaTextSide(value), expected);
	});

	test.each([
		["hidden", "hidden"],
		["inherit", "inherit"],
		["override", "override"],
		["custom", "inherit"],
		[null, "inherit"],
	])("normalizes the caption mode %s", (value, expected) => {
		assert.strictEqual(normalizeImageCaptionMode(value), expected);
	});
});

describe("resolveImageCaption", () => {
	const own = caption("The block's own caption");
	const asset = caption("The asset's caption");

	test("shows nothing when the caption is hidden", () => {
		assert.strictEqual(resolveImageCaption("hidden", own, asset), null);
	});

	test("shows the asset's caption when inheriting", () => {
		assert.deepEqual(resolveImageCaption("inherit", own, asset), asset);
	});

	test("shows the block's own caption when overriding", () => {
		assert.deepEqual(resolveImageCaption("override", own, asset), own);
	});

	test("shows nothing when overriding with no caption written yet", () => {
		assert.strictEqual(resolveImageCaption("override", null, asset), null);
	});
});

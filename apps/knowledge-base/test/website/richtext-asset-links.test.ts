import { collectLinkTargetAssetKeys } from "@dariah-eric/database/link-targets";
import { createRichTextExtensions } from "@dariah-eric/ui/rich-text-editor";
import type { JSONContent } from "@tiptap/core";
import { generateHTML, generateJSON } from "@tiptap/html";
import { describe, expect, it } from "vitest";

/**
 * The editor's half of asset-targeted links: the `link` mark has to carry the target through a
 * round-trip (copy/paste, and the WordPress-import path both go through HTML), while the resolved
 * download attached by read paths must never be written back into stored content.
 */

const extensions = createRichTextExtensions();

function assetLinkDocument(attrs: Record<string, unknown>): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text: "the flyer", marks: [{ type: "link", attrs }] }],
			},
		],
	};
}

function firstMarkAttrs(document: JSONContent) {
	return document.content![0]!.content![0]!.marks![0]!.attrs!;
}

describe("asset-targeted links", () => {
	it("round-trips the target through html", () => {
		const html = generateHTML(
			assetLinkDocument({ href: null, targetKind: "asset", assetKey: "documents/abc" }),
			extensions,
		);

		expect(html).toContain(`data-target-kind="asset"`);
		expect(html).toContain(`data-asset-key="documents/abc"`);

		expect(firstMarkAttrs(generateJSON(html, extensions))).toMatchObject({
			targetKind: "asset",
			assetKey: "documents/abc",
		});
	});

	it("never serialises the resolved download back into content", () => {
		const html = generateHTML(
			assetLinkDocument({
				href: "https://api.example.com/api/v1/assets/documents/abc/download",
				targetKind: "asset",
				assetKey: "documents/abc",
				asset: { url: "https://api.example.com/x", filename: "flyer.pdf", size: 1 },
			}),
			extensions,
		);

		expect(html).not.toContain("flyer.pdf");
		expect(firstMarkAttrs(generateJSON(html, extensions)).asset).toBeNull();
	});

	it("leaves an ordinary link without any target attributes", () => {
		const html = generateHTML(assetLinkDocument({ href: "https://example.com" }), extensions);

		expect(html).toContain(`href="https://example.com"`);
		expect(html).not.toContain("data-target-kind");
		expect(html).not.toContain("data-asset-key");
	});

	it("round-trips an entity target through html", () => {
		const html = generateHTML(
			assetLinkDocument({ href: null, targetKind: "entity", entityId: "019f-aaa" }),
			extensions,
		);

		expect(html).toContain(`data-entity-id="019f-aaa"`);

		expect(firstMarkAttrs(generateJSON(html, extensions))).toMatchObject({
			targetKind: "entity",
			entityId: "019f-aaa",
		});
	});

	it("never serialises the resolved page back into content", () => {
		const html = generateHTML(
			assetLinkDocument({
				href: "/news/atrium",
				targetKind: "entity",
				entityId: "019f-aaa",
				entity: { href: "/news/atrium", label: "ATRIUM summer school", type: "news" },
			}),
			extensions,
		);

		expect(html).not.toContain("ATRIUM summer school");
		expect(firstMarkAttrs(generateJSON(html, extensions)).entity).toBeNull();
	});

	it("produces a document the resolution pass recognises", () => {
		const stored = generateJSON(
			generateHTML(
				assetLinkDocument({ href: null, targetKind: "asset", assetKey: "documents/abc" }),
				extensions,
			),
			extensions,
		);

		expect(collectLinkTargetAssetKeys(stored)).toEqual(new Set(["documents/abc"]));
	});
});

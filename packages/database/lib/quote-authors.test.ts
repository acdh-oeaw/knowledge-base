import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
	collectQuoteAuthorReferences,
	mapQuoteAuthors,
	stripQuoteAuthorImageUrls,
} from "./quote-authors";

function quote(authors: Array<unknown>): JSONContent {
	return {
		type: "quoteBlock",
		attrs: { authors, description: null },
		content: [{ type: "paragraph", content: [{ type: "text", text: "A quotation." }] }],
	};
}

describe("collectQuoteAuthorReferences", () => {
	it("finds persons and pictures in quotes at any depth, including inside content blocks", () => {
		const blocks = [
			{
				type: "rich_text",
				content: {
					type: "doc",
					content: [
						quote([
							{ kind: "person", entityId: "person-1", name: "Ada" },
							{ kind: "text", name: "Charles", imageKey: "avatars/charles.jpg" },
							{ kind: "text", name: "Grace" },
						]),
						{
							type: "calloutBlock",
							content: [quote([{ kind: "person", entityId: "person-2", name: "" }])],
						},
					],
				},
			},
		];

		expect(collectQuoteAuthorReferences(blocks)).toStrictEqual({
			entityIds: new Set(["person-1", "person-2"]),
			imageKeys: new Set(["avatars/charles.jpg"]),
		});
	});

	it("ignores malformed authors and anything that is not a quote", () => {
		expect(
			collectQuoteAuthorReferences({
				type: "doc",
				content: [
					quote([
						{ kind: "person", entityId: "" },
						{ kind: "text", imageKey: "avatars/x.jpg" },
					]),
					{ type: "paragraph", attrs: { authors: [{ kind: "person", entityId: "nope" }] } },
				],
			}),
		).toStrictEqual({ entityIds: new Set(), imageKeys: new Set() });
	});
});

describe("mapQuoteAuthors", () => {
	it("rewrites the authors of every quote, dropping malformed ones", () => {
		const doc = {
			type: "doc",
			content: [
				quote([
					{ kind: "text", name: "Ada" },
					{ kind: "text", name: "  " },
				]),
			],
		};

		const result = mapQuoteAuthors(doc, (author) => {
			return { ...author, resolved: true };
		});

		expect(result.content[0]!.attrs!.authors).toStrictEqual([
			{ kind: "text", name: "Ada", resolved: true },
		]);
	});

	it("keeps the input's identity wherever nothing changed", () => {
		const doc = {
			type: "doc",
			content: [{ type: "paragraph" }, quote([{ kind: "text", name: "Ada" }])],
		};

		expect(mapQuoteAuthors(doc, (author) => author)).toBe(doc);
	});
});

describe("stripQuoteAuthorImageUrls", () => {
	it("drops the signed display url and keeps the asset key", () => {
		const doc = {
			type: "doc",
			content: [
				quote([
					{
						kind: "text",
						name: "Ada",
						imageKey: "avatars/ada.jpg",
						imageUrl: "https://images.example.org/signed",
					},
				]),
			],
		};

		expect(stripQuoteAuthorImageUrls(doc).content[0]!.attrs!.authors).toStrictEqual([
			{ kind: "text", name: "Ada", imageKey: "avatars/ada.jpg" },
		]);
	});

	it("returns a document without urls unchanged", () => {
		const doc = { type: "doc", content: [quote([{ kind: "text", name: "Ada" }])] };

		expect(stripQuoteAuthorImageUrls(doc)).toBe(doc);
	});
});

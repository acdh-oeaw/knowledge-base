import { type JSONContent, getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { toPlainText } from "@/lib/rich-text";
import { normalizeQuoteAuthors, parseQuoteAuthorsAttr } from "@/lib/rich-text-block-attrs";
import { createRichTextExtensions } from "@/lib/rich-text-editor";
import { formatQuoteAuthorNames, withoutQuoteAuthorImageUrls } from "@/lib/rich-text-quote-node";

const schema = getSchema(createRichTextExtensions());

const description: JSONContent = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Director, " },
				{
					type: "text",
					marks: [{ type: "link", attrs: { href: "https://example.org" } }],
					text: "Example Institute",
				},
			],
		},
	],
};

const quote: JSONContent = {
	type: "quoteBlock",
	attrs: {
		authors: [
			{ kind: "person", entityId: "person-1", name: "Ada Lovelace" },
			{ kind: "text", name: "Charles Babbage" },
		],
		description,
	},
	content: [{ type: "paragraph", content: [{ type: "text", text: "A quotation." }] }],
};

describe("quote block", () => {
	it("holds prose and nothing else", () => {
		expect(() => {
			schema.nodeFromJSON({ type: "doc", content: [quote] }).check();
		}).not.toThrow();

		expect(() => {
			schema
				.nodeFromJSON({
					type: "doc",
					content: [{ ...quote, content: [{ type: "horizontalRule" }] }],
				})
				.check();
		}).toThrow(/Invalid content for node quoteBlock/);
	});

	it("can sit inside a callout, since it is a block rather than a container", () => {
		expect(() => {
			schema
				.nodeFromJSON({
					type: "doc",
					content: [{ type: "calloutBlock", attrs: { intent: "info" }, content: [quote] }],
				})
				.check();
		}).not.toThrow();
	});

	it("writes its byline out as data attributes, plus a text caption for static html", () => {
		const node = schema.nodeFromJSON(quote);
		const [tag, attrs, body, caption] = schema.nodes.quoteBlock!.spec.toDOM!(node) as [
			string,
			Record<string, string>,
			[string, number],
			[string, Record<string, never>, string],
		];

		expect(tag).toBe("figure");
		expect(attrs["data-quote-block"]).toBe("");
		expect(parseQuoteAuthorsAttr(attrs["data-authors"])).toStrictEqual(quote.attrs!.authors);
		expect(JSON.parse(attrs["data-description"]!)).toStrictEqual(description);
		expect(body).toStrictEqual(["blockquote", 0]);
		expect(caption).toStrictEqual([
			"figcaption",
			{},
			"Ada Lovelace and Charles Babbage, Director, Example Institute",
		]);
	});

	it("parses its own markup, taking its content from the blockquote alone", () => {
		const [rule] = schema.nodes.quoteBlock!.spec.parseDOM!;

		expect(rule?.tag).toBe("figure[data-quote-block]");
		expect(rule?.contentElement).toBe("blockquote");
	});

	it("flattens to the quote, then its authors, then their description", () => {
		expect(toPlainText({ type: "doc", content: [quote] })).toBe(
			"A quotation.\n\nAda Lovelace, Charles Babbage\n\nDirector, Example Institute",
		);
	});
});

describe("quote authors", () => {
	it("drops entries that cannot be rendered, and trims names", () => {
		expect(
			normalizeQuoteAuthors([
				{ kind: "text", name: "  Grace Hopper " },
				{ kind: "text", name: "   " },
				{ kind: "person", entityId: "", name: "Nobody" },
				{ kind: "person", entityId: "person-2" },
				{ kind: "other", name: "Unknown" },
				null,
				"Ada",
			]),
		).toStrictEqual([
			{ kind: "text", name: "Grace Hopper" },
			{ kind: "person", entityId: "person-2", name: "" },
		]);
	});

	it("keeps a typed-in author's picture, and its display url only beside a key", () => {
		expect(
			normalizeQuoteAuthors([
				{ kind: "text", name: "Ada", imageKey: "avatars/ada.jpg", imageUrl: "https://signed" },
				{ kind: "text", name: "Grace", imageUrl: "https://orphaned" },
				{ kind: "person", entityId: "person-1", name: "Charles", imageKey: "avatars/c.jpg" },
			]),
		).toStrictEqual([
			{ kind: "text", name: "Ada", imageKey: "avatars/ada.jpg", imageUrl: "https://signed" },
			{ kind: "text", name: "Grace" },
			{ kind: "person", entityId: "person-1", name: "Charles" },
		]);
	});

	it("writes no display url into html, only the key", () => {
		const node = schema.nodeFromJSON({
			...quote,
			attrs: {
				authors: [
					{ kind: "text", name: "Ada", imageKey: "avatars/ada.jpg", imageUrl: "https://signed" },
				],
				description: null,
			},
		});
		const [, attrs] = schema.nodes.quoteBlock!.spec.toDOM!(node) as [
			string,
			Record<string, string>,
		];

		expect(parseQuoteAuthorsAttr(attrs["data-authors"])).toStrictEqual([
			{ kind: "text", name: "Ada", imageKey: "avatars/ada.jpg" },
		]);
		expect(
			withoutQuoteAuthorImageUrls([{ kind: "text", name: "Ada", imageUrl: "https://signed" }]),
		).toStrictEqual([{ kind: "text", name: "Ada" }]);
	});

	it("reads a malformed attribute as no authors", () => {
		expect(parseQuoteAuthorsAttr("not json")).toStrictEqual([]);
		expect(parseQuoteAuthorsAttr('{"kind":"text"}')).toStrictEqual([]);
		expect(parseQuoteAuthorsAttr(null)).toStrictEqual([]);
	});

	it("joins names as an english list", () => {
		expect(formatQuoteAuthorNames([])).toBe("");
		expect(formatQuoteAuthorNames([{ kind: "text", name: "A" }])).toBe("A");
		expect(
			formatQuoteAuthorNames([
				{ kind: "text", name: "A" },
				{ kind: "text", name: "B" },
				{ kind: "text", name: "C" },
			]),
		).toBe("A, B, and C");
	});
});

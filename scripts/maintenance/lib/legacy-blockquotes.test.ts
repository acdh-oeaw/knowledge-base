import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { convertLegacyBlockquotes } from "./legacy-blockquotes";

function text(value: string, marks?: Array<string>): JSONContent {
	return marks != null
		? {
				type: "text",
				text: value,
				marks: marks.map((type) => {
					return { type };
				}),
			}
		: { type: "text", text: value };
}

function paragraph(...content: Array<JSONContent>): JSONContent {
	return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

function doc(...content: Array<JSONContent>): JSONContent {
	return { type: "doc", content };
}

describe("convertLegacyBlockquotes", () => {
	it("converts a quote whose last paragraph is a dash byline", () => {
		const input = doc(paragraph(text("Before.")), {
			type: "blockquote",
			content: [
				paragraph(),
				paragraph(text("Thierry was a wonderful person.")),
				paragraph(text("In heartfelt memory!")),
				paragraph(text("— Kiki Czeitschner, Senior Scientist, ACDH-CH", ["italic"])),
			],
		});

		const result = convertLegacyBlockquotes(input);

		expect(result.content).toStrictEqual(
			doc(paragraph(text("Before.")), {
				type: "quoteBlock",
				attrs: {
					authors: [{ kind: "text", name: "Kiki Czeitschner" }],
					description: doc(paragraph(text("Senior Scientist, ACDH-CH"))),
				},
				content: [
					paragraph(text("Thierry was a wonderful person.")),
					paragraph(text("In heartfelt memory!")),
				],
			}),
		);
		expect(result.conversions).toStrictEqual([
			{
				pattern: "in-quote",
				author: "Kiki Czeitschner",
				description: "Senior Scientist, ACDH-CH",
				quote: "Thierry was a wonderful person.In heartfelt memory!",
			},
		]);
		expect(result.skipped).toStrictEqual([]);
	});

	it("credits a dash byline without a comma by name alone", () => {
		const result = convertLegacyBlockquotes(
			doc({
				type: "blockquote",
				content: [paragraph(text("A quotation.")), paragraph(text("– Ada Lovelace"))],
			}),
		);

		expect(result.content.content![0]!.attrs).toStrictEqual({
			authors: [{ kind: "text", name: "Ada Lovelace" }],
			description: null,
		});
	});

	it("converts a quote followed by a `Name (Affiliation): …` paragraph, consuming it", () => {
		const input = doc(
			{ type: "blockquote", content: [paragraph(text("I had the privilege of attending."))] },
			paragraph(
				text("Robin Luger (University of Vienna)- Report on the DH Conference 2025"),
				{ type: "hardBreak" },
				text("Topic: Accessibility"),
			),
			paragraph(text("After.")),
		);

		const result = convertLegacyBlockquotes(input);

		expect(result.content).toStrictEqual(
			doc(
				{
					type: "quoteBlock",
					attrs: {
						authors: [{ kind: "text", name: "Robin Luger" }],
						description: doc(
							paragraph(
								text("University of Vienna — "),
								text("Report on the DH Conference 2025"),
								{ type: "hardBreak" },
								text("Topic: Accessibility"),
							),
						),
					},
					content: [paragraph(text("I had the privilege of attending."))],
				},
				paragraph(text("After.")),
			),
		);
		expect(result.conversions[0]).toMatchObject({ pattern: "following", author: "Robin Luger" });
	});

	it("keeps links in a description and drops bold and italics", () => {
		const link = { type: "link", attrs: { href: "https://example.org" } };
		const result = convertLegacyBlockquotes(
			doc({
				type: "blockquote",
				content: [
					paragraph(text("A quotation.")),
					paragraph(text("— Ada Lovelace, ", ["italic"]), {
						type: "text",
						text: "Example Institute",
						marks: [{ type: "italic" }, link],
					}),
				],
			}),
		);

		expect(result.content.content![0]!.attrs!.description).toStrictEqual(
			doc(paragraph({ type: "text", text: "Example Institute", marks: [link] })),
		);
	});

	it("leaves a quote with no recognisable byline alone, and reports it", () => {
		const input = doc(
			{ type: "blockquote", content: [paragraph(text("Farewell, my friend"))] },
			paragraph(text("An ordinary paragraph.")),
		);

		const result = convertLegacyBlockquotes(input);

		expect(result.content).toBe(input);
		expect(result.conversions).toStrictEqual([]);
		expect(result.skipped).toStrictEqual([
			{ reason: "no byline found", quote: "Farewell, my friend" },
		]);
	});

	it("leaves a quote holding a nested quote alone, and reports both", () => {
		const input = doc({
			type: "blockquote",
			content: [paragraph(), { type: "blockquote", content: [paragraph(text("Inner."))] }],
		});

		const result = convertLegacyBlockquotes(input);

		expect(result.content).toBe(input);
		expect(result.skipped.map((skip) => skip.reason)).toStrictEqual([
			"holds more than paragraphs",
			"no byline found",
		]);
	});

	it("does not convert a quote that is nothing but a byline", () => {
		const result = convertLegacyBlockquotes(
			doc({ type: "blockquote", content: [paragraph(text("— Ada Lovelace"))] }),
		);

		expect(result.conversions).toStrictEqual([]);
		expect(result.skipped[0]!.reason).toBe("holds only a byline");
	});

	it("finds quotes nested in other blocks", () => {
		const result = convertLegacyBlockquotes(
			doc({
				type: "bulletList",
				content: [
					{
						type: "listItem",
						content: [
							{
								type: "blockquote",
								content: [paragraph(text("A quotation.")), paragraph(text("— Ada Lovelace"))],
							},
						],
					},
				],
			}),
		);

		expect(result.content.content![0]!.content![0]!.content![0]!.type).toBe("quoteBlock");
	});

	it("is idempotent", () => {
		const once = convertLegacyBlockquotes(
			doc({
				type: "blockquote",
				content: [paragraph(text("A quotation.")), paragraph(text("— Ada Lovelace, Analyst"))],
			}),
		).content;

		const twice = convertLegacyBlockquotes(once);

		expect(twice.content).toBe(once);
		expect(twice.conversions).toStrictEqual([]);
	});
});

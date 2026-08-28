import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { withoutBlankParagraphs } from "./rich-text";

function doc(...content: Array<JSONContent>): JSONContent {
	return { type: "doc", content };
}

function paragraph(text?: string): JSONContent {
	return text == null
		? { type: "paragraph" }
		: { type: "paragraph", content: [{ type: "text", text }] };
}

describe("withoutBlankParagraphs", () => {
	it("drops a spacer paragraph between visible paragraphs", () => {
		expect(withoutBlankParagraphs(doc(paragraph("a"), paragraph(), paragraph("b")))).toStrictEqual(
			doc(paragraph("a"), paragraph("b")),
		);
	});

	it("drops blank paragraphs at both edges", () => {
		expect(withoutBlankParagraphs(doc(paragraph(), paragraph("kept"), paragraph()))).toStrictEqual(
			doc(paragraph("kept")),
		);
	});

	it("treats a whitespace-only paragraph as blank", () => {
		expect(withoutBlankParagraphs(doc(paragraph("   "), paragraph("kept")))).toStrictEqual(
			doc(paragraph("kept")),
		);
	});

	it("treats a paragraph holding only a hard break as blank", () => {
		const input = doc({ type: "paragraph", content: [{ type: "hardBreak" }] }, paragraph("kept"));
		expect(withoutBlankParagraphs(input)).toStrictEqual(doc(paragraph("kept")));
	});

	it("keeps a paragraph whose text is only punctuation", () => {
		const input = doc(paragraph("—"));
		expect(withoutBlankParagraphs(input)).toStrictEqual(input);
	});

	it("leaves non-paragraph blocks alone", () => {
		const input = doc(
			{ type: "horizontalRule" },
			{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
		);
		expect(withoutBlankParagraphs(input)).toStrictEqual(input);
	});

	/**
	 * `tableCell`, `listItem` and `blockquote` require at least one block child, so a blank paragraph
	 * inside them is structural — dropping it would leave an invalid document.
	 */
	it("does not touch blank paragraphs nested inside a table cell", () => {
		const input = doc({
			type: "table",
			content: [
				{
					type: "tableRow",
					content: [{ type: "tableCell", content: [paragraph()] }],
				},
			],
		});
		expect(withoutBlankParagraphs(input)).toStrictEqual(input);
	});

	it("does not touch a blank paragraph inside a list item", () => {
		const input = doc({
			type: "bulletList",
			content: [{ type: "listItem", content: [paragraph()] }],
		});
		expect(withoutBlankParagraphs(input)).toStrictEqual(input);
	});

	it("reduces a document of only spacers to an empty content array", () => {
		expect(withoutBlankParagraphs(doc(paragraph(), paragraph()))).toStrictEqual(doc());
	});

	/**
	 * Callers diff against the input to skip no-op writes, so an untouched document must not be
	 * cloned.
	 */
	it("returns the same reference when there is nothing to drop", () => {
		const input = doc(paragraph("a"));
		expect(withoutBlankParagraphs(input)).toBe(input);
	});

	it("leaves a document without a content array alone", () => {
		const input: JSONContent = { type: "doc" };
		expect(withoutBlankParagraphs(input)).toBe(input);
	});

	it("is idempotent", () => {
		const once = withoutBlankParagraphs(doc(paragraph("a"), paragraph(), paragraph("b")));
		expect(withoutBlankParagraphs(once)).toStrictEqual(once);
	});
});

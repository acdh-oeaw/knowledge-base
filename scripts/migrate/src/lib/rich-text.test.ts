import { isEmptyRichTextDocument } from "@dariah-eric/database/rich-text";
import { describe, expect, it } from "vitest";

describe("isEmptyRichTextDocument", () => {
	it.each([
		undefined,
		{ type: "doc", content: [] },
		{ type: "doc", content: [{ type: "paragraph" }] },
		{ type: "doc", content: [{ type: "heading", attrs: { level: 2 } }] },
		{ type: "doc", content: [{ type: "bulletList", content: [] }] },
		{ type: "doc", content: [{ type: "codeBlock" }] },
		{
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: " \n\t " }] }],
		},
		{ type: "doc", content: [{ type: "paragraph", content: [{ type: "hardBreak" }] }] },
	])("recognizes an empty editor document", (content) => {
		expect(isEmptyRichTextDocument(content)).toBe(true);
	});

	it.each([
		{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Text" }] }] },
		{ type: "doc", content: [{ type: "image", attrs: { src: "https://example.com/image.jpg" } }] },
		{ type: "doc", content: [{ type: "horizontalRule" }] },
	])("preserves meaningful content", (content) => {
		expect(isEmptyRichTextDocument(content)).toBe(false);
	});
});

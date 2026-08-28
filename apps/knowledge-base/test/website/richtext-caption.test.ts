import { plainTextToRichText } from "@dariah-eric/database";
import { isEmptyRichTextDocument, toPlainText } from "@dariah-eric/ui/rich-text";
import type { JSONContent } from "@tiptap/core";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { RichTextCaptionFormSchema } from "@/lib/rich-text-caption";

function doc(...text: Array<JSONContent>): JSONContent {
	return { type: "doc", content: [{ type: "paragraph", content: text }] };
}

describe("plainTextToRichText", () => {
	it("wraps plaintext into a single-paragraph document", () => {
		expect(plainTextToRichText("Hello world")).toStrictEqual(
			doc({ type: "text", text: "Hello world" }),
		);
	});

	it("returns null for blank or nullish input", () => {
		expect(plainTextToRichText("")).toBeNull();
		expect(plainTextToRichText("   ")).toBeNull();
		expect(plainTextToRichText(null)).toBeNull();
		expect(plainTextToRichText(undefined)).toBeNull();
	});

	it("round-trips back to the original text via toPlainText", () => {
		const wrapped = plainTextToRichText("A caption.");
		expect(toPlainText(wrapped)).toBe("A caption.");
	});
});

describe("isEmptyRichTextDocument", () => {
	it("treats null and empty-paragraph documents as empty", () => {
		expect(isEmptyRichTextDocument(null)).toBe(true);
		expect(isEmptyRichTextDocument({ type: "doc", content: [] })).toBe(true);
		expect(isEmptyRichTextDocument({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true);
		expect(isEmptyRichTextDocument(doc({ type: "text", text: "   " }))).toBe(true);
	});

	it("treats documents with text as non-empty", () => {
		expect(isEmptyRichTextDocument(doc({ type: "text", text: "hi" }))).toBe(false);
	});
});

describe("RichTextCaptionFormSchema", () => {
	function parse(value: string | undefined): JSONContent | null {
		return v.parse(RichTextCaptionFormSchema, value);
	}

	it("parses a serialized caption document", () => {
		const content = doc({ type: "text", text: "Bold caption" });
		expect(parse(JSON.stringify(content))).toStrictEqual(content);
	});

	it("collapses empty, blank, and empty-document input to null", () => {
		expect(parse(undefined)).toBeNull();
		expect(parse("")).toBeNull();
		expect(parse(JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }))).toBeNull();
	});

	it("returns null for unparseable input instead of throwing", () => {
		expect(parse("not json")).toBeNull();
	});
});

import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { isEmptyRichTextDocument, toPlainText } from "@/lib/rich-text";
import { createRichTextExtensions } from "@/lib/rich-text-editor";

const schema = getSchema(createRichTextExtensions());

describe("lead-in", () => {
	it("renders as a paragraph the `richtext` styles know as lead text", () => {
		const node = schema.nodes.leadIn!.create(null, schema.text("An introduction."));
		const [tag, attrs] = schema.nodes.leadIn!.spec.toDOM!(node) as [
			string,
			Record<string, unknown>,
		];

		expect(tag).toBe("p");
		expect(attrs).toStrictEqual({ class: "lead", "data-lead-in": "" });
	});

	/**
	 * Checked on the rules rather than by parsing, since the unit tests run without a DOM:
	 * ProseMirror tries rules by priority, so the lead-in's must come before the paragraph's
	 * catch-all `p`.
	 */
	it("parses its own markup back ahead of the paragraph, without claiming any `lead` paragraph", () => {
		const [leadInRule] = schema.nodes.leadIn!.spec.parseDOM!;
		const [paragraphRule] = schema.nodes.paragraph!.spec.parseDOM!;

		expect(leadInRule?.tag).toBe("p[data-lead-in]");
		expect(paragraphRule?.tag).toBe("p");
		expect(leadInRule?.priority ?? 50).toBeGreaterThan(paragraphRule?.priority ?? 50);
	});

	it("is its own block in plain text, and empty when it holds nothing", () => {
		expect(
			toPlainText({
				type: "doc",
				content: [
					{ type: "leadIn", content: [{ type: "text", text: "Lead." }] },
					{ type: "paragraph", content: [{ type: "text", text: "Body." }] },
				],
			}),
		).toBe("Lead.\n\nBody.");
		expect(isEmptyRichTextDocument({ type: "doc", content: [{ type: "leadIn" }] })).toBeTruthy();
	});
});

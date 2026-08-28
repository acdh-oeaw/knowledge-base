import { createRichTextExtensions } from "@dariah-eric/ui/rich-text-editor";
import type { JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import { renderToHTMLString } from "@tiptap/static-renderer";
import { describe, expect, it } from "vitest";

const extensions = createRichTextExtensions();

function cell(type: "tableCell" | "tableHeader", text: string): JSONContent {
	return { type, content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function tableDocumentWithCaption(caption: JSONContent | null): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "table",
				attrs: { caption },
				content: [
					{
						type: "tableRow",
						content: [cell("tableHeader", "Term"), cell("tableHeader", "Meaning")],
					},
					{
						type: "tableRow",
						content: [cell("tableCell", "Post Status"), cell("tableCell", "Open")],
					},
				],
			},
		],
	};
}

/** The caption editor's output shape: one paragraph of inline content. */
const richCaption: JSONContent = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Table 1: ", marks: [{ type: "bold" }] },
				{ type: "text", text: "post statuses" },
			],
		},
	],
};

const tableDocument = tableDocumentWithCaption(null);

function firstTableAttrs(document: JSONContent) {
	return document.content![0]!.attrs!;
}

/**
 * The static renderer resolves each node through the shared extension set and throws on a node type
 * it does not know, so these assertions are what keeps the read-only views (and the API's stored
 * documents) able to carry the tables the editor and the WordPress backfill now produce.
 */
describe("table rendering", () => {
	it("renders a table document to table markup", () => {
		const html = renderToHTMLString({ content: tableDocument, extensions });

		expect(html).toContain("<table");
		expect(html).toContain("<th");
		expect(html).toContain("<td");
		expect(html).toContain("Post Status");
	});

	it("throws on table nodes when the extension set omits them", () => {
		const withoutTables = extensions.filter(
			(extension) => extension.name !== "tableKit" && extension.name !== "table",
		);

		expect(() => {
			renderToHTMLString({ content: tableDocument, extensions: withoutTables });
		}).toThrow();
	});
});

/**
 * A caption names its table for a screen reader, which is why it renders as a `<caption>` element
 * rather than as a paragraph above the table. It is stored in an attribute — `prosemirror-tables`
 * reads a table's children as its rows — so these assertions cover the two things that has to buy:
 * the semantic element in rendered markup, and a caption that survives a round-trip through HTML
 * with its formatting intact.
 */
describe("table captions", () => {
	it("renders the caption as the table's first child", () => {
		const html = renderToHTMLString({
			content: tableDocumentWithCaption(richCaption),
			extensions,
		});

		expect(html).toContain("<caption>Table 1: post statuses</caption>");
		expect(html.indexOf("<caption>")).toBeLessThan(html.indexOf("<tbody>"));
	});

	it("renders no caption element for a table without one", () => {
		expect(renderToHTMLString({ content: tableDocument, extensions })).not.toContain("<caption");
	});

	it("round-trips a formatted caption through html", () => {
		const html = renderToHTMLString({
			content: tableDocumentWithCaption(richCaption),
			extensions,
		});

		// The element itself carries only the flattened text — a DOM output spec has nowhere to render
		// richtext JSON — so the marks travel in `data-caption` and are what a paste reads back.
		expect(firstTableAttrs(generateJSON(html, extensions)).caption).toEqual(richCaption);
	});

	it("keeps the caption of a table imported from elsewhere", () => {
		const json = generateJSON(
			"<table><caption>Imported caption</caption><tbody><tr><td>Cell</td></tr></tbody></table>",
			extensions,
		);

		expect(firstTableAttrs(json).caption).toEqual({
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "Imported caption" }] }],
		});
	});

	it("leaves a table without a caption element uncaptioned", () => {
		const json = generateJSON("<table><tbody><tr><td>Cell</td></tr></tbody></table>", extensions);

		expect(firstTableAttrs(json).caption).toBeNull();
	});
});

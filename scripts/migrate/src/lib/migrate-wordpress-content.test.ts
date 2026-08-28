import type { Extensions, JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import { describe, expect, it } from "vitest";

import { wordPressParseExtensions } from "./migrate-wordpress-content";

/** A Gutenberg table block: no `<thead>`, two columns of label/value pairs. */
const wordPressTable = `<figure class="wp-block-table"><table><tbody><tr><td>Post Status&nbsp;</td><td>Fixed-term contract</td></tr><tr><td>Location</td><td>Remote in Germany or France.</td></tr></tbody></table></figure>`;

function parse(html: string, extensions: Extensions): JSONContent {
	return generateJSON(html, extensions) as JSONContent;
}

/** Node types of a node's direct children, so a parse can be asserted shape-first. */
function childTypes(node: JSONContent | undefined): Array<string | undefined> {
	return (node?.content ?? []).map((child) => child.type);
}

describe("wordPressParseExtensions", () => {
	it("parses a WordPress table into table nodes rather than flattening it", () => {
		const doc = parse(wordPressTable, wordPressParseExtensions);

		expect(childTypes(doc)).toStrictEqual(["table"]);

		const table = doc.content?.[0];
		expect(childTypes(table)).toStrictEqual(["tableRow", "tableRow"]);
		expect(childTypes(table?.content?.[0])).toStrictEqual(["tableCell", "tableCell"]);
	});

	it("reads `th` cells as header cells", () => {
		const doc = parse(
			"<table><tbody><tr><th>Term</th><td>Definition</td></tr></tbody></table>",
			wordPressParseExtensions,
		);

		expect(childTypes(doc.content?.[0]?.content?.[0])).toStrictEqual(["tableHeader", "tableCell"]);
	});

	/**
	 * The regression this guards: an extension set without table node types does not error on
	 * `<table>` markup, it silently unwraps it — every cell's text run together in one paragraph.
	 * That is what the original migration produced, and why tables had to be backfilled.
	 */
	it("would flatten the same markup into one paragraph without the table extensions", () => {
		const doc = parse(
			wordPressTable,
			wordPressParseExtensions.filter((extension) => extension.name !== "tableKit"),
		);

		expect(childTypes(doc)).toStrictEqual(["paragraph"]);
	});
});

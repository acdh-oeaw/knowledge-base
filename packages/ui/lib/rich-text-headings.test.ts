import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { attachHeadingIds, collectHeadings } from "@/lib/rich-text";

function text(value: string): JSONContent {
	return { type: "text", text: value };
}

function heading(level: number, ...content: Array<JSONContent>): JSONContent {
	return { type: "heading", attrs: { level }, content };
}

function paragraph(...content: Array<JSONContent>): JSONContent {
	return { type: "paragraph", content };
}

/** A stored content block, whose `content` is a whole document rather than a list of nodes. */
function richTextBlock(...content: Array<JSONContent>) {
	return { type: "rich_text", content: { type: "doc", content } };
}

/** The `id` of every heading below `input`, in the order the walk found them. */
function idsIn(input: unknown): Array<unknown> {
	const found: Array<unknown> = [];

	function visit(node: unknown): void {
		if (Array.isArray(node)) {
			node.forEach((item) => {
				visit(item);
			});
			return;
		}

		if (node == null || typeof node !== "object") {
			return;
		}

		const record = node as Record<string, unknown>;

		if (record.type === "heading") {
			found.push((record.attrs as Record<string, unknown> | undefined)?.id);
			return;
		}

		Object.values(record).forEach((value) => {
			visit(value);
		});
	}

	visit(input);

	return found;
}

describe("collectHeadings", () => {
	it("slugs a heading's text, keeping its level", () => {
		const headings = collectHeadings({
			type: "doc",
			content: [heading(2, text("Getting started")), heading(3, text("Requirements"))],
		});

		expect(headings).toStrictEqual([
			{ id: "getting-started", level: 2, text: "Getting started" },
			{ id: "requirements", level: 3, text: "Requirements" },
		]);
	});

	it("collects across the content blocks of a whole page", () => {
		// Blocks are a storage split of one document, so a page's outline runs across all of them.
		const headings = collectHeadings([
			richTextBlock(heading(2, text("First"))),
			{ type: "image", content: { imageUrl: "/example.jpg" } },
			richTextBlock(heading(2, text("Second"))),
		]);

		expect(headings.map((entry) => entry.id)).toStrictEqual(["first", "second"]);
	});

	it("strips accents and punctuation, and folds runs of them into one separator", () => {
		const headings = collectHeadings({
			type: "doc",
			content: [heading(2, text("Über die DARIAH-ERIC: was nun?"))],
		});

		expect(headings[0]?.id).toBe("uber-die-dariah-eric-was-nun");
	});

	it("suffixes a repeated heading so every anchor is unique", () => {
		const headings = collectHeadings({
			type: "doc",
			content: [heading(2, text("Overview")), heading(2, text("Overview"))],
		});

		expect(headings.map((entry) => entry.id)).toStrictEqual(["overview", "overview-2"]);
	});

	it("falls back to a fixed slug for a heading with no sluggable characters", () => {
		const headings = collectHeadings({
			type: "doc",
			content: [heading(2, text("???")), heading(2, text("!!!"))],
		});

		expect(headings.map((entry) => entry.id)).toStrictEqual(["section", "section-2"]);
	});

	it("skips a heading with no text, which has nothing to label or anchor it with", () => {
		const headings = collectHeadings({
			type: "doc",
			content: [heading(2), heading(2, text("Real")), paragraph(text("body"))],
		});

		expect(headings.map((entry) => entry.id)).toStrictEqual(["real"]);
	});

	it("leaves a footnote attached to a heading out of the label and the anchor", () => {
		// The note belongs to the prose, not to the outline — and flattening it would drag a whole
		// paragraph into the slug.
		const headings = collectHeadings({
			type: "doc",
			content: [
				heading(2, text("Funding"), {
					type: "footnote",
					attrs: { content: { type: "doc", content: [paragraph(text("Grant no. 123"))] } },
				}),
			],
		});

		expect(headings).toStrictEqual([{ id: "funding", level: 2, text: "Funding" }]);
	});
});

describe("attachHeadingIds", () => {
	it("gives every heading the id collectHeadings reports for it", () => {
		const blocks = [
			richTextBlock(heading(2, text("Overview")), heading(3, text("Details"))),
			richTextBlock(heading(2, text("Overview"))),
		];

		expect(idsIn(attachHeadingIds(blocks))).toStrictEqual(
			collectHeadings(blocks).map((entry) => entry.id),
		);
	});

	it("leaves an empty heading alone, so the two walks stay in step", () => {
		const blocks = [richTextBlock(heading(2), heading(2, text("Real")))];

		expect(idsIn(attachHeadingIds(blocks))).toStrictEqual([undefined, "real"]);
	});

	it("keeps the rest of the node, and the document around it, intact", () => {
		const attached = attachHeadingIds({
			type: "doc",
			content: [heading(2, text("Title")), paragraph(text("body"))],
		}) as { content: Array<JSONContent> };

		expect(attached.content[0]).toStrictEqual({
			type: "heading",
			attrs: { level: 2, id: "title" },
			content: [text("Title")],
		});
		expect(attached.content[1]).toStrictEqual(paragraph(text("body")));
	});
});

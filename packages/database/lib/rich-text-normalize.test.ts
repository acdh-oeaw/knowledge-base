import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { normalizeRichTextDocument } from "./rich-text-normalize";

function doc(...content: Array<JSONContent>): JSONContent {
	return { type: "doc", content };
}

describe("normalizeRichTextDocument", () => {
	it("strips a bold mark from heading text (presentational concern of the frontend)", () => {
		const input = doc({
			type: "heading",
			attrs: { level: 3 },
			content: [{ type: "text", marks: [{ type: "bold" }], text: "Contact" }],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Contact" }] }),
		);
	});

	it("keeps non-bold marks (link, italic) inside headings", () => {
		const input = doc({
			type: "heading",
			attrs: { level: 2 },
			content: [
				{ type: "text", marks: [{ type: "link", attrs: { href: "https://x" } }], text: "Read" },
			],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(input);
	});

	it("turns a leading <br> in a heading into nothing (merge-to-space then trim)", () => {
		const input = doc({
			type: "heading",
			attrs: { level: 3 },
			content: [
				{ type: "hardBreak" },
				{ type: "text", marks: [{ type: "bold" }], text: "Contact" },
			],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Contact" }] }),
		);
	});

	it("merges a mid-heading <br> into a single space", () => {
		const input = doc({
			type: "heading",
			attrs: { level: 2 },
			content: [
				{ type: "text", text: "Line one" },
				{ type: "hardBreak" },
				{ type: "text", text: "Line two" },
			],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({
				type: "heading",
				attrs: { level: 2 },
				content: [{ type: "text", text: "Line one Line two" }],
			}),
		);
	});

	it("converts non-breaking spaces to regular spaces", () => {
		const input = doc({
			type: "paragraph",
			content: [{ type: "text", text: `video\u{00A0}and\u{00A0}audio` }],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({ type: "paragraph", content: [{ type: "text", text: "video and audio" }] }),
		);
	});

	it("removes imported HTML presentation and browser attributes from link marks", () => {
		const input = doc({
			type: "paragraph",
			content: [
				{
					type: "text",
					marks: [
						{
							type: "link",
							attrs: {
								href: "https://shewrote.rich.ru.nl/",
								target: "_blank",
								rel: "noopener noreferrer nofollow",
								class: "cursor-pointer OWAAutoLink elementToProof",
							},
						},
					],
					text: "SHEWROTE",
				},
			],
		});

		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({
				type: "paragraph",
				content: [
					{
						type: "text",
						marks: [{ type: "link", attrs: { href: "https://shewrote.rich.ru.nl/" } }],
						text: "SHEWROTE",
					},
				],
			}),
		);
	});

	it("removes imported CSS classes from nodes while preserving other attributes", () => {
		const input = doc({
			type: "image",
			attrs: { src: "https://x/image.png", alt: "Example", class: "aligncenter wp-image-12" },
		});

		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({ type: "image", attrs: { src: "https://x/image.png", alt: "Example" } }),
		);
	});

	it("removes empty spacer paragraphs (with and without a content key)", () => {
		const input = doc(
			{ type: "paragraph" },
			{ type: "paragraph", content: [{ type: "text", text: "Kept" }] },
			{ type: "paragraph", content: [{ type: "text", text: "  " }] },
		);
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({ type: "paragraph", content: [{ type: "text", text: "Kept" }] }),
		);
	});

	it("drops leading/trailing <br> in a paragraph but keeps a single intentional line break", () => {
		const input = doc({
			type: "paragraph",
			content: [
				{ type: "hardBreak" },
				{ type: "text", text: "one" },
				{ type: "hardBreak" },
				{ type: "text", text: "two" },
				{ type: "hardBreak" },
			],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({
				type: "paragraph",
				content: [
					{ type: "text", text: "one" },
					{ type: "hardBreak" },
					{ type: "text", text: "two" },
				],
			}),
		);
	});

	it("collapses consecutive <br> to a single line break", () => {
		const input = doc({
			type: "paragraph",
			content: [
				{ type: "text", text: "a" },
				{ type: "hardBreak" },
				{ type: "hardBreak" },
				{ type: "text", text: "b" },
			],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({
				type: "paragraph",
				content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }],
			}),
		);
	});

	it("preserves a real space between differently-marked inline runs", () => {
		const input = doc({
			type: "paragraph",
			content: [
				{ type: "text", text: "External links" },
				{ type: "text", text: " " },
				{ type: "text", marks: [{ type: "link", attrs: { href: "https://x" } }], text: "here" },
			],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({
				type: "paragraph",
				content: [
					{ type: "text", text: "External links " },
					{ type: "text", marks: [{ type: "link", attrs: { href: "https://x" } }], text: "here" },
				],
			}),
		);
	});

	it("drops empty list items and the list once it is empty", () => {
		const input = doc({
			type: "bulletList",
			content: [
				{ type: "listItem", content: [{ type: "paragraph" }] },
				{
					type: "listItem",
					content: [{ type: "paragraph", content: [{ type: "text", text: " " }] }],
				},
			],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(doc());
	});

	it("keeps non-empty list items", () => {
		const input = doc({
			type: "bulletList",
			content: [
				{
					type: "listItem",
					content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
				},
				{ type: "listItem", content: [{ type: "paragraph" }] },
			],
		});
		expect(normalizeRichTextDocument(input)).toStrictEqual(
			doc({
				type: "bulletList",
				content: [
					{
						type: "listItem",
						content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
					},
				],
			}),
		);
	});

	it("leaves atoms like images and horizontal rules untouched", () => {
		const input = doc(
			{ type: "image", attrs: { src: "https://x/a.png", alt: "A" } },
			{ type: "horizontalRule" },
		);
		expect(normalizeRichTextDocument(input)).toStrictEqual(input);
	});

	it("is idempotent", () => {
		const input = doc(
			{ type: "paragraph" },
			{
				type: "heading",
				attrs: { level: 3 },
				content: [{ type: "hardBreak" }, { type: "text", marks: [{ type: "bold" }], text: "T " }],
			},
			{
				type: "paragraph",
				content: [
					{ type: "hardBreak" },
					{ type: "text", text: "body text" },
					{ type: "hardBreak" },
				],
			},
		);
		const once = normalizeRichTextDocument(input);
		expect(normalizeRichTextDocument(once)).toStrictEqual(once);
	});

	it("returns a document without oddities unchanged", () => {
		const input = doc(
			{ type: "paragraph", content: [{ type: "text", text: "Clean paragraph." }] },
			{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Clean heading" }] },
		);
		expect(normalizeRichTextDocument(input)).toStrictEqual(input);
	});

	/**
	 * Cells are `block+`, so an emptied one must not be left with `content: []` — that is not a valid
	 * document. Nor can it be dropped like an empty list item: the row would then be short of its
	 * siblings. An empty cell is ordinary content in a data table, so it keeps a placeholder.
	 */
	function table(...cells: Array<JSONContent>): JSONContent {
		return doc({ type: "table", content: [{ type: "tableRow", content: cells }] });
	}

	it("keeps an emptied table cell as a placeholder paragraph rather than an empty cell", () => {
		const input = table(
			{
				type: "tableCell",
				content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
			},
			{
				type: "tableCell",
				content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }],
			},
		);

		expect(normalizeRichTextDocument(input)).toStrictEqual(
			table(
				{
					type: "tableCell",
					content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
				},
				{ type: "tableCell", content: [{ type: "paragraph" }] },
			),
		);
	});

	it("leaves an already-empty table cell structurally unchanged", () => {
		const input = table({ type: "tableCell", content: [{ type: "paragraph" }] });
		expect(normalizeRichTextDocument(input)).toStrictEqual(input);
	});

	it("keeps an emptied table header cell too", () => {
		const input = table({ type: "tableHeader", content: [{ type: "paragraph" }] });
		expect(normalizeRichTextDocument(input)).toStrictEqual(input);
	});

	it("is idempotent over emptied table cells", () => {
		const input = table({
			type: "tableCell",
			content: [{ type: "paragraph", content: [{ type: "text", text: " " }] }],
		});
		const once = normalizeRichTextDocument(input);
		expect(normalizeRichTextDocument(once)).toStrictEqual(once);
	});

	/**
	 * A caption, and the note a footnote carries, are documents of their own kept in an attribute —
	 * outside the `content` walk, and so outside every cleanup above until now. They are written in
	 * the same editors and pasted into from the same sources, so they collect the same oddities.
	 */
	describe("documents nested in attributes", () => {
		function caption(text: string): JSONContent {
			return doc({ type: "paragraph", content: [{ type: "text", text }] });
		}

		it("cleans an image caption the way it cleans prose", () => {
			const input = doc({
				type: "assetImage",
				attrs: {
					imageKey: "images/one.jpg",
					caption: doc(
						{ type: "paragraph" },
						{ type: "paragraph", content: [{ type: "text", text: "A caption " }] },
					),
				},
			});

			expect(normalizeRichTextDocument(input)).toStrictEqual(
				doc({
					type: "assetImage",
					attrs: { imageKey: "images/one.jpg", caption: caption("A caption") },
				}),
			);
		});

		it("strips imported link attributes inside a caption", () => {
			const input = doc({
				type: "assetImage",
				attrs: {
					caption: doc({
						type: "paragraph",
						content: [
							{
								type: "text",
								marks: [
									{
										type: "link",
										attrs: {
											href: "https://example.com",
											target: "_blank",
											rel: "noopener noreferrer nofollow",
										},
									},
								],
								text: "the report",
							},
						],
					}),
				},
			});

			expect(normalizeRichTextDocument(input)).toStrictEqual(
				doc({
					type: "assetImage",
					attrs: {
						caption: doc({
							type: "paragraph",
							content: [
								{
									type: "text",
									marks: [{ type: "link", attrs: { href: "https://example.com" } }],
									text: "the report",
								},
							],
						}),
					},
				}),
			);
		});

		it("reaches the captions a gallery keeps in an array of items", () => {
			const input = doc({
				type: "galleryBlock",
				attrs: {
					items: [
						{ imageKey: "images/one.jpg", caption: caption("First item") },
						{ imageKey: "images/two.jpg", caption: caption("Second item") },
					],
				},
			});

			expect(normalizeRichTextDocument(input)).toStrictEqual(
				doc({
					type: "galleryBlock",
					attrs: {
						items: [
							{ imageKey: "images/one.jpg", caption: caption("First item") },
							{ imageKey: "images/two.jpg", caption: caption("Second item") },
						],
					},
				}),
			);
		});

		it("reaches a footnote's note, and a footnote inside a caption", () => {
			const input = doc({
				type: "assetImage",
				attrs: {
					caption: doc({
						type: "paragraph",
						content: [
							{ type: "text", text: "cited" },
							{ type: "footnote", attrs: { content: caption("The source") } },
						],
					}),
				},
			});

			expect(normalizeRichTextDocument(input)).toStrictEqual(
				doc({
					type: "assetImage",
					attrs: {
						caption: doc({
							type: "paragraph",
							content: [
								{ type: "text", text: "cited" },
								{ type: "footnote", attrs: { content: caption("The source") } },
							],
						}),
					},
				}),
			);
		});

		it("empties a caption that held nothing but a spacer", () => {
			const input = doc({ type: "assetImage", attrs: { caption: doc({ type: "paragraph" }) } });

			expect(normalizeRichTextDocument(input)).toStrictEqual(
				doc({ type: "assetImage", attrs: { caption: { type: "doc", content: [] } } }),
			);
		});

		it("leaves a caption without oddities structurally unchanged", () => {
			const input = doc({
				type: "assetImage",
				attrs: { alt: "One", caption: caption("A caption"), captionMode: "override" },
			});

			expect(normalizeRichTextDocument(input)).toStrictEqual(input);
		});

		it("leaves an attribute that is not a document alone", () => {
			const input = doc({
				type: "assetImage",
				attrs: { imageKey: "images/one.jpg", caption: null, layout: "wide" },
			});

			expect(normalizeRichTextDocument(input)).toStrictEqual(input);
		});

		it("is idempotent over nested documents", () => {
			const input = doc({
				type: "assetImage",
				attrs: { caption: caption("A caption ") },
			});
			const once = normalizeRichTextDocument(input);

			expect(normalizeRichTextDocument(once)).toStrictEqual(once);
		});
	});
});

import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { convertLegacyFootnotes, noteToPlainText } from "./legacy-footnotes";

type Mark = NonNullable<JSONContent["marks"]>[number];

function text(value: string, marks?: Array<Mark>): JSONContent {
	return marks == null ? { type: "text", text: value } : { type: "text", text: value, marks };
}

function link(href: string): Array<Mark> {
	return [{ type: "link", attrs: { href, title: null } }];
}

function paragraph(...content: Array<JSONContent>): JSONContent {
	return { type: "paragraph", content };
}

function heading(value: string): JSONContent {
	return { type: "heading", attrs: { level: 2 }, content: [text(value)] };
}

function doc(...content: Array<JSONContent>): JSONContent {
	return { type: "doc", content };
}

function block(id: string, ...content: Array<JSONContent>) {
	return { id, content: doc(...content) };
}

/** The inline nodes of the first paragraph of the converted block, for terse assertions. */
function inline(result: ReturnType<typeof convertLegacyFootnotes>, blockIndex = 0, index = 0) {
	return result.blocks[blockIndex]!.content.content![index]!.content!;
}

function notes(result: ReturnType<typeof convertLegacyFootnotes>): Array<string> {
	return result.numbering.map((entry) => noteToPlainText(result.notes.get(entry.label)!));
}

describe("convertLegacyFootnotes", () => {
	it("lifts a reference entry into the marker that cites it", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("The hackathon has been running yearly since 2015 [1].")),
				heading("References"),
				paragraph(text("[1] In 2020 it was not organised.")),
			),
		]);

		expect(result.problems).toStrictEqual([]);
		expect(inline(result)).toStrictEqual([
			text("The hackathon has been running yearly since 2015"),
			{
				type: "footnote",
				attrs: { content: doc(paragraph(text("In 2020 it was not organised."))) },
			},
			text("."),
		]);
		// The heading and the entry go with it: the site renders its own footnotes section.
		expect(result.blocks[0]!.content.content).toHaveLength(1);
	});

	it("drops the space that only separated a word from its marker", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("We used the Burney [3] collection.")),
				heading("References"),
				paragraph(text("[3] Gale Primary Sources.")),
			),
		]);

		expect(inline(result)[0]).toStrictEqual(text("We used the Burney"));
		expect(inline(result)[2]).toStrictEqual(text(" collection."));
	});

	it("keeps the marks of the text it splits, and leaves the marker unmarked", () => {
		// The Hidden Traces import put a marker inside the link text ("Burney [3]"), so the split has
		// to leave the word linked without dragging the link onto the superscript.
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("Burney [3]", link("https://gale.example/burney"))),
				heading("References"),
				paragraph(text("[3] Gale Primary Sources.")),
			),
		]);

		expect(inline(result)).toStrictEqual([
			text("Burney", link("https://gale.example/burney")),
			{
				type: "footnote",
				attrs: { content: doc(paragraph(text("Gale Primary Sources."))) },
			},
		]);
	});

	it("takes a label that is its own node, with its back-link, and the space after it", () => {
		// The Theatralia import wrote both sides as links (`#_ftn1` / `#_ftnref1`), which pointed at
		// ids nothing rendered. Both disappear into the footnote node.
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("Established in 2021"), text("[1]", link("#_ftn1")), text(". Bringing…")),
				heading("References"),
				paragraph(text("[1]", link("#_ftnref1")), text(" Theatralia emerged in 2018.")),
			),
		]);

		expect(result.problems).toStrictEqual([]);
		expect(inline(result)).toStrictEqual([
			text("Established in 2021"),
			{
				type: "footnote",
				attrs: { content: doc(paragraph(text("Theatralia emerged in 2018."))) },
			},
			text(". Bringing…"),
		]);
	});

	it("preserves links inside a note", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("A claim [1].")),
				heading("References"),
				paragraph(text("[1] See "), text("the paper", link("https://hal.example/1"))),
			),
		]);

		expect(inline(result)[1]!.attrs!.content).toStrictEqual(
			doc(paragraph(text("See "), text("the paper", link("https://hal.example/1")))),
		);
	});

	it("numbers markers by reading order across blocks, not by their legacy label", () => {
		const result = convertLegacyFootnotes([
			block("a", paragraph(text("First [2]."))),
			block(
				"b",
				paragraph(text("Then [1].")),
				heading("References"),
				paragraph(text("[1] One.")),
				paragraph(text("[2] Two.")),
			),
		]);

		expect(result.numbering).toStrictEqual([
			{ label: 2, number: 1 },
			{ label: 1, number: 2 },
		]);
		expect(notes(result)).toStrictEqual(["Two.", "One."]);
	});

	it("repeats a note for a label cited twice, shifting the labels after it", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("A [1].")),
				paragraph(text("Again [1].")),
				paragraph(text("Later [2].")),
				heading("References"),
				paragraph(text("[1] One.")),
				paragraph(text("[2] Two.")),
			),
		]);

		expect(result.problems).toStrictEqual([]);
		expect(result.numbering).toStrictEqual([
			{ label: 1, number: 1 },
			{ label: 1, number: 2 },
			{ label: 2, number: 3 },
		]);
		expect(notes(result)).toStrictEqual(["One.", "One.", "Two."]);
	});

	it("expands a grouped citation into one marker per number", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("Two masterclasses [1, 2].")),
				heading("References"),
				paragraph(text("[1] Berlin 2017.")),
				paragraph(text("[2] Berlin 2018.")),
			),
		]);

		expect(result.numbering).toStrictEqual([
			{ label: 1, number: 1 },
			{ label: 2, number: 2 },
		]);
		expect(inline(result)).toHaveLength(4);
	});

	it("resolves every number of a range-headed entry to that one note", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("Conference abstracts [3-5].")),
				heading("References"),
				paragraph(text("[3-5] The DHd blog.")),
			),
		]);

		expect(result.problems).toStrictEqual([]);
		expect(notes(result)).toStrictEqual(["The DHd blog.", "The DHd blog.", "The DHd blog."]);
	});

	it("leaves a marker with no reference entry as text, and says so", () => {
		const result = convertLegacyFootnotes([
			block("a", paragraph(text("Cited [9].")), heading("References"), paragraph(text("[1] One."))),
		]);

		expect(inline(result)).toStrictEqual([text("Cited [9].")]);
		expect(result.warnings).toStrictEqual(["Left as text: [9] — no reference entry for 9."]);
		// The entry it should have cited is the blocking half: that text would be deleted.
		expect(result.problems).toStrictEqual([
			"Reference entry [1] is never cited; its text would be lost.",
		]);
	});

	it("reports an uncited entry rather than silently deleting it", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("Cited [1].")),
				heading("References"),
				paragraph(text("[1] One.")),
				paragraph(text("[2] Never cited.")),
			),
		]);

		expect(result.problems).toStrictEqual([
			"Reference entry [2] is never cited; its text would be lost.",
		]);
	});

	it("leaves a bracketed year alone, and does not block on it", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("A survey [2005] and a note [1].")),
				heading("References"),
				paragraph(text("[1] One.")),
			),
		]);

		expect(result.problems).toStrictEqual([]);
		expect(result.warnings).toStrictEqual(["Left as text: [2005] — no reference entry for 2005."]);
		expect(inline(result)[0]).toStrictEqual(text("A survey [2005] and a note"));
	});

	it("keeps a heading it does not recognise, and says so", () => {
		const result = convertLegacyFootnotes([
			block(
				"a",
				paragraph(text("Cited [1].")),
				heading("Evidence of the Impact"),
				paragraph(text("[1] One.")),
			),
		]);

		expect(result.problems).toStrictEqual([
			'The 1 reference entries are not preceded by a "References" heading (found heading “Evidence of the Impact”); it was left in place.',
		]);
		expect(result.blocks[0]!.content.content!.at(-1)).toStrictEqual(
			heading("Evidence of the Impact"),
		);
	});

	it("is a no-op on an article with no reference list", () => {
		const blocks = [block("a", paragraph(text("Nothing to see here.")))];
		const result = convertLegacyFootnotes(blocks);

		expect(result.blocks[0]!.changed).toBe(false);
		expect(result.blocks[0]!.content).toStrictEqual(blocks[0]!.content);
	});

	it("is a no-op when run again on its own output", () => {
		const blocks = [
			block(
				"a",
				paragraph(text("A claim [1].")),
				heading("References"),
				paragraph(text("[1] One.")),
			),
		];

		const once = convertLegacyFootnotes(blocks);
		const twice = convertLegacyFootnotes(once.blocks);

		expect(twice.blocks[0]!.changed).toBe(false);
		expect(twice.blocks[0]!.content).toStrictEqual(once.blocks[0]!.content);
	});

	it("reports a block the conversion would empty rather than emptying it", () => {
		const result = convertLegacyFootnotes([
			block("a", paragraph(text("Cited [1]."))),
			block("b", heading("References"), paragraph(text("[1] One."))),
		]);

		expect(result.problems).toStrictEqual([
			"Block b would be left empty; deleting blocks is out of this script's scope.",
		]);
	});
});

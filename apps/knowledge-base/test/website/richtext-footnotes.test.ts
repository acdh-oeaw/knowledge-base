import { collectFootnotes, toPlainText } from "@dariah-eric/ui/rich-text";
import { createRichTextExtensions } from "@dariah-eric/ui/rich-text-editor";
import { withoutFootnotes } from "@dariah-eric/ui/rich-text-footnote";
import { type JSONContent, getSchema } from "@tiptap/core";
import { generateHTML, generateJSON } from "@tiptap/html";
import { renderToHTMLString } from "@tiptap/static-renderer";
import { describe, expect, it } from "vitest";

const extensions = createRichTextExtensions();

function note(text: string): JSONContent {
	return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function footnote(text: string): JSONContent {
	return { type: "footnote", attrs: { content: note(text) } };
}

function paragraph(...content: Array<JSONContent>): JSONContent {
	return { type: "paragraph", content };
}

const citation =
	"Tolonen, Mikko. 2019. Teaching Digital Humanities at the University of Helsinki. EuropeNow.";

const document: JSONContent = {
	type: "doc",
	content: [
		paragraph(
			{ type: "text", text: "The hackathon has been running yearly since 2015" },
			footnote("In the year 2020 the hackathon was not organised due to the COVID-19 pandemic."),
			{ type: "text", text: " and has been discussed in articles" },
			footnote(citation),
			{ type: "text", text: "." },
		),
	],
};

/**
 * A footnote is an inline node holding its note in an attribute, so the two paths that matter are
 * the ones a stored document is read back through: the static renderer (which throws on a node type
 * the shared extension set does not know) and the plain-text flattener behind search indexing.
 */
describe("footnote rendering", () => {
	it("renders each marker as an empty superscript carrying its note", () => {
		const html = renderToHTMLString({ content: document, extensions });

		expect(html).toContain("<sup");
		expect(html).toContain("data-footnote");
		// The number is not in the markup: it comes from the `footnotes` CSS counter, so that moving a
		// marker renumbers the rest with nothing stored to update.
		expect(html).not.toContain(">1<");
		expect(html).toContain("COVID-19");
	});

	it("throws on footnote nodes when the extension set omits them", () => {
		const withoutFootnotes = extensions.filter((extension) => extension.name !== "footnote");

		expect(() => {
			renderToHTMLString({ content: document, extensions: withoutFootnotes });
		}).toThrow();
	});

	it("closes the marker tag", () => {
		// `<sup/>` is not self-closing in HTML — a parser reads it as an open tag and superscripts the
		// rest of the paragraph — so the serialized marker has to carry its own closing tag.
		const html = renderToHTMLString({ content: document, extensions });

		expect(html).toContain("></sup>");
		expect(html).not.toContain("/>");
	});

	it("round-trips a marker and its note through HTML", () => {
		// Copy/paste and the WordPress import both go through HTML, so a note that survives only in the
		// editor's own JSON would be lost on the way back in.
		const html = generateHTML(document, extensions);
		const parsed = generateJSON(html, extensions) as JSONContent;

		expect(collectFootnotes(parsed).map((content) => toPlainText(content))).toStrictEqual([
			"In the year 2020 the hackathon was not organised due to the COVID-19 pandemic.",
			citation,
		]);
	});
});

/**
 * Footnotes are opt-in per field (`blocks={["footnote", ...]}`), because whether a citation
 * apparatus belongs to a text is a property of the kind of text it is. Hiding the insert action
 * covers the deliberate route in; this covers the other one, a paste out of a field that has them.
 */
describe("the paste guard", () => {
	const schema = getSchema(extensions);

	/** The content of a parsed document, which is the fragment a paste of it would carry. */
	function fragmentOf(content: JSONContent) {
		return schema.nodeFromJSON(content).content;
	}

	it("drops footnotes out of pasted content, keeping the prose around them", () => {
		const guarded = withoutFootnotes(fragmentOf(document));
		const text = guarded.textBetween(0, guarded.size, " ");

		expect(collectFootnotes(guarded.toJSON())).toStrictEqual([]);
		expect(text).toContain("since 2015");
		expect(text).toContain("discussed in articles");
	});

	it("reaches footnotes nested in a pasted table cell", () => {
		const nested = fragmentOf({
			type: "doc",
			content: [
				{
					type: "table",
					content: [
						{
							type: "tableRow",
							content: [{ type: "tableCell", content: [paragraph(footnote("in a cell"))] }],
						},
					],
				},
			],
		});

		expect(collectFootnotes(withoutFootnotes(nested).toJSON())).toStrictEqual([]);
	});

	it("leaves content without footnotes untouched", () => {
		const plain = fragmentOf({
			type: "doc",
			content: [paragraph({ type: "text", text: "A biography." })],
		});

		expect(withoutFootnotes(plain).eq(plain)).toBe(true);
	});

	it("still parses a stored document that holds footnotes", () => {
		// The node stays in every editor's schema, guard or no guard, so turning the feature off for a
		// field cannot make content that already has footnotes fail to open.
		expect(() => {
			schema.nodeFromJSON(document);
		}).not.toThrow();
	});
});

describe("collectFootnotes", () => {
	it("returns the notes of one document in the order their markers appear", () => {
		expect(collectFootnotes(document).map((content) => toPlainText(content))).toStrictEqual([
			"In the year 2020 the hackathon was not organised due to the COVID-19 pandemic.",
			citation,
		]);
	});

	it("numbers across the content blocks of a whole article, not per block", () => {
		// Blocks are a storage split of one document (`splitDocumentToBlocks`), so a note in a later
		// block continues the count rather than restarting it — which is what makes an author-visible
		// number match the one a reader sees.
		const blocks = [
			{ type: "rich_text", content: { type: "doc", content: [paragraph(footnote("first"))] } },
			{ type: "image", content: { imageUrl: "/example.jpg", caption: null } },
			{ type: "rich_text", content: { type: "doc", content: [paragraph(footnote("second"))] } },
		];

		expect(collectFootnotes(blocks).map((content) => toPlainText(content))).toStrictEqual([
			"first",
			"second",
		]);
	});

	it("finds notes nested in table cells and media bodies", () => {
		const nested: JSONContent = {
			type: "doc",
			content: [
				{
					type: "mediaTextBlock",
					attrs: { imageKey: "logo", side: "start" },
					content: [paragraph(footnote("in a media body"))],
				},
				{
					type: "table",
					content: [
						{
							type: "tableRow",
							content: [{ type: "tableCell", content: [paragraph(footnote("in a cell"))] }],
						},
					],
				},
			],
		};

		expect(collectFootnotes(nested).map((content) => toPlainText(content))).toStrictEqual([
			"in a media body",
			"in a cell",
		]);
	});

	it("keeps a marker whose note was never written, so the count stays in step with the markup", () => {
		const withEmpty: JSONContent = {
			type: "doc",
			content: [paragraph({ type: "footnote", attrs: { content: null } }, footnote("second"))],
		};

		expect(collectFootnotes(withEmpty)).toStrictEqual([null, note("second")]);
	});

	it("returns nothing for a document without footnotes", () => {
		expect(collectFootnotes({ type: "doc", content: [paragraph()] })).toStrictEqual([]);
	});
});

describe("toPlainText", () => {
	it("includes a note in the flattened text, so evidence is indexed with its claim", () => {
		const text = toPlainText(document);

		expect(text).toContain("since 2015");
		expect(text).toContain("COVID-19 pandemic.");
		expect(text).toContain("Tolonen");
	});

	it("does not run a note into the word the marker follows", () => {
		expect(toPlainText(document)).not.toContain("2015In");
	});
});

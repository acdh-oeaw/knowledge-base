import { getSchema } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode, type Schema, Slice } from "@tiptap/pm/model";
import { assert, describe, test } from "vitest";

import { createInlineRichTextExtensions, flattenPastedSlice } from "@/lib/inline-rich-text-editor";
import { inlineFootnoteExtensions } from "@/lib/rich-text-footnote-node";

const schema = getSchema(createInlineRichTextExtensions());

/**
 * A paste as ProseMirror hands it to the guard: already parsed against the caption editor's own
 * schema, which is why these fixtures are built from that schema rather than from html.
 */
function paste(nodes: Array<ProseMirrorNode>, pasteSchema: Schema = schema): Slice {
	return flattenPastedSlice(new Slice(Fragment.fromArray(nodes), 0, 0), pasteSchema);
}

function paragraph(...content: Array<ProseMirrorNode>): ProseMirrorNode {
	return schema.nodes.paragraph!.create(null, content);
}

function text(value: string, marks: Array<string> = []): ProseMirrorNode {
	return schema.text(
		value,
		marks.map((mark) => schema.marks[mark]!.create()),
	);
}

function textOf(slice: Slice): string {
	return slice.content.textBetween(0, slice.content.size);
}

function marksOf(slice: Slice): Array<Array<string>> {
	const marks: Array<Array<string>> = [];

	slice.content.forEach((node) => {
		marks.push(node.marks.map((mark) => mark.type.name));
	});

	return marks;
}

/**
 * A caption is one line: the editor swallows Enter, and every renderer walks a document of a single
 * paragraph. Paste is the way around the key handler, so this guard is what holds the shape.
 */
describe("pasting into a caption", () => {
	test("runs several pasted paragraphs onto one line", () => {
		const pasted = paste([paragraph(text("First para")), paragraph(text("Second para"))]);

		assert.strictEqual(textOf(pasted), "First para Second para");
	});

	test("leaves no block node for a renderer to meet", () => {
		const pasted = paste([paragraph(text("One")), paragraph(text("Two"))]);

		pasted.content.forEach((node) => {
			assert.isTrue(node.isInline, `expected inline content, got ${node.type.name}`);
		});
	});

	test("closes both depths, so the line merges into the paragraph at the cursor", () => {
		const pasted = paste([paragraph(text("One"))]);

		assert.strictEqual(pasted.openStart, 0);
		assert.strictEqual(pasted.openEnd, 0);
	});

	test("keeps the marks on the runs it joins", () => {
		const pasted = paste([
			paragraph(text("bold", ["bold"])),
			paragraph(text("link", ["link"]), text(" plain")),
		]);

		assert.deepEqual(marksOf(pasted), [["bold"], [], ["link"], []]);
	});

	test("joins with an unmarked space, so a link cannot grow past its text", () => {
		const pasted = paste([paragraph(text("link", ["link"])), paragraph(text("after"))]);

		/* The separator is its own text node until `Fragment` merges it into the unmarked run that
		   follows — what matters is that the space falls outside the link, not how it is stored. */
		const afterLink = pasted.content.child(1);

		assert.strictEqual(textOf(pasted), "link after");
		assert.deepEqual(afterLink.marks, []);
		assert.isTrue(afterLink.text?.startsWith(" "));
	});

	test("adds no separator where the text already has one", () => {
		const pasted = paste([paragraph(text("First ")), paragraph(text(" second"))]);

		assert.strictEqual(textOf(pasted), "First  second");
	});

	test("passes inline content through untouched", () => {
		const pasted = paste([text("just some words")]);

		assert.strictEqual(textOf(pasted), "just some words");
	});

	test("drops a paragraph that holds nothing", () => {
		const pasted = paste([paragraph(text("One")), paragraph(), paragraph(text("Two"))]);

		assert.strictEqual(textOf(pasted), "One Two");
	});

	test("keeps a pasted footnote marker where the field takes footnotes", () => {
		const withFootnotes = getSchema(createInlineRichTextExtensions(inlineFootnoteExtensions));
		const cited = withFootnotes.nodes.paragraph!.create(null, [
			withFootnotes.text("cited"),
			withFootnotes.nodes.footnote!.create({ content: null }),
		]);

		const pasted = paste([cited], withFootnotes);

		assert.strictEqual(pasted.content.child(1).type.name, "footnote");
	});

	test("is registered on the caption editor's extension set", () => {
		const names = createInlineRichTextExtensions().map((extension) => extension.name);

		assert.include(names, "singleLinePasteGuard");
	});
});

/**
 * Whether a link opens in a new tab is the reader's call, and these are declared attributes: left
 * at the extension's defaults, every caption link would store `target`/`rel` in the database —
 * which is how they reached it before the block editor nulled the same pair.
 */
describe("caption links", () => {
	test("store no target or rel", () => {
		const attrs = schema.marks.link!.spec.attrs;

		assert.strictEqual(attrs?.target?.default, null);
		assert.strictEqual(attrs?.rel?.default, null);
	});
});

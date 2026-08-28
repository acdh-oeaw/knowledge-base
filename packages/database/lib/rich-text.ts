import type { JSONContent } from "@tiptap/core";

const STRUCTURAL_NODE_TYPES = new Set([
	"blockquote",
	"bulletList",
	"codeBlock",
	"doc",
	"heading",
	"listItem",
	"orderedList",
	"paragraph",
	"table",
	"tableCell",
	"tableHeader",
	"tableRow",
]);

/**
 * Whether a Tiptap document contains no meaningful content. Empty structural nodes, whitespace-only
 * text, and hard breaks are editor placeholders; leaf nodes such as images remain meaningful.
 */
export function isEmptyRichTextDocument(content: JSONContent | null | undefined): boolean {
	if (content == null) {
		return true;
	}

	function hasMeaningfulContent(node: JSONContent): boolean {
		if (node.type === "text") {
			return (node.text ?? "").trim() !== "";
		}
		if (node.type === "hardBreak") {
			return false;
		}
		if (node.content != null) {
			return node.content.some(hasMeaningfulContent);
		}

		// Unknown leaf nodes and known atoms (for example images and horizontal rules) are content.
		return node.type != null && !STRUCTURAL_NODE_TYPES.has(node.type);
	}

	return !hasMeaningfulContent(content);
}

/**
 * An empty spacer paragraph: `{ "type": "paragraph" }`, or one holding only whitespace and hard
 * breaks — the same things {@link isEmptyRichTextDocument} treats as editor placeholders.
 */
function isBlankParagraph(node: JSONContent): boolean {
	if (node.type !== "paragraph") {
		return false;
	}

	return (node.content ?? []).every(
		(child) =>
			child.type === "hardBreak" || (child.type === "text" && (child.text ?? "").trim() === ""),
	);
}

/**
 * Drops blank paragraphs from the top level of a rich-text document, so they are never stored.
 *
 * An empty paragraph is not content: it renders as an empty line box _plus_ its own margins, which
 * shows up on the site as uneven spacing between paragraphs. The editor is not WYSIWYG, so there is
 * no round-trip to protect — vertical rhythm is the stylesheet's job, not something authors set by
 * leaving blank lines.
 *
 * Deliberately narrower than {@link normalizeRichTextDocument}, which also rewrites headings, hard
 * breaks and imported attributes: that one is a reviewed batch pass (`data:clean:richtext` and the
 * admin Maintenance page both run it dry first), and silently applying all of it on every save
 * would change author copy in ways nobody asked for.
 *
 * Only the top level is touched. A blank paragraph inside a `tableCell`, `listItem` or `blockquote`
 * is structural — those require at least one block child, so dropping it would leave an invalid
 * document. Returns the input unchanged (same reference) when there is nothing to drop, so callers
 * can diff to skip no-op writes.
 */
export function withoutBlankParagraphs(content: JSONContent): JSONContent {
	if (!Array.isArray(content.content)) {
		return content;
	}

	const nodes = content.content.filter((node) => !isBlankParagraph(node));

	return nodes.length === content.content.length ? content : { ...content, content: nodes };
}

/**
 * Wrap a plaintext string into a minimal single-paragraph Tiptap document, mirroring the shape the
 * `captions_to_richtext` migration produces. Blank/nullish input becomes `null`.
 */
export function plainTextToRichText(text: string | null | undefined): JSONContent | null {
	if (text == null || text.trim() === "") {
		return null;
	}

	return {
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text }] }],
	};
}

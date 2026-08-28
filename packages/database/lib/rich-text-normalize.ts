import type { JSONContent } from "@tiptap/core";

/**
 * Normalises a TipTap (rich-text) document into clean, semantic JSON. Removes authoring oddities
 * that accumulate from pasting or an old CMS import: headings that were really bolded paragraphs,
 * `<br>` used for layout, `&nbsp;` sprinkled as spacing, empty spacer paragraphs, and
 * presentational HTML attributes (`class`, `rel`, `target`) copied from source markup.
 *
 * The transform is pure and idempotent: running it twice yields the same document, and a document
 * with no oddities is returned structurally unchanged (so callers can diff to skip no-op writes).
 * Shared by the `@dariah-eric/maintenance` cli and the admin dashboard.
 */

const NON_BREAKING_SPACE = /\u00A0/g;

function stripImportedHtmlAttributes(attrs: JSONContent["attrs"]): JSONContent["attrs"] {
	if (
		attrs == null ||
		(!Object.hasOwn(attrs, "class") &&
			!Object.hasOwn(attrs, "rel") &&
			!Object.hasOwn(attrs, "target"))
	) {
		return attrs;
	}

	const { class: _class, rel: _rel, target: _target, ...rest } = attrs;
	return Object.keys(rest).length > 0 ? rest : undefined;
}

/** Removes presentational and browser-behaviour attributes imported from source HTML. */
function stripImportedHtmlAttributesFromNode(node: JSONContent): JSONContent {
	const attrs = stripImportedHtmlAttributes(node.attrs);
	let marks = node.marks;

	if (marks != null) {
		const cleanedMarks = marks.map((mark) => {
			const markAttrs = stripImportedHtmlAttributes(mark.attrs);
			if (markAttrs === mark.attrs) {
				return mark;
			}

			const cleanedMark = { ...mark };
			if (markAttrs == null) {
				delete cleanedMark.attrs;
			} else {
				cleanedMark.attrs = markAttrs;
			}
			return cleanedMark;
		});
		if (cleanedMarks.some((mark, index) => mark !== marks?.[index])) {
			marks = cleanedMarks;
		}
	}

	if (attrs === node.attrs && marks === node.marks) {
		return node;
	}

	const cleanedNode = { ...node };
	if (attrs == null) {
		delete cleanedNode.attrs;
	} else {
		cleanedNode.attrs = attrs;
	}
	if (marks == null) {
		delete cleanedNode.marks;
	} else {
		cleanedNode.marks = marks;
	}
	return cleanedNode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Whether a value is a richtext document. Captions and footnote notes are stored as documents of
 * their own inside a node's attributes — `{ type: "doc", … }` is what marks one out.
 */
function isRichTextDocument(value: unknown): value is JSONContent {
	return isRecord(value) && value.type === "doc";
}

/**
 * Normalises the documents nested in a node's attributes: an image, gallery, media or table
 * caption, and the note a footnote marker carries.
 *
 * These sit outside the content walk — the walk follows `content`, and a caption is not part of the
 * document it captions — so without this they kept every oddity the surrounding prose had cleaned
 * away: an imported `target`/`rel` on a link, a non-breaking space, a spacer paragraph.
 *
 * Recognised by shape rather than by a list of attribute names, so a caption arriving on a new kind
 * of block is covered by the day it exists, and so the captions a gallery keeps in an array of item
 * objects need no case of their own.
 *
 * Values are rebuilt only where something below them changed, keeping the structural identity the
 * caller's no-op diff depends on.
 */
function normalizeAttributeValue(value: unknown): unknown {
	if (isRichTextDocument(value)) {
		/* A nested document is cleaned by the same walk as the one holding it — a caption is prose,
		   written in the same editors, so it is normalised by the same rules. */
		return cleanNode(value) ?? { type: "doc", content: [] };
	}

	if (Array.isArray(value)) {
		const items = value.map((item) => normalizeAttributeValue(item));
		return items.some((item, index) => item !== value[index]) ? items : value;
	}

	if (isRecord(value)) {
		const entries = Object.entries(value).map(
			([key, item]) => [key, normalizeAttributeValue(item)] as const,
		);

		return entries.some(([key, item]) => item !== value[key]) ? Object.fromEntries(entries) : value;
	}

	return value;
}

function normalizeNestedDocuments(node: JSONContent): JSONContent {
	if (node.attrs == null) {
		return node;
	}

	const attrs = normalizeAttributeValue(node.attrs) as JSONContent["attrs"];

	return attrs === node.attrs ? node : { ...node, attrs };
}

function marksKey(node: JSONContent): string {
	return JSON.stringify(node.marks ?? []);
}

function isHardBreak(node: JSONContent | undefined): boolean {
	return node?.type === "hardBreak";
}

function isWhitespaceText(node: JSONContent | undefined): boolean {
	return node?.type === "text" && (node.text ?? "").trim() === "";
}

/** Removes a mark type from a text node, dropping the `marks` key entirely when none remain. */
function stripMark(node: JSONContent, mark: string): JSONContent {
	if (node.type !== "text" || node.marks == null) {
		return node;
	}
	const marks = node.marks.filter((m) => m.type !== mark);
	if (marks.length === node.marks.length) {
		return node;
	}
	const { marks: _dropped, ...rest } = node;
	return marks.length > 0 ? { ...rest, marks } : rest;
}

/** Merges consecutive text nodes that carry identical marks into a single node. */
function mergeAdjacentText(children: Array<JSONContent>): Array<JSONContent> {
	const out: Array<JSONContent> = [];
	for (const child of children) {
		const prev = out.at(-1);
		if (child.type === "text" && prev?.type === "text" && marksKey(prev) === marksKey(child)) {
			out[out.length - 1] = { ...prev, text: (prev.text ?? "") + (child.text ?? "") };
		} else {
			out.push(child);
		}
	}
	return out;
}

/**
 * Normalises the inline children of a heading or paragraph:
 *
 * - Headings: strip `bold` (a presentational concern of the frontend) and turn `<br>` into a space;
 * - Paragraphs: collapse consecutive `<br>` to one and drop `<br>` at the edges, but keep a single
 *   intentional mid-text line break;
 * - Both: collapse whitespace-only text nodes, drop whitespace/`<br>` at the edges, and trim the
 *   outer edges of the first/last text node.
 */
function normalizeInlineChildren(
	children: Array<JSONContent>,
	container: "heading" | "paragraph",
): Array<JSONContent> {
	let nodes = children;

	if (container === "heading") {
		nodes = nodes.map((node) => stripMark(node, "bold"));
		// A `<br>` in a heading was layout, not a line break: turn it into a plain space that the
		// surrounding whitespace handling then collapses/trims away.
		nodes = nodes.map((node) => (isHardBreak(node) ? { type: "text", text: " " } : node));
	} else {
		// Collapse runs of consecutive hard breaks to a single break.
		nodes = nodes.filter((node, index) => !(isHardBreak(node) && isHardBreak(nodes[index - 1])));
	}

	// Collapse every whitespace-only text node to a single plain space, then merge neighbours so that
	// injected spaces fold into adjacent same-mark text.
	nodes = nodes.map((node) => (isWhitespaceText(node) ? { type: "text", text: " " } : node));
	nodes = mergeAdjacentText(nodes);

	// Trim the edges: drop leading/trailing hard breaks and whitespace-only text until stable.
	while (nodes[0] != null && (isHardBreak(nodes[0]) || isWhitespaceText(nodes[0]))) {
		nodes = nodes.slice(1);
	}
	while (nodes.at(-1) != null && (isHardBreak(nodes.at(-1)) || isWhitespaceText(nodes.at(-1)))) {
		nodes = nodes.slice(0, -1);
	}

	// Trim the outer whitespace of the remaining first/last text node.
	if (nodes[0]?.type === "text") {
		nodes = [{ ...nodes[0], text: (nodes[0].text ?? "").replace(/^\s+/, "") }, ...nodes.slice(1)];
	}
	const last = nodes.at(-1);
	if (last?.type === "text") {
		nodes = [...nodes.slice(0, -1), { ...last, text: (last.text ?? "").replace(/\s+$/, "") }];
	}

	return mergeAdjacentText(nodes);
}

const DROP_WHEN_EMPTY = new Set(["listItem", "bulletList", "orderedList", "blockquote"]);

/**
 * Table cells are `block+` in the schema and cannot be dropped when cleaning empties them: a cell
 * removed from one row leaves it short of its siblings and corrupts the table. An empty cell is
 * legitimate content — a gap in a data table — so it keeps a placeholder paragraph instead, which
 * is exactly what an empty cell holds in the editor.
 */
const KEEP_PLACEHOLDER_WHEN_EMPTY = new Set(["tableCell", "tableHeader"]);

/**
 * Recursively cleans a node. Returns `null` when the node should be dropped: an emptied paragraph
 * or heading, or a list/list-item/blockquote that cleaning has left with no content.
 */
function cleanNode(node: JSONContent): JSONContent | null {
	const cleanedNode = normalizeNestedDocuments(stripImportedHtmlAttributesFromNode(node));

	if (cleanedNode.type === "text") {
		return { ...cleanedNode, text: (cleanedNode.text ?? "").replace(NON_BREAKING_SPACE, " ") };
	}

	// Paragraphs and headings are handled here even without a `content` key, so that empty spacer
	// paragraphs (`{ "type": "paragraph" }`) are dropped rather than passed through.
	if (cleanedNode.type === "heading" || cleanedNode.type === "paragraph") {
		const children = (cleanedNode.content ?? [])
			.map((child) => cleanNode(child))
			.filter((child): child is JSONContent => child != null);
		const normalized = normalizeInlineChildren(children, cleanedNode.type);
		if (normalized.length === 0) {
			return null;
		}
		return { ...cleanedNode, content: normalized };
	}

	if (cleanedNode.content == null) {
		// Atoms and leaf nodes (image, horizontalRule, hardBreak) pass through untouched.
		return cleanedNode;
	}

	const children = cleanedNode.content
		.map((child) => cleanNode(child))
		.filter((child): child is JSONContent => child != null);

	// Drop containers that cleaning has left empty — an empty bullet, list, or quote is noise.
	// `doc` is never dropped; it stays as an empty document for the caller to handle.
	if (children.length === 0 && cleanedNode.type != null) {
		if (DROP_WHEN_EMPTY.has(cleanedNode.type)) {
			return null;
		}
		if (KEEP_PLACEHOLDER_WHEN_EMPTY.has(cleanedNode.type)) {
			return { ...cleanedNode, content: [{ type: "paragraph" }] };
		}
	}

	return { ...cleanedNode, content: children };
}

/**
 * Normalises a TipTap document. Pure and idempotent; a document without oddities is returned
 * structurally identical so callers can `JSON.stringify`-diff to avoid no-op writes.
 */
export function normalizeRichTextDocument(doc: JSONContent): JSONContent {
	return cleanNode(doc) ?? { type: "doc", content: [] };
}

import { formatPlaceholderValue } from "@dariah-eric/database/placeholder-values";
import type { JSONContent } from "@tiptap/core";

export { formatPlaceholderValue };

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function appendBlockSeparator(parts: Array<string>) {
	// oxlint-disable-next-line prefer-at
	const lastPart = parts[parts.length - 1];

	if (lastPart !== "\n\n") {
		parts.push("\n\n");
	}
}

function visit(node: unknown, parts: Array<string>) {
	if (Array.isArray(node)) {
		for (const item of node) {
			visit(item, parts);
		}

		return;
	}

	if (!isRecord(node)) {
		return;
	}

	if (node.type === "hardBreak") {
		parts.push("\n");
		return;
	}

	if (node.type === "buttonLink" && isRecord(node.attrs) && typeof node.attrs.label === "string") {
		parts.push(node.attrs.label);
		return;
	}

	if (node.type === "footnote" && isRecord(node.attrs)) {
		// A footnote keeps its note in an attribute, which the content walk below never reaches. Flatten
		// it in place, padded, so the note is searchable alongside the sentence it belongs to instead of
		// running into the word before the marker.
		parts.push(" ");
		visit(node.attrs.content, parts);
		parts.push(" ");
		return;
	}

	if (node.type === "placeholderValue" && isRecord(node.attrs)) {
		// Annotated nodes flatten to their resolved value; raw references fall back to the display
		// label so search/alt text stays meaningful.
		const resolved = formatPlaceholderValue(node.attrs);
		const label = node.attrs.label ?? node.attrs.kind;
		const text = resolved ?? (typeof label === "string" ? label : null);
		if (text != null) {
			parts.push(text);
		}
		return;
	}

	if (typeof node.text === "string") {
		parts.push(node.text);
	}

	visit(node.content, parts);

	if (
		node.type === "blockquote" ||
		node.type === "bulletList" ||
		node.type === "codeBlock" ||
		node.type === "heading" ||
		node.type === "listItem" ||
		node.type === "orderedList" ||
		node.type === "paragraph"
	) {
		appendBlockSeparator(parts);
	}
}

/** Flatten Tiptap richtext JSON to plain text (used for `alt` fallbacks and search indexing). */
export function toPlainText(input: unknown): string {
	const parts: Array<string> = [];

	visit(input, parts);

	return parts
		.join("")
		.replaceAll(/\r\n?/g, "\n")
		.replaceAll(/[ \t]+\n/g, "\n")
		.replaceAll(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Every footnote's note in reading order — which is the order the markers are numbered in.
 *
 * Accepts arbitrary JSON (one richtext document, the ordered content blocks of a whole article,
 * ...) and walks every value, like `collectLinkTargetAssetKeys` does, so a caller can hand over
 * whatever shape it holds. A footnote is never nested inside another (its note is written with the
 * caption editor, which has no footnote to offer), so walking everything cannot reorder the
 * result.
 *
 * Read paths use this to build the note list; the marker numbers come from the `footnotes` CSS
 * counter, and both count the same markers in the same order.
 */
export function collectFootnotes(input: unknown): Array<JSONContent | null> {
	const notes: Array<JSONContent | null> = [];

	function visit(node: unknown) {
		if (Array.isArray(node)) {
			for (const item of node) {
				visit(item);
			}
			return;
		}

		if (!isRecord(node)) {
			return;
		}

		if (node.type === "footnote") {
			notes.push(
				isRecord(node.attrs) ? ((node.attrs.content as JSONContent | null) ?? null) : null,
			);
			return;
		}

		for (const value of Object.values(node)) {
			visit(value);
		}
	}

	visit(input);

	return notes;
}

/**
 * A copy of `input` with every footnote marker carrying its 1-based position in `attrs.number`, so
 * a renderer can anchor a marker to its note and back.
 *
 * Walks in the same order as {@link collectFootnotes}, so `number` indexes that list directly. The
 * number stays derived rather than stored — read paths attach it, the same way link targets are
 * resolved at read time — because a marker's number is only ever its place in the document.
 */
export function numberFootnotes<T>(input: T): T {
	let number = 0;

	function visit(node: unknown): unknown {
		if (Array.isArray(node)) {
			return node.map((item) => visit(item));
		}

		if (!isRecord(node)) {
			return node;
		}

		if (node.type === "footnote") {
			number += 1;
			return { ...node, attrs: { ...(isRecord(node.attrs) ? node.attrs : {}), number } };
		}

		return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, visit(value)]));
	}

	return visit(input) as T;
}

export interface RichTextHeading {
	/** The anchor {@link attachHeadingIds} puts on the heading, without a leading `#`. */
	id: string;
	/** 1-6, as stored on the node. The editor only offers 2-4. */
	level: number;
	/** The heading's text, for the table-of-contents entry that links to it. */
	text: string;
}

/**
 * A heading's text, which is both its anchor id and its table-of-contents label.
 *
 * Footnote markers are dropped: a note attached to a heading belongs to the prose, not to the
 * outline, and `toPlainText` would otherwise flatten the whole note into the label and the slug.
 */
function headingText(node: Record<string, unknown>): string {
	function withoutFootnotes(value: unknown): unknown {
		if (Array.isArray(value)) {
			return value
				.filter((item) => !(isRecord(item) && item.type === "footnote"))
				.map((item) => withoutFootnotes(item));
		}

		if (!isRecord(value)) {
			return value;
		}

		return Object.fromEntries(
			Object.entries(value).map(([key, child]) => [key, withoutFootnotes(child)]),
		);
	}

	return toPlainText(withoutFootnotes(node.content));
}

function headingLevel(node: Record<string, unknown>): number {
	const level = isRecord(node.attrs) ? node.attrs.level : undefined;

	return typeof level === "number" ? level : 1;
}

/**
 * Hands out the anchor id for each heading, in the order the headings are walked.
 *
 * Two headings can carry the same text — "Overview" under each of several sections is ordinary —
 * and an id has to be unique on the page, so a repeat is suffixed with its occurrence count. That
 * makes an id depend on what came before it, which is why both walks below take their ids from one
 * of these and have to visit headings in the same order.
 */
function createHeadingIdFactory(): (text: string) => string {
	const occurrences = new Map<string, number>();

	return function nextHeadingId(text: string): string {
		const base =
			text
				// Decompose accented characters so the combining marks can be dropped separately, leaving
				// the base letter behind: "Über" slugs to "uber" rather than losing the "u" entirely.
				.normalize("NFKD")
				.replaceAll(/\p{Mark}/gu, "")
				.toLowerCase()
				.replaceAll(/[^\p{Letter}\p{Number}]+/gu, "-")
				.replaceAll(/^-+|-+$/g, "") || "section";

		const count = (occurrences.get(base) ?? 0) + 1;
		occurrences.set(base, count);

		return count === 1 ? base : `${base}-${String(count)}`;
	};
}

/**
 * Every heading in reading order, each carrying the anchor id {@link attachHeadingIds} gives it.
 *
 * Accepts arbitrary JSON — one richtext document, the ordered content blocks of a whole page, ... —
 * and walks every value, exactly like {@link collectFootnotes}, so a caller can hand over whatever
 * shape it holds and get one outline across the lot. That deliberately reaches headings inside an
 * accordion item or a `media_text` block too: those render on the page, so a reader can be sent to
 * them.
 *
 * A heading with no text is skipped, because there is nothing to label it with in an outline and
 * nothing to build an id from. {@link attachHeadingIds} skips the same ones, so the ids line up.
 */
export function collectHeadings(input: unknown): Array<RichTextHeading> {
	const headings: Array<RichTextHeading> = [];
	const nextHeadingId = createHeadingIdFactory();

	function visit(node: unknown) {
		if (Array.isArray(node)) {
			for (const item of node) {
				visit(item);
			}
			return;
		}

		if (!isRecord(node)) {
			return;
		}

		if (node.type === "heading") {
			const text = headingText(node);

			if (text !== "") {
				headings.push({ id: nextHeadingId(text), level: headingLevel(node), text });
			}

			return;
		}

		for (const value of Object.values(node)) {
			visit(value);
		}
	}

	visit(input);

	return headings;
}

/**
 * A copy of `input` with every heading carrying its anchor in `attrs.id`, so a renderer can emit a
 * heading a table of contents can link to.
 *
 * Walks in the same order as {@link collectHeadings} and takes its ids from the same factory, so the
 * two agree on which heading gets which id. Like a footnote's number, the anchor stays derived
 * rather than stored: it is only ever a function of the heading's text and its place in the page,
 * so an editor renaming a heading gets the new anchor without a migration.
 */
export function attachHeadingIds<T>(input: T): T {
	const nextHeadingId = createHeadingIdFactory();

	function visit(node: unknown): unknown {
		if (Array.isArray(node)) {
			return node.map((item) => visit(item));
		}

		if (!isRecord(node)) {
			return node;
		}

		if (node.type === "heading") {
			const text = headingText(node);

			if (text === "") {
				return node;
			}

			return {
				...node,
				attrs: { ...(isRecord(node.attrs) ? node.attrs : {}), id: nextHeadingId(text) },
			};
		}

		return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, visit(value)]));
	}

	return visit(input) as T;
}

/**
 * Whether a richtext document carries no meaningful text. An empty editor still produces a `doc`
 * with a single empty paragraph, so callers persist `null` instead of storing that placeholder.
 */
export function isEmptyRichTextDocument(content: JSONContent | null | undefined): boolean {
	if (content == null) {
		return true;
	}
	if (content.type !== "doc") {
		return false;
	}

	const nodes = content.content ?? [];

	if (nodes.length === 0) {
		return true;
	}

	return nodes.every((node) => {
		if (node.type === "paragraph") {
			const paragraphContent = node.content ?? [];
			if (paragraphContent.length === 0) {
				return true;
			}

			return paragraphContent.every(
				(child) => child.type === "text" && (child.text ?? "").trim() === "",
			);
		}

		return false;
	});
}

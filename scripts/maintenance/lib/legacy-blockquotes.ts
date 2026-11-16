import type { JSONContent } from "@tiptap/core";

/**
 * Turns the WordPress-era `blockquote`s whose attribution was typed in as prose into `quoteBlock`
 * nodes with a structured byline (#958).
 *
 * Only two shapes are converted, because only these two say unambiguously who is speaking:
 *
 * - **in-quote** — the quote's last paragraph is the byline, introduced by a dash: `— Kiki
 *   Czeitschner, Senior Scientist, ACDH-CH`. The name runs to the first comma; the rest describes
 *   them.
 * - **following** — the paragraph right after the quote is the byline, as a name with an affiliation
 *   in parentheses: `Robin Luger (University of Vienna): Report on the DH Conference 2025`. The
 *   affiliation and what follows it describe them.
 *
 * Every other blockquote is left alone and reported, so a person can decide. A plain blockquote is
 * still valid content — it is the node for a quotation nobody is credited with.
 *
 * Bold and italics are dropped from a description: they styled the byline as a byline, which the
 * website now does itself. Links are kept.
 */

export type LegacyBlockquotePattern = "in-quote" | "following";

export interface LegacyBlockquoteConversion {
	pattern: LegacyBlockquotePattern;
	author: string;
	description: string;
	quote: string;
}

export interface LegacyBlockquoteSkip {
	reason: string;
	quote: string;
}

export interface LegacyBlockquoteResult {
	content: JSONContent;
	conversions: Array<LegacyBlockquoteConversion>;
	skipped: Array<LegacyBlockquoteSkip>;
}

const presentationalMarks = new Set(["bold", "italic"]);

/** `— Name, description` (em or en dash, then the name up to the first comma). */
const inQuoteBylinePattern = /^\s*[—–]\s*(?<name>[^,]+?)\s*(?:,\s*(?<rest>.*))?$/su;

/** `Name (Affiliation): what follows`, with `:` or a dash after the parentheses. */
const followingBylinePattern =
	/^\s*(?<name>[^():\n]{2,80}?)\s*\((?<affiliation>[^()]+)\)\s*[:\-–—]\s*(?<rest>.*)$/su;

function plainText(node: JSONContent | undefined): string {
	if (node == null) {
		return "";
	}
	if (node.type === "hardBreak") {
		return "\n";
	}
	if (typeof node.text === "string") {
		return node.text;
	}
	return (node.content ?? []).map((child) => plainText(child)).join("");
}

function preview(node: JSONContent): string {
	return plainText(node).replaceAll(/\s+/g, " ").trim().slice(0, 120);
}

function isBlankParagraph(node: JSONContent): boolean {
	return node.type === "paragraph" && plainText(node).trim() === "";
}

function withoutPresentationalMarks(node: JSONContent): JSONContent {
	if (node.marks == null) {
		return node;
	}
	const marks = node.marks.filter((mark) => !presentationalMarks.has(mark.type));
	const { marks: _marks, ...rest } = node;
	return marks.length > 0 ? { ...rest, marks } : rest;
}

/**
 * The paragraph's inline content with its first `prefixLength` characters removed. `null` when the
 * prefix does not fit inside the first text node — a name split across marks or links is not one
 * this conversion should guess at.
 */
function dropPrefix(inline: Array<JSONContent>, prefixLength: number): Array<JSONContent> | null {
	const [first, ...rest] = inline;
	if (first?.type !== "text" || typeof first.text !== "string") {
		return null;
	}
	if (first.text.length < prefixLength) {
		return null;
	}

	const remainder = first.text.slice(prefixLength).trimStart();

	return remainder !== "" ? [{ ...first, text: remainder }, ...rest] : rest;
}

/** Inline content as a caption document, or `null` when it holds no text. */
function toDescription(inline: Array<JSONContent>): JSONContent | null {
	// Trailing breaks and whitespace are where a byline ended, not part of what it says.
	const content = inline.map((node) => withoutPresentationalMarks(node));
	while (content.length > 0 && plainText(content.at(-1)).trim() === "") {
		content.pop();
	}
	if (content.length === 0) {
		return null;
	}
	return { type: "doc", content: [{ type: "paragraph", content }] };
}

function createQuote(
	body: Array<JSONContent>,
	author: string,
	description: JSONContent | null,
): JSONContent {
	return {
		type: "quoteBlock",
		attrs: { authors: [{ kind: "text", name: author }], description },
		content: body,
	};
}

interface Converted {
	node: JSONContent;
	conversion: LegacyBlockquoteConversion;
	/** Whether the paragraph after the quote was its byline, and so is consumed. */
	consumesNext: boolean;
}

function convertBlockquote(
	blockquote: JSONContent,
	next: JSONContent | undefined,
): Converted | { reason: string } {
	const children = (blockquote.content ?? []).filter((child) => !isBlankParagraph(child));

	if (children.length === 0) {
		return { reason: "empty" };
	}
	if (children.some((child) => child.type !== "paragraph")) {
		return { reason: "holds more than paragraphs" };
	}

	const last = children.at(-1)!;
	const inQuote = inQuoteBylinePattern.exec(plainText(last));

	if (inQuote?.groups != null && !plainText(last).includes("\n")) {
		const body = children.slice(0, -1);
		if (body.length === 0) {
			return { reason: "holds only a byline" };
		}

		const name = inQuote.groups.name!.trim();
		const rest = inQuote.groups.rest?.trim() ?? "";
		const text = plainText(last);
		// Everything up to the start of the description: the dash, the name, and the comma.
		const prefixLength = rest !== "" ? text.lastIndexOf(rest) : text.length;
		const inline = rest !== "" ? dropPrefix(last.content ?? [], prefixLength) : [];

		if (inline == null) {
			return { reason: "byline is split across formatting" };
		}

		const description = toDescription(inline);

		return {
			node: createQuote(body, name, description),
			conversion: {
				pattern: "in-quote",
				author: name,
				description: plainText(description ?? undefined),
				quote: preview({ type: "doc", content: body }),
			},
			consumesNext: false,
		};
	}

	if (next?.type === "paragraph") {
		const text = plainText(next);
		const following = followingBylinePattern.exec(text);

		if (following?.groups != null) {
			const name = following.groups.name!.trim();
			const affiliation = following.groups.affiliation!.trim();
			const rest = following.groups.rest!;
			const prefixLength = text.length - rest.length;
			const inline = dropPrefix(next.content ?? [], prefixLength);

			if (inline == null) {
				return { reason: "following byline is split across formatting" };
			}

			const description = toDescription([
				{ type: "text", text: rest.trim() !== "" ? `${affiliation} — ` : affiliation },
				...inline,
			]);

			return {
				node: createQuote(children, name, description),
				conversion: {
					pattern: "following",
					author: name,
					description: plainText(description ?? undefined),
					quote: preview(blockquote),
				},
				consumesNext: true,
			};
		}
	}

	return { reason: "no byline found" };
}

/** Converts every legacy blockquote with a recognisable byline, at any depth of `doc`. */
export function convertLegacyBlockquotes(doc: JSONContent): LegacyBlockquoteResult {
	const conversions: Array<LegacyBlockquoteConversion> = [];
	const skipped: Array<LegacyBlockquoteSkip> = [];

	function visitChildren(nodes: Array<JSONContent>): Array<JSONContent> {
		const result: Array<JSONContent> = [];

		for (let index = 0; index < nodes.length; index++) {
			const node = nodes[index]!;

			if (node.type !== "blockquote") {
				result.push(visit(node));
				continue;
			}

			const converted = convertBlockquote(node, nodes[index + 1]);

			if ("reason" in converted) {
				skipped.push({ reason: converted.reason, quote: preview(node) });
				// A blockquote inside a blockquote is reported on its own, not converted: its parent stays.
				result.push(visit(node));
				continue;
			}

			conversions.push(converted.conversion);
			result.push(converted.node);
			if (converted.consumesNext) {
				index++;
			}
		}

		return result;
	}

	function visit(node: JSONContent): JSONContent {
		if (node.content == null) {
			return node;
		}
		const content = visitChildren(node.content);
		return content.some((child, index) => child !== node.content![index]) ||
			content.length !== node.content.length
			? { ...node, content }
			: node;
	}

	return { content: visit(doc), conversions, skipped };
}

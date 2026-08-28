import { normalizeRichTextDocument } from "@dariah-eric/database/rich-text-normalize";
import type { JSONContent } from "@tiptap/core";

/**
 * WordPress-specific rich-text helpers for the post-migration cleanup. The generic TipTap
 * normalisation (empty-paragraph/whitespace/`<br>` tidy, heading-bold and imported-attribute
 * stripping) now lives in the shared `@dariah-eric/database/rich-text-normalize` module and is
 * re-exported here as `cleanTiptapDoc`; this file keeps only the WordPress-review heuristics
 * (`findOverExtendedLinks`, `findMidTextHardBreaks`) which are surfaced for a human, never
 * mutated.
 */

export { normalizeRichTextDocument as cleanTiptapDoc };

export interface OverExtendedLink {
	text: string;
	href: string | undefined;
}

/**
 * A WordPress oddity we cannot safely auto-fix: a link mark whose visible text has swallowed the
 * trailing punctuation and following prose (e.g. `"https://x.org/). The next sentence…"`). Detected
 * heuristically for a manual-fix report only — never mutated.
 */
function isOverExtendedLinkText(text: string): boolean {
	return (
		/https?:\/\/\S+\s+\S/.test(text) ||
		/\.\s+[A-Z]/.test(text) ||
		/\)\s+\S/.test(text) ||
		text.length > 100
	);
}

export function findOverExtendedLinks(doc: JSONContent): Array<OverExtendedLink> {
	const issues: Array<OverExtendedLink> = [];

	function walk(node: JSONContent): void {
		if (node.type === "text") {
			const link = node.marks?.find((mark) => mark.type === "link");
			if (link != null && isOverExtendedLinkText(node.text ?? "")) {
				issues.push({ text: node.text ?? "", href: link.attrs?.href as string | undefined });
			}
		}
		for (const child of node.content ?? []) {
			walk(child);
		}
	}

	walk(doc);
	return issues;
}

/** A paragraph that still contains a `<br>` after cleaning, with the break shown as `⏎` in context. */
export interface MidTextHardBreak {
	text: string;
}

/**
 * Reports paragraphs that retain a mid-text hard break after cleaning. These are kept on the
 * assumption they are intentional line breaks, but they are frequently WordPress layout artifacts,
 * so they are surfaced for a human to review. Run this on the _cleaned_ document.
 */
export function findMidTextHardBreaks(doc: JSONContent): Array<MidTextHardBreak> {
	const breaks: Array<MidTextHardBreak> = [];

	function walk(node: JSONContent): void {
		if (
			node.type === "paragraph" &&
			(node.content ?? []).some((child) => child.type === "hardBreak")
		) {
			const text = (node.content ?? [])
				.map((child) => {
					if (child.type === "hardBreak") {
						return " ⏎ ";
					}
					return child.type === "text" ? (child.text ?? "") : "";
				})
				.join("")
				.trim();
			breaks.push({ text });
		}
		for (const child of node.content ?? []) {
			walk(child);
		}
	}

	walk(doc);
	return breaks;
}

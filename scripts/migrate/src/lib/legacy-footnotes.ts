import type { JSONContent } from "@tiptap/core";

/**
 * Converts a WordPress-era footnote apparatus — literal `[1]` markers in the prose and a matching
 * `[1] …` list under a "References" heading — into the native `footnote` nodes the editor writes
 * today.
 *
 * The two apparatuses disagree about where a number comes from. WordPress stored it as text on both
 * sides, which is why the migrated articles have gaps, repeats and dangling `#_ftn1` links that
 * point at ids nothing ever rendered. A `footnote` node stores no number at all: the marker carries
 * its note in `attrs.content` and the number comes from a CSS counter over marker order (see
 * `rich-text-editor.tsx`). So a converted article renumbers itself, and a number that was skipped
 * or cited twice in the legacy text does not survive as such — the caller is told, via `numbering`,
 * what each old label became.
 *
 * This is why the conversion is not offered for impact case studies: those are deposited on Zenodo
 * with their numbering, and renumbering them would put the site out of step with the record.
 */

/** `[1]`, `[1, 2]`, `[6-12]` — a citation group. Deliberately narrow: `[2002]` in prose is a year. */
const CITATION_GROUP = /\[\s*\d+(?:\s*[,;]\s*\d+|\s*[-–—]\s*\d+)*\s*\]/;
const CITATION_GROUP_GLOBAL = new RegExp(CITATION_GROUP, "g");
const LEADING_CITATION_GROUP = new RegExp(`^\\s*(${CITATION_GROUP.source})\\s*`);
const REFERENCE_HEADING = /^\s*(?:references|notes|footnotes)\s*:?\s*$/i;

/** One `rich_text` content block of the article, in `position` order. */
export interface FootnoteBlock {
	id: string;
	content: JSONContent;
}

export interface ConvertedBlock {
	id: string;
	content: JSONContent;
	changed: boolean;
}

/** What one legacy label became: `label` is the text that was in the prose, `number` what renders. */
export interface Renumbering {
	label: number;
	number: number;
}

export interface ConversionResult {
	blocks: Array<ConvertedBlock>;
	/** Notes lifted out of the reference list, keyed by their legacy label. */
	notes: Map<number, JSONContent>;
	/** One entry per converted marker, in reading order — so `number` is what the counter will show. */
	numbering: Array<Renumbering>;
	/**
	 * Reasons not to write this article. Every one of them is a case where applying the conversion
	 * would lose text or leave the document malformed, so the caller is expected to stop.
	 */
	problems: Array<string>;
	/**
	 * Bracket groups left as prose. Not a reason to stop — the text is untouched either way — but
	 * worth reading, since this is both where a bad number in the source surfaces and where a year
	 * like `[2005]` correctly declines to become a footnote.
	 */
	warnings: Array<string>;
}

/** The numbers a citation group names, expanding `[6-8]` to 6, 7, 8. */
function labelsIn(group: string): Array<number> {
	const labels: Array<number> = [];

	for (const part of group.replaceAll(/[[\]\s]/g, "").split(/[,;]/)) {
		const range = /^(\d+)[-–—](\d+)$/.exec(part);
		if (range != null) {
			for (let label = Number(range[1]); label <= Number(range[2]); label++) {
				labels.push(label);
			}
		} else if (/^\d+$/.test(part)) {
			labels.push(Number(part));
		}
	}

	return labels;
}

function plainText(node: JSONContent | null | undefined): string {
	if (node == null) {
		return "";
	}
	if (node.type === "text") {
		return node.text ?? "";
	}
	return (node.content ?? []).map((child) => plainText(child)).join("");
}

function isCitationGroup(text: string): boolean {
	return new RegExp(`^${CITATION_GROUP.source}$`).test(text.trim());
}

/**
 * Splits a reference entry into the label(s) it answers to and the note itself.
 *
 * Two shapes occur, and the difference is invisible once rendered: the Theatralia import made each
 * label its own text node carrying a `#_ftnref1` back-link, while Hidden Traces left `"[1] You can
 * read…"` as one string. Both lose the label and exactly one space after it.
 */
function splitReferenceEntry(
	paragraph: JSONContent,
): { labels: Array<number>; note: Array<JSONContent> } | null {
	const children = paragraph.content ?? [];
	const [first, ...rest] = children;

	if (first?.type !== "text" || first.text == null) {
		return null;
	}

	// A label in its own node takes the following node's leading space with it, since the space was
	// only ever separating the two.
	if (isCitationGroup(first.text)) {
		const labels = labelsIn(first.text);
		const [next, ...tail] = rest;
		const note =
			next?.type === "text" && next.text != null
				? [{ ...next, text: next.text.replace(/^\s+/, "") }, ...tail]
				: rest;
		return labels.length > 0
			? { labels, note: note.filter((child) => isNotEmptyText(child)) }
			: null;
	}

	const match = LEADING_CITATION_GROUP.exec(first.text);
	if (match == null) {
		return null;
	}

	const labels = labelsIn(match[1]!);
	const remainder = first.text.slice(match[0].length);
	const note = [...(remainder.length > 0 ? [{ ...first, text: remainder }] : []), ...rest];

	return labels.length > 0 ? { labels, note } : null;
}

function isNotEmptyText(node: JSONContent): boolean {
	return node.type !== "text" || (node.text ?? "").length > 0;
}

/**
 * The trailing run of reference entries in the last block, plus the heading that introduces them.
 *
 * Anchored at the end of the document rather than searched for by heading, because the heading is
 * the part that varies ("References", "Notes") and the position is the part that does not — a
 * reference list is what an article ends with.
 */
function findReferenceSection(nodes: Array<JSONContent>): {
	firstIndex: number;
	entries: Array<{ labels: Array<number>; note: Array<JSONContent> }>;
	problems: Array<string>;
} {
	const problems: Array<string> = [];
	const entries: Array<{ labels: Array<number>; note: Array<JSONContent> }> = [];

	let index = nodes.length;
	while (index > 0) {
		const node = nodes[index - 1]!;
		if (node.type !== "paragraph") {
			break;
		}
		const entry = splitReferenceEntry(node);
		if (entry == null) {
			break;
		}
		entries.unshift(entry);
		index -= 1;
	}

	if (entries.length === 0) {
		return { firstIndex: nodes.length, entries, problems };
	}

	// The heading goes with them: the notes are about to be rendered under the site's own footnotes
	// heading, so leaving this one behind would introduce an empty section.
	const heading = nodes[index - 1];
	if (heading?.type === "heading" && REFERENCE_HEADING.test(plainText(heading))) {
		index -= 1;
	} else if (heading != null) {
		problems.push(
			`The ${String(entries.length)} reference entries are not preceded by a "References" heading (found ${heading.type === "heading" ? `heading “${plainText(heading).trim()}”` : `a ${String(heading.type)}`}); it was left in place.`,
		);
	}

	return { firstIndex: index, entries, problems };
}

/** The inline nodes a text node becomes once its citation groups are replaced by footnote markers. */
function replaceMarkersInTextNode(
	node: JSONContent,
	notes: Map<number, JSONContent>,
	onConvert: (label: number) => void,
	warnings: Array<string>,
): Array<JSONContent> {
	const text = node.text ?? "";
	const result: Array<JSONContent> = [];
	let cursor = 0;

	for (const match of text.matchAll(CITATION_GROUP_GLOBAL)) {
		const labels = labelsIn(match[0]);
		const unknown = labels.filter((label) => !notes.has(label));
		if (unknown.length > 0) {
			// A bracketed number with no entry behind it is either a bad marker or not a marker at all
			// (`[2005]`), and the two are indistinguishable from here. Both want the same treatment:
			// leave the text alone and say what was skipped — inventing an empty footnote would bury it.
			warnings.push(`Left as text: ${match[0]} — no reference entry for ${unknown.join(", ")}.`);
			continue;
		}

		// The space in "Burney [3]" only ever separated the word from its marker, and a superscript
		// attaches to the word it follows.
		const before = text.slice(cursor, match.index).replace(/[ \t]+$/, "");
		if (before.length > 0) {
			result.push({ ...node, text: before });
		}
		for (const label of labels) {
			result.push({ type: "footnote", attrs: { content: notes.get(label)! } });
			onConvert(label);
		}
		cursor = match.index + match[0].length;
	}

	if (cursor === 0) {
		return [node];
	}

	const after = text.slice(cursor);
	if (after.length > 0) {
		result.push({ ...node, text: after });
	}

	return result;
}

/** Rewrites every citation group below `node`, in reading order. */
function replaceMarkers(
	node: JSONContent,
	notes: Map<number, JSONContent>,
	onConvert: (label: number) => void,
	warnings: Array<string>,
): JSONContent {
	if (node.content == null) {
		return node;
	}

	const content = node.content.flatMap((child) => {
		if (child.type === "text") {
			return replaceMarkersInTextNode(child, notes, onConvert, warnings);
		}
		return [replaceMarkers(child, notes, onConvert, warnings)];
	});

	return { ...node, content };
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		return `{${Object.keys(value)
			.toSorted()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
			)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

/**
 * Converts one article's blocks, given in `position` order. Pure, and a no-op on content that has
 * already been converted (there is no reference list left to find), so it is safe to re-run.
 */
export function convertLegacyFootnotes(blocks: Array<FootnoteBlock>): ConversionResult {
	const problems: Array<string> = [];
	const warnings: Array<string> = [];
	const notes = new Map<number, JSONContent>();
	const numbering: Array<Renumbering> = [];

	const unchanged = (): ConversionResult => {
		return {
			blocks: blocks.map((block) => {
				return { id: block.id, content: block.content, changed: false };
			}),
			notes,
			numbering,
			problems,
			warnings,
		};
	};

	const lastBlock = blocks.at(-1);
	if (lastBlock == null) {
		return unchanged();
	}

	const lastNodes = lastBlock.content.content ?? [];
	const section = findReferenceSection(lastNodes);
	problems.push(...section.problems);

	if (section.entries.length === 0) {
		return unchanged();
	}

	for (const entry of section.entries) {
		const note: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph", content: entry.note }],
		};

		if (entry.note.length === 0) {
			problems.push(`Reference entry [${entry.labels.join(", ")}] has no text; skipped.`);
			continue;
		}

		for (const label of entry.labels) {
			if (notes.has(label)) {
				problems.push(`Reference entry [${String(label)}] appears more than once; skipped.`);
				continue;
			}
			notes.set(label, note);
		}
	}

	const converted = blocks.map((block, index) => {
		const isLast = index === blocks.length - 1;
		const nodes = isLast ? lastNodes.slice(0, section.firstIndex) : (block.content.content ?? []);

		const content: JSONContent = {
			...block.content,
			content: nodes.map((node) =>
				replaceMarkers(
					node,
					notes,
					(label) => {
						numbering.push({ label, number: numbering.length + 1 });
					},
					warnings,
				),
			),
		};

		return {
			id: block.id,
			content,
			changed: stableStringify(block.content) !== stableStringify(content),
		};
	});

	const cited = new Set(numbering.map((entry) => entry.label));
	for (const label of notes.keys()) {
		if (!cited.has(label)) {
			// Nothing in the prose points at it, and a note only exists attached to a marker — applying
			// the conversion would delete the entry and lose its text.
			problems.push(`Reference entry [${String(label)}] is never cited; its text would be lost.`);
		}
	}

	for (const block of converted) {
		if ((block.content.content ?? []).length === 0) {
			problems.push(
				`Block ${block.id} would be left empty; deleting blocks is out of this script's scope.`,
			);
		}
	}

	return { blocks: converted, notes, numbering, problems, warnings };
}

/** Flattens a note to one line, for the dry-run report. */
export function noteToPlainText(note: JSONContent): string {
	return plainText(note).replaceAll(/\s+/g, " ").trim();
}

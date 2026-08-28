import { formatPlaceholderValue } from "@dariah-eric/database/placeholder-values";

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function appendBlockSeparator(parts: Array<string>) {
	// eslint-disable-next-line unicorn/prefer-at
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
		// it in place, padded, so the note is indexed alongside the sentence it belongs to instead of
		// running into the word before the marker.
		parts.push(" ");
		visit(node.attrs.content, parts);
		parts.push(" ");
		return;
	}

	if (node.type === "placeholderValue" && isRecord(node.attrs)) {
		// Annotated nodes flatten to their resolved value so it is searchable; raw references fall
		// back to the display label.
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

import type { JSONContent } from "@tiptap/core";

export function richTextToText(content: JSONContent | null | undefined): string {
	if (content == null) {
		return "";
	}

	const parts: Array<string> = [];

	function visit(node: JSONContent): void {
		if (typeof node.text === "string") {
			parts.push(node.text);
		}

		for (const child of node.content ?? []) {
			visit(child);
		}

		if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
			parts.push("\n");
		}
	}

	visit(content);

	return parts
		.join("")
		.replaceAll(/\n{3,}/g, "\n\n")
		.trim();
}

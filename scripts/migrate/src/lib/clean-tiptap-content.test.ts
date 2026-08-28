import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { findOverExtendedLinks } from "./clean-tiptap-content";

function doc(...content: Array<JSONContent>): JSONContent {
	return { type: "doc", content };
}

describe("findOverExtendedLinks", () => {
	it("flags a link whose text has swallowed following prose", () => {
		const input = doc({
			type: "paragraph",
			content: [
				{
					type: "text",
					marks: [{ type: "link", attrs: { href: "https://x.org/" } }],
					text: "https://x.org/). The next sentence starts here",
				},
			],
		});
		const issues = findOverExtendedLinks(input);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.href).toBe("https://x.org/");
	});

	it("does not flag a well-formed link", () => {
		const input = doc({
			type: "paragraph",
			content: [
				{ type: "text", marks: [{ type: "link", attrs: { href: "https://x" } }], text: "here" },
			],
		});
		expect(findOverExtendedLinks(input)).toHaveLength(0);
	});
});

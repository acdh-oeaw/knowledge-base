import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createRichTextExtensions } from "@/lib/rich-text-editor";

const schema = getSchema(createRichTextExtensions());

/**
 * The attributes the link mark would put on its `<a>`, without needing a DOM. Nullish ones are
 * dropped, which is what a serializer does with them.
 */
function renderedAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
	const mark = schema.marks.link!.create(attrs);
	const [tag, rendered] = schema.marks.link!.spec.toDOM!(mark, true) as [
		string,
		Record<string, unknown>,
	];

	expect(tag).toBe("a");

	return Object.fromEntries(Object.entries(rendered).filter(([, value]) => value != null));
}

/** What a save would put in the database: the mark as `jsonb` sees it. */
function storedAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
	const stored = JSON.parse(JSON.stringify(schema.marks.link!.create(attrs).toJSON())) as {
		attrs?: Record<string, unknown>;
	};

	return stored.attrs ?? {};
}

/**
 * The link mark nulls the extension's `target="_blank"` / `rel="noopener noreferrer nofollow"`
 * defaults, which applied to every link — in-page anchors included, where a new tab means opening a
 * second copy of the page rather than scrolling to it.
 */
describe("link marks", () => {
	it("gives an in-page anchor nothing but its href", () => {
		expect(renderedAttributes({ href: "#footnote-1" })).toStrictEqual({ href: "#footnote-1" });
	});

	it("gives an external link nothing but its href", () => {
		expect(renderedAttributes({ href: "https://example.org" })).toStrictEqual({
			href: "https://example.org",
		});
	});

	it("stores no value for target/rel/class", () => {
		// Nullish rather than absent: whether the key is written depends on the extension version
		// (3.29 coerces an undefined default to null, 3.27 does not) and neither form renders. What
		// matters is that no *value* comes back.
		const stored = storedAttributes({ href: "https://example.org" });

		expect(stored.target ?? null).toBeNull();
		expect(stored.rel ?? null).toBeNull();
		expect(stored.class ?? null).toBeNull();
	});

	it("still renders a target stored as a real value", () => {
		// Content saved before this change holds the old defaults as real values, cleaned out of the
		// data (`data:clean:richtext`) rather than dropped by the renderer.
		expect(renderedAttributes({ href: "https://example.org", target: "_blank" })).toMatchObject({
			target: "_blank",
		});
	});
});

import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createRichTextExtensions } from "@/lib/rich-text-editor";

const schema = getSchema(createRichTextExtensions());

/** The attributes the button link node would put on its `<a>`, without needing a DOM. */
function renderedAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
	const node = schema.nodes.buttonLink!.create(attrs);
	const [tag, rendered] = schema.nodes.buttonLink!.spec.toDOM!(node) as [
		string,
		Record<string, unknown>,
	];

	expect(tag).toBe("a");

	return Object.fromEntries(Object.entries(rendered).filter(([, value]) => value != null));
}

describe("button link nodes", () => {
	it("renders a plain button link as before", () => {
		expect(renderedAttributes({ href: "/news", label: "News" })).toStrictEqual({
			"data-button-link": "",
			href: "/news",
			"data-variant": "primary",
		});
	});

	it("renders an entity target as the link mark does, without an href", () => {
		expect(
			renderedAttributes({ label: "Read", targetKind: "entity", entityId: "doc-1" }),
		).toStrictEqual({
			"data-button-link": "",
			"data-variant": "primary",
			"data-target-kind": "entity",
			"data-entity-id": "doc-1",
		});
	});

	it("never renders a resolved target, so it cannot be stored by a round-trip", () => {
		const rendered = renderedAttributes({
			label: "Flyer",
			targetKind: "asset",
			assetKey: "a.pdf",
			asset: { url: "https://example.org/a.pdf" },
		});

		expect(rendered).toStrictEqual({
			"data-button-link": "",
			"data-variant": "primary",
			"data-target-kind": "asset",
			"data-asset-key": "a.pdf",
		});
	});

	it("stores target attributes in json", () => {
		const node = schema.nodes.buttonLink!.create({
			label: "Read",
			targetKind: "entity",
			entityId: "doc-1",
		});

		const stored = node.toJSON() as { attrs?: Record<string, unknown> };

		expect(stored.attrs).toMatchObject({
			href: null,
			targetKind: "entity",
			entityId: "doc-1",
			assetKey: null,
		});
	});
});

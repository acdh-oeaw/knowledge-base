import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createRichTextExtensions } from "@/lib/rich-text-editor";

/**
 * Which draggable nodes hold content, and which are atoms — because the two get their `draggable`
 * attribute from different places, and only one of them gets it for free.
 *
 * ProseMirror sets `draggable` on a node's DOM only when the node has no content hole (see
 * `NodeViewDesc`). An atom is therefore draggable the moment its spec says so. A node that holds
 * content is not: its node view has to set the attribute itself, which is what
 * `useContainerDraggable` does. Miss that and the browser fires no `dragstart`, tiptap's
 * `data-drag-handle` handling never runs, and the block cannot be moved at all — no type error, and
 * nothing visibly wrong until somebody tries to drag it. That is exactly how `mediaTextBlock`
 * shipped undraggable.
 *
 * Pinning both lists makes adding a draggable node a deliberate act. A new atom is already served
 * by `BlockNodeSurface`; a new content node needs the hook, and a row in the `DraggableBlocks`
 * story, which is where the attribute is asserted against a real browser.
 */
describe("draggable node classification", () => {
	const schema = getSchema(createRichTextExtensions());
	const draggable = Object.values(schema.nodes).filter((node) => node.spec.draggable === true);

	function namesOf(predicate: (hasContentHole: boolean) => boolean): Array<string> {
		return draggable
			.filter((node) => predicate(node.spec.content != null))
			.map((node) => node.name)
			.toSorted();
	}

	it("knows every draggable node that holds content, so none is left without the hook", () => {
		expect(namesOf((hasContentHole) => hasContentHole)).toStrictEqual([
			"accordionBlock",
			"accordionItem",
			"calloutBlock",
			"mediaTextBlock",
		]);
	});

	it("knows every draggable atom, which ProseMirror marks by itself", () => {
		expect(namesOf((hasContentHole) => !hasContentHole)).toStrictEqual([
			"assetImage",
			"embedBlock",
			"galleryBlock",
			// Tiptap's own `image` node, kept in the schema so documents imported from WordPress still
			// open: it stores a raw `src` and refers to no asset at all, which is why authoring uses
			// `assetImage` instead. Listed here so it stays visible rather than being mistaken for one
			// of ours — anything still holding one is content that never made it into the media library.
			"image",
		]);
	});
});

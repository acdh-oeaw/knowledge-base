import { Extension } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * Document-level footnote machinery, kept apart from the node itself (`rich-text-footnote-node`).
 *
 * Nothing here touches React or the note editor, so an editor that only needs to _refuse_ footnotes
 * can import it without pulling in the node view — which is what lets the inline caption editor use
 * the guard without a cycle back through itself.
 */

/** A fragment with every footnote marker dropped, at any depth. */
export function withoutFootnotes(fragment: Fragment): Fragment {
	const nodes: Array<ProseMirrorNode> = [];

	fragment.forEach((node) => {
		if (node.type.name === "footnote") {
			return;
		}
		// Text nodes hold a string rather than a fragment, so they are taken as they are; everything
		// else is rebuilt around its filtered content.
		nodes.push(node.isText ? node : node.copy(withoutFootnotes(node.content)));
	});

	return Fragment.fromArray(nodes);
}

/**
 * Drops footnotes out of pasted content, for the editors that do not offer them.
 *
 * Whether a field takes footnotes is a decision about the kind of text it holds — a case study
 * cites its evidence, a person's biography does not — and hiding the insert action only covers the
 * way an author would add one deliberately. Copying a paragraph across from a case study would
 * otherwise carry its markers into a field whose readers have nowhere to read them.
 *
 * A guard rather than a smaller schema: the node stays in every editor's schema, so a document that
 * already holds footnotes still opens (and still renders them) in a field where the feature was
 * since turned off, instead of failing on an unknown node type.
 */
export const FootnotePasteGuard = Extension.create({
	name: "footnotePasteGuard",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("footnotePasteGuard"),
				props: {
					transformPasted(slice) {
						// Footnotes are inline atoms inside textblocks, so dropping them leaves the block
						// structure — and with it the slice's open depths — untouched.
						return new Slice(withoutFootnotes(slice.content), slice.openStart, slice.openEnd);
					},
				},
			}),
		];
	},
});

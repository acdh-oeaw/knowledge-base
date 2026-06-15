import type { JSONContent } from "@tiptap/core";

import type { ContentBlockInput } from "@/lib/content-block-input";

interface RichTextBlock {
	type: "rich_text";
	content?: JSONContent;
}

interface ImageBlock {
	type: "image";
	content?: { imageKey?: string; imageUrl?: string; caption?: string };
}

interface EmbedBlock {
	type: "embed";
	content?: { url?: string; title?: string; caption?: string };
}

export type MergeableBlock = RichTextBlock | ImageBlock | EmbedBlock;

/**
 * Merges an ordered sequence of rich_text and image blocks into a single Tiptap document. Image
 * blocks become `assetImage` nodes; rich_text blocks contribute their child nodes directly. The
 * result is used as the initial content of the unified editor.
 */
export function mergeBlocksToDocument(blocks: Array<MergeableBlock>): JSONContent {
	const nodes: Array<JSONContent> = [];

	for (const block of blocks) {
		if (block.type === "rich_text") {
			const children = block.content?.content ?? [];
			nodes.push(...children);
		} else if (block.type === "image") {
			nodes.push({
				type: "assetImage",
				attrs: {
					imageKey: block.content?.imageKey ?? null,
					imageUrl: block.content?.imageUrl ?? null,
					caption: block.content?.caption ?? null,
				},
			});
		} else {
			nodes.push({
				type: "embedBlock",
				attrs: {
					url: block.content?.url ?? null,
					title: block.content?.title ?? null,
					caption: block.content?.caption ?? null,
				},
			});
		}
	}

	if (nodes.length === 0) {
		nodes.push({ type: "paragraph" });
	}

	return { type: "doc", content: nodes };
}

/**
 * Splits a unified Tiptap document back into an ordered array of rich_text and image
 * ContentBlockInputs. `assetImage` nodes become image blocks; runs of other nodes become rich_text
 * blocks. All produced blocks are treated as new (no `id` / `position`) so the server will delete
 * the old blocks and re-insert.
 */
export function splitDocumentToBlocks(doc: JSONContent): Array<ContentBlockInput> {
	const nodes = doc.content ?? [];
	const blocks: Array<ContentBlockInput> = [];
	let richTextRun: Array<JSONContent> = [];

	function flushRichText() {
		if (richTextRun.length === 0) {
			return;
		}
		blocks.push({
			id: crypto.randomUUID(),
			type: "rich_text",
			content: { type: "doc", content: richTextRun },
		});
		richTextRun = [];
	}

	for (const node of nodes) {
		if (node.type === "assetImage") {
			flushRichText();
			blocks.push({
				id: crypto.randomUUID(),
				type: "image",
				content: {
					imageKey: (node.attrs?.imageKey as string | null | undefined) ?? undefined,
					imageUrl: (node.attrs?.imageUrl as string | null | undefined) ?? undefined,
					caption: (node.attrs?.caption as string | null | undefined) ?? undefined,
				},
			});
		} else if (node.type === "embedBlock") {
			flushRichText();
			blocks.push({
				id: crypto.randomUUID(),
				type: "embed",
				content: {
					url: (node.attrs?.url as string | null | undefined) ?? undefined,
					title: (node.attrs?.title as string | null | undefined) ?? undefined,
					caption: (node.attrs?.caption as string | null | undefined) ?? undefined,
				},
			});
		} else {
			richTextRun.push(node);
		}
	}

	flushRichText();

	return blocks;
}

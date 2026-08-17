"use client";

import { RichTextEditor, RichTextEditorToolbarButton } from "@dariah-eric/ui/rich-text-editor";
import type { JSONContent } from "@tiptap/core";
import { ImageIcon } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import type { MediaLibraryAsset } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-asset";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";
import { mergeBlocksToDocument, splitDocumentToBlocks } from "@/lib/content-blocks-document";

type MergeableContentBlock = Extract<ContentBlock, { type: "rich_text" | "image" | "embed" }>;

interface RichTextContentBlocksFieldProps {
	"aria-label": string;
	initialAssets: Array<MediaLibraryAsset>;
	initialBlocks?: Array<ContentBlock>;
	name: string;
}

export function RichTextContentBlocksField({
	"aria-label": ariaLabel,
	initialAssets,
	initialBlocks,
	name,
}: Readonly<RichTextContentBlocksFieldProps>): ReactNode {
	const mergeableBlocks =
		initialBlocks?.filter(
			(block): block is MergeableContentBlock =>
				block.type === "rich_text" || block.type === "image" || block.type === "embed",
		) ?? [];
	const initialContent = mergeBlocksToDocument(mergeableBlocks);
	const [editorContent, setEditorContent] = useState<JSONContent>(
		initialContent ?? { type: "doc", content: [] },
	);
	const blocks = useMemo(() => splitDocumentToBlocks(editorContent), [editorContent]);
	const renderImagePicker = useCallback(
		(insert: (key: string, url: string) => void) => (
			<MediaLibraryDialog
				defaultPrefix="images"
				initialAssets={initialAssets}
				onSelect={insert}
				prefixes={["avatars", "images", "logos"]}
				trigger={({ open }) => (
					<RichTextEditorToolbarButton aria-label="Insert image" icon={ImageIcon} onClick={open} />
				)}
			/>
		),
		[initialAssets],
	);

	return (
		<>
			<RichTextEditor
				aria-label={ariaLabel}
				content={initialContent}
				onChange={setEditorContent}
				renderImagePicker={renderImagePicker}
			/>
			{blocks.map((block, idx) => (
				<input
					key={idx}
					name={`${name}ContentBlocks.${String(idx)}`}
					type="hidden"
					value={JSON.stringify(block)}
				/>
			))}
		</>
	);
}

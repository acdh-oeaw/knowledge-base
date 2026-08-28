"use client";

import type { Editor } from "@tiptap/core";
import {
	BoldIcon,
	CodeIcon,
	Columns2Icon,
	GalleryHorizontalEndIcon,
	Heading2Icon,
	Heading3Icon,
	Heading4Icon,
	ImageIcon,
	InfoIcon,
	ItalicIcon,
	ListIcon,
	ListOrderedIcon,
	MousePointerClickIcon,
	PilcrowIcon,
	QuoteIcon,
	SeparatorHorizontalIcon,
	SuperscriptIcon,
	TableIcon,
	VideoIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { type ComponentType, useMemo } from "react";

import { canInsertBlock } from "@/lib/rich-text-slash-menu";

/**
 * Blocks the editor can insert on its own. Every one of these is self-contained: it either needs no
 * configuration at all, or its node view opens whatever panel it needs the moment it mounts empty.
 *
 * Deliberately not a list of every block type — `assetImage` is insertable this way too, but only
 * where the host supplied a picker for the node view to open, so it is gated separately.
 *
 * `placeholderValue` is the one entry that is not a single action: it stands for a family of inline
 * nodes, one per kind, so the toolbar renders it as a submenu rather than through this registry.
 */
export type RichTextInsertableBlock =
	| "accordion"
	| "buttonLink"
	| "callout"
	| "embed"
	| "footnote"
	| "gallery"
	| "mediaText"
	| "placeholderValue";

/**
 * Where an action belongs in the toolbar, and whether the slash menu offers it.
 *
 * `format` covers inline marks, which the slash menu leaves alone: it fires on an empty cursor, and
 * toggling a mark there would have nothing to apply to.
 */
export type RichTextActionGroup = "block" | "block-style" | "format" | "insert";

export interface RichTextAction {
	id: string;
	group: RichTextActionGroup;
	label: string;
	/** Extra words the slash query may match, so `/ul` finds "Bullet list" as well as `/bul` does. */
	keywords?: Array<string>;
	/**
	 * Takes `data-slot` as well as a class name: menu items style their icon through that attribute —
	 * size, colour and the gap to the label all hang off it — while the toolbar and the slash menu
	 * size theirs directly.
	 */
	icon: ComponentType<{ className?: string; "data-slot"?: string }>;
	/**
	 * Whether the mark or node is active at the cursor. Toolbar toggles reflect it; the menu ignores
	 * it.
	 */
	isActive?: boolean;
	/** Hides the action where the schema would refuse it, e.g. a table inside a table. */
	isAvailable?: () => boolean;
	run: () => void;
}

/**
 * The editor state the toolbar and the action list both read. Kept here rather than beside the
 * toolbar so the two cannot drift: an action's `isActive` and the button rendering it come from the
 * same field.
 */
export interface RichTextActiveState {
	isBold: boolean | undefined;
	isItalic: boolean | undefined;
	isCode: boolean | undefined;
	isParagraph: boolean | undefined;
	isHeading2: boolean | undefined;
	isHeading3: boolean | undefined;
	isHeading4: boolean | undefined;
	isBulletList: boolean | undefined;
	isOrderedList: boolean | undefined;
	isBlockquote: boolean | undefined;
	isLink: boolean | undefined;
	isInTable: boolean | undefined;
	linkHref: string | undefined;
	linkTargetKind: string | undefined;
	linkAssetKey: string | undefined;
	linkEntityId: string | undefined;
}

export function selectRichTextActiveState(ctx: { editor: Editor | null }): RichTextActiveState {
	return {
		isBold: ctx.editor?.isActive("bold"),
		isItalic: ctx.editor?.isActive("italic"),
		isCode: ctx.editor?.isActive("code"),
		isParagraph: ctx.editor?.isActive("paragraph"),
		isHeading2: ctx.editor?.isActive("heading", { level: 2 }),
		isHeading3: ctx.editor?.isActive("heading", { level: 3 }),
		isHeading4: ctx.editor?.isActive("heading", { level: 4 }),
		isBulletList: ctx.editor?.isActive("bulletList"),
		isOrderedList: ctx.editor?.isActive("orderedList"),
		isBlockquote: ctx.editor?.isActive("blockquote"),
		isLink: ctx.editor?.isActive("link"),
		isInTable: ctx.editor?.isActive("table"),
		linkHref: ctx.editor?.getAttributes("link").href as string | undefined,
		linkTargetKind: ctx.editor?.getAttributes("link").targetKind as string | undefined,
		linkAssetKey: ctx.editor?.getAttributes("link").assetKey as string | undefined,
		linkEntityId: ctx.editor?.getAttributes("link").entityId as string | undefined,
	};
}

interface UseRichTextActionsOptions {
	editor: Editor | null;
	activeState: RichTextActiveState | null;
	/** Which optional blocks the surrounding form enabled. */
	blocks: ReadonlyArray<RichTextInsertableBlock>;
	/** Whether the host supplied an image picker for image-bearing node views to open. */
	hasImagePicker: boolean;
	/**
	 * Opens the host's image picker. Given only where the host supplied one, and it is what makes the
	 * image action available: an image is picked first and inserted finished, rather than dropped in
	 * empty for the author to fill in afterwards.
	 */
	onPickImage?: () => void;
}

/**
 * The single list of commands the editor offers. The toolbar renders it grouped, the slash menu
 * renders the non-`format` subset, and both get an action's label, icon and availability from the
 * same entry — so a block added here shows up in both without a second registration.
 */
export function useRichTextActions({
	editor,
	activeState,
	blocks,
	hasImagePicker,
	onPickImage,
}: UseRichTextActionsOptions): Array<RichTextAction> {
	const t = useExtracted("ui");

	return useMemo(() => {
		if (editor == null) {
			return [];
		}

		const actions: Array<RichTextAction> = [
			{
				id: "bold",
				group: "format",
				label: t("Bold"),
				icon: BoldIcon,
				isActive: activeState?.isBold,
				run() {
					editor.chain().focus().toggleBold().run();
				},
			},
			{
				id: "italic",
				group: "format",
				label: t("Italic"),
				icon: ItalicIcon,
				isActive: activeState?.isItalic,
				run() {
					editor.chain().focus().toggleItalic().run();
				},
			},
			{
				id: "code",
				group: "format",
				label: t("Code"),
				icon: CodeIcon,
				isActive: activeState?.isCode,
				run() {
					editor.chain().focus().toggleCode().run();
				},
			},
			{
				id: "paragraph",
				group: "block-style",
				label: t("Paragraph"),
				keywords: ["text", "body"],
				icon: PilcrowIcon,
				isActive: activeState?.isParagraph,
				run() {
					editor.chain().focus().setParagraph().run();
				},
			},
			{
				id: "heading-2",
				group: "block-style",
				label: t("Heading 2"),
				keywords: ["h2"],
				icon: Heading2Icon,
				isActive: activeState?.isHeading2,
				run() {
					editor.chain().focus().toggleHeading({ level: 2 }).run();
				},
			},
			{
				id: "heading-3",
				group: "block-style",
				label: t("Heading 3"),
				keywords: ["h3"],
				icon: Heading3Icon,
				isActive: activeState?.isHeading3,
				run() {
					editor.chain().focus().toggleHeading({ level: 3 }).run();
				},
			},
			{
				id: "heading-4",
				group: "block-style",
				label: t("Heading 4"),
				keywords: ["h4"],
				icon: Heading4Icon,
				isActive: activeState?.isHeading4,
				run() {
					editor.chain().focus().toggleHeading({ level: 4 }).run();
				},
			},
			{
				id: "bullet-list",
				group: "block",
				label: t("Bullet list"),
				keywords: ["ul", "unordered"],
				icon: ListIcon,
				isActive: activeState?.isBulletList,
				run() {
					editor.chain().focus().toggleBulletList().run();
				},
			},
			{
				id: "ordered-list",
				group: "block",
				label: t("Ordered list"),
				keywords: ["ol", "numbered"],
				icon: ListOrderedIcon,
				isActive: activeState?.isOrderedList,
				run() {
					editor.chain().focus().toggleOrderedList().run();
				},
			},
			{
				id: "blockquote",
				group: "block",
				label: t("Blockquote"),
				keywords: ["quote"],
				icon: QuoteIcon,
				isActive: activeState?.isBlockquote,
				run() {
					editor.chain().focus().toggleBlockquote().run();
				},
			},
			{
				id: "table",
				group: "insert",
				label: t("Table"),
				keywords: ["table", "grid"],
				icon: TableIcon,
				isAvailable() {
					return canInsertBlock(editor, "table");
				},
				run() {
					editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
				},
			},
			/**
			 * Not an optional block: the node comes with the starter kit, so every document the editor
			 * opens can already hold one — the migrated WordPress content does — and a divider an author
			 * cannot insert is also one they have no obvious way to put back after deleting it.
			 */
			{
				id: "divider",
				group: "insert",
				label: t("Divider"),
				keywords: ["hr", "rule", "separator", "line", "break"],
				icon: SeparatorHorizontalIcon,
				isAvailable() {
					return canInsertBlock(editor, "horizontalRule");
				},
				run() {
					editor.chain().focus().setHorizontalRule().run();
				},
			},
		];

		if (onPickImage != null) {
			actions.push({
				id: "image",
				group: "insert",
				label: t("Image"),
				keywords: ["picture", "photo"],
				icon: ImageIcon,
				isAvailable() {
					return canInsertBlock(editor, "assetImage");
				},
				run: onPickImage,
			});
		}

		if (blocks.includes("embed")) {
			actions.push({
				id: "embed",
				group: "insert",
				label: t("Embed"),
				keywords: ["video", "youtube", "iframe"],
				icon: VideoIcon,
				isAvailable() {
					return canInsertBlock(editor, "embedBlock");
				},
				run() {
					editor
						.chain()
						.focus()
						.insertContent({ type: "embedBlock", attrs: { url: null, title: null, caption: null } })
						.run();
				},
			});
		}

		if (blocks.includes("callout")) {
			actions.push({
				id: "callout",
				group: "insert",
				label: t("Callout"),
				keywords: ["note", "info", "warning"],
				icon: InfoIcon,
				isAvailable() {
					return canInsertBlock(editor, "calloutBlock");
				},
				run() {
					editor
						.chain()
						.focus()
						.insertContent({
							type: "calloutBlock",
							attrs: { intent: "info", title: null },
							// A callout is a container now, so it is inserted with a body to type into rather
							// than as an empty atom whose panel opens on mount.
							content: [{ type: "paragraph" }],
						})
						.run();
				},
			});
		}

		if (blocks.includes("accordion")) {
			actions.push({
				id: "accordion",
				group: "insert",
				label: t("Accordion"),
				keywords: ["faq", "disclosure", "panel", "collapse"],
				icon: ListIcon,
				isAvailable() {
					return canInsertBlock(editor, "accordionBlock");
				},
				run() {
					editor
						.chain()
						.focus()
						.insertContent({
							type: "accordionBlock",
							// One panel to start: an accordion's content spec requires at least one, and an
							// author adding the block wants somewhere to type immediately.
							content: [
								{
									type: "accordionItem",
									attrs: { title: "" },
									content: [{ type: "paragraph" }],
								},
							],
						})
						.run();
				},
			});
		}

		if (blocks.includes("mediaText")) {
			actions.push({
				id: "media-text",
				group: "insert",
				label: t("Media and text"),
				keywords: ["image", "biography", "speaker"],
				icon: Columns2Icon,
				isAvailable() {
					return canInsertBlock(editor, "mediaTextBlock");
				},
				run() {
					editor
						.chain()
						.focus()
						.insertContent({
							type: "mediaTextBlock",
							attrs: {
								imageKey: null,
								imageUrl: null,
								alt: null,
								assetCaption: null,
								caption: null,
								captionMode: "inherit",
								side: "start",
							},
							// The content expression requires at least one child; an empty node would be rejected.
							content: [{ type: "paragraph" }],
						})
						.run();
				},
			});
		}

		/**
		 * A gallery is built out of picked assets, so it is only insertable where the host supplies a
		 * picker.
		 */
		if (blocks.includes("gallery") && hasImagePicker) {
			actions.push({
				id: "gallery",
				group: "insert",
				label: t("Gallery"),
				keywords: ["images", "slideshow", "carousel", "grid"],
				icon: GalleryHorizontalEndIcon,
				isAvailable() {
					return canInsertBlock(editor, "galleryBlock");
				},
				run() {
					editor
						.chain()
						.focus()
						// Inserted empty, like a media and text block: the node view opens its own panel — and
						// so the host's image picker — as soon as it mounts without images.
						.insertContent({ type: "galleryBlock", attrs: { layout: "grid", items: [] } })
						.run();
				},
			});
		}

		if (blocks.includes("buttonLink")) {
			actions.push({
				id: "button-link",
				group: "insert",
				label: t("Button"),
				keywords: ["cta", "link"],
				icon: MousePointerClickIcon,
				run() {
					editor
						.chain()
						.focus()
						.insertContent({
							type: "buttonLink",
							attrs: { href: null, label: null, variant: "primary" },
						})
						.run();
				},
			});
		}

		if (blocks.includes("footnote")) {
			actions.push({
				id: "footnote",
				group: "insert",
				label: t("Footnote"),
				keywords: ["note", "reference", "citation", "source", "evidence"],
				icon: SuperscriptIcon,
				run() {
					editor
						.chain()
						.focus()
						// Inserted empty: the node view opens its own note editor as it mounts, and removes the
						// marker again if it is dismissed without a note.
						.insertContent({ type: "footnote", attrs: { content: null } })
						.run();
				},
			});
		}

		return actions;
	}, [editor, t, activeState, blocks, hasImagePicker, onPickImage]);
}

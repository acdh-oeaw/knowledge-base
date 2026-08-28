"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type { ContentBlockTypes } from "@dariah-eric/database/schema";
import { Button } from "@dariah-eric/ui/button";
import { Checkbox } from "@dariah-eric/ui/checkbox";
import { Label } from "@dariah-eric/ui/field";
import { Input } from "@dariah-eric/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel } from "@dariah-eric/ui/menu";
import {
	Modal,
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalTitle,
} from "@dariah-eric/ui/modal";
import { NumberField, NumberInput } from "@dariah-eric/ui/number-field";
import { RichTextEditor, RichTextEditorToolbarButton } from "@dariah-eric/ui/rich-text-editor";
import { SearchField, SearchInput } from "@dariah-eric/ui/search-field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@dariah-eric/ui/select";
import { TextField } from "@dariah-eric/ui/text-field";
import { ToggleGroup, ToggleGroupItem } from "@dariah-eric/ui/toggle-group";
import {
	ChevronDownIcon,
	CodeBracketSquareIcon,
	InformationCircleIcon,
	ListBulletIcon,
	PencilSquareIcon,
	PhotoIcon,
	PlusIcon,
	RectangleGroupIcon,
	Square3Stack3DIcon,
	Squares2X2Icon,
	TrashIcon,
	ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import type { JSONContent } from "@tiptap/core";
import { ImageIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Fragment, type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { type Key, useDrag, useDrop } from "react-aria";
import {
	Button as AriaButton,
	Disclosure,
	DisclosureGroup,
	DisclosurePanel,
	Heading,
	useListData,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { BlockAssetMetadata } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/block-asset-metadata";
import { EntityLinkDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-link-dialog";
import { ImageCaptionModeField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-caption-mode-field";
import { LinkTargetSummary } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/link-target-summary";
import type { MediaLibraryAsset } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-asset";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";
import {
	type SelectedImage,
	SelectedImageCard,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/selected-image-card";
import { documentMimeTypes } from "@/config/assets.config";
import {
	type MergeableBlock,
	mergeBlocksToDocument,
	splitDocumentToBlocks,
} from "@/lib/content-blocks-document";

interface RichTextContentBlockItem {
	id: Key;
	type: "rich_text";
	position?: number;
	content?: JSONContent;
}

interface ImageContentBlockItem {
	id: Key;
	type: "image";
	position?: number;
	content?: {
		imageKey?: string;
		imageUrl?: string;
		alt?: string | null;
		assetCaption?: JSONContent | null;
		caption?: JSONContent | null;
		captionMode?: ImageCaptionMode;
		layout?: "default" | "wide" | "full" | "float-start" | "float-end";
	};
}

interface EmbedContentBlockItem {
	id: Key;
	type: "embed";
	position?: number;
	content?: { url?: string; title?: string; caption?: JSONContent | null };
}

interface DataContentBlockItem {
	id: Key;
	type: "data";
	position?: number;
	content?: {
		dataType?:
			| "events"
			| "news"
			| "opportunities"
			| "funding_calls"
			| "pages"
			| "spotlight_articles"
			| "impact_case_studies";
		limit?: number;
		selectedIds?: Array<string>;
	};
}

interface CalloutContentBlockItem {
	id: Key;
	type: "callout";
	position?: number;
	content?: {
		intent?: "neutral" | "info" | "warning" | "danger" | "success";
		title?: string;
	};
	/** The callout's body: flow content, each piece a block with its own storage. */
	children?: Array<NestableContentBlock>;
}

interface HeroContentBlockItem {
	id: Key;
	type: "hero";
	position?: number;
	content?: {
		title?: string;
		eyebrow?: string;
		imageKey?: string;
		imageUrl?: string;
		/** The picked asset, for the editor's image card. Only `imageKey` is persisted. */
		asset?: SelectedImage;
		caption?: JSONContent | null;
		captionMode?: ImageCaptionMode;
		ctas?: Array<{ label: string; url: string }>;
	};
}

interface GalleryContentBlockItem {
	id: Key;
	type: "gallery";
	position?: number;
	content?: {
		layout?: "carousel" | "grid";
		/** The gallery's own caption — what the set shows — as opposed to an item's image credit. */
		caption?: JSONContent | null;
		items?: Array<{
			imageKey?: string;
			imageUrl?: string;
			/** The picked asset, for the editor's image card. Only `imageKey` is persisted. */
			asset?: SelectedImage;
			caption?: JSONContent | null;
			captionMode?: ImageCaptionMode;
		}>;
	};
}

interface AccordionContentBlockItem {
	id: Key;
	type: "accordion";
	position?: number;
	children?: Array<AccordionItemContentBlockItem>;
}

interface AccordionItemContentBlockItem {
	id: Key;
	type: "accordion_item";
	position?: number;
	content?: { title?: string };
	children?: Array<NestableContentBlock>;
}

interface MediaTextContentBlockItem {
	id: Key;
	type: "media_text";
	position?: number;
	content?: {
		imageKey?: string;
		imageUrl?: string;
		alt?: string | null;
		assetCaption?: JSONContent | null;
		caption?: JSONContent | null;
		captionMode?: ImageCaptionMode;
		side?: "start" | "end";
		content?: JSONContent;
	};
}

/** The blocks a container may hold — see `allowedChildBlockTypes` in `@dariah-eric/database`. */
type NestableContentBlock =
	| RichTextContentBlockItem
	| ImageContentBlockItem
	| EmbedContentBlockItem
	| GalleryContentBlockItem
	| MediaTextContentBlockItem;

export type ContentBlock =
	| NestableContentBlock
	| CalloutContentBlockItem
	| DataContentBlockItem
	| HeroContentBlockItem
	| AccordionContentBlockItem
	| AccordionItemContentBlockItem;

interface UnifiedContentBlockItem {
	id: Key;
	type: "unified_content";
	content?: JSONContent;
}

type ContentBlockListItem = ContentBlock | UnifiedContentBlockItem;

/**
 * The items the list edits through a panel of their own. Everything else is a node inside a
 * `unified_content` document, so it never reaches the list — and a container's children never do
 * either, since the container carries them.
 */
type PanelContentBlockItem = Extract<
	ContentBlockListItem,
	{ type: "data" | "hero" | "unified_content" }
>;

/**
 * The block types the unified editor owns. Everything here is edited as a node inside one document
 * rather than as a panel of its own, which is also what makes it splittable: on save each node
 * becomes the block it stands for, so an image is an `image` block wherever an author put it.
 *
 * Nested types (`accordion_item`, and anything inside a container) are not listed: they never reach
 * the list as items of their own, because their container carries them.
 */
const UNIFIED_BLOCK_TYPES = new Set<ContentBlock["type"]>([
	"accordion",
	"rich_text",
	"image",
	"embed",
	"callout",
	"media_text",
	"gallery",
]);
const DATA_CONTENT_BLOCK_TYPES = [
	"events",
	"news",
	"opportunities",
	"funding_calls",
	"pages",
	"spotlight_articles",
	"impact_case_studies",
] as const;
type DataContentBlockType = (typeof DATA_CONTENT_BLOCK_TYPES)[number];

function mergeInitialItems(items: Array<ContentBlock>): Array<ContentBlockListItem> {
	const result: Array<ContentBlockListItem> = [];
	let i = 0;
	while (i < items.length) {
		const item = items[i]!;
		if (UNIFIED_BLOCK_TYPES.has(item.type)) {
			const run: Array<MergeableBlock> = [];
			while (i < items.length && UNIFIED_BLOCK_TYPES.has(items[i]!.type)) {
				run.push(items[i] as MergeableBlock);
				i++;
			}
			result.push({
				id: crypto.randomUUID(),
				type: "unified_content",
				content: mergeBlocksToDocument(run),
			});
		} else {
			result.push(item);
			i++;
		}
	}
	return result;
}

export interface ContentBlocksProps {
	/**
	 * Whether authors of this entity may add footnotes. Off unless a form asks for it: a footnote is
	 * a citation apparatus, which suits a case study citing its evidence and not, say, a news item —
	 * and the whole point of the marker is that a reader finds the note at the end of the same page,
	 * which only holds where that section is part of how the entity is presented.
	 */
	hasFootnotes?: boolean;
	initialAssets?: Array<MediaLibraryAsset>;
	items: Array<ContentBlock>;
}

// Stable ID for the shared keyboard-shortcut description element.
const DRAG_HANDLE_DESCRIPTION_ID = "content-blocks-drag-handle-description";

export function ContentBlocks({
	hasFootnotes = false,
	initialAssets,
	items: initialItems,
}: Readonly<ContentBlocksProps>): ReactNode {
	const t = useExtracted();

	const [mergedInitialItems] = useState(() => mergeInitialItems(initialItems));

	const list = useListData<ContentBlockListItem>({
		initialItems: mergedInitialItems,
		getKey(item) {
			return item.id;
		},
	});

	const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(
		() => new Set(mergedInitialItems.map((item) => String(item.id))),
	);

	const addItem = (type: ContentBlockListItem["type"]) => {
		const newItem: ContentBlockListItem =
			type === "unified_content"
				? { id: crypto.randomUUID(), type: "unified_content" }
				: { id: crypto.randomUUID(), type };
		list.append(newItem);
		setExpandedKeys((prev) => new Set([...prev, String(newItem.id)]));
	};

	function handleKeyboardReorder(e: KeyboardEvent<HTMLButtonElement>, id: Key) {
		if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
			return;
		}
		e.preventDefault();
		const idx = list.items.findIndex((item) => item.id === id);
		if (e.key === "ArrowUp" && idx > 0) {
			list.moveBefore(list.items[idx - 1]!.id, [id]);
		} else if (e.key === "ArrowDown" && idx < list.items.length - 1) {
			list.moveAfter(list.items[idx + 1]!.id, [id]);
		}
	}

	function handleReorder(sourceIdStr: string, targetId: Key, position: "before" | "after") {
		// getText() always returns a string; look up the actual Key to avoid type mismatches.
		const sourceItem = list.items.find((item) => String(item.id) === sourceIdStr);
		if (sourceItem == null || sourceItem.id === targetId) {
			return;
		}
		if (position === "before") {
			list.moveBefore(targetId, [sourceItem.id]);
		} else {
			list.moveAfter(targetId, [sourceItem.id]);
		}
	}

	return (
		<Fragment>
			<span className="sr-only" id={DRAG_HANDLE_DESCRIPTION_ID}>
				{t("Press ArrowUp or ArrowDown to reorder")}
			</span>
			<DisclosureGroup
				allowsMultipleExpanded={true}
				className="flex flex-col gap-y-1"
				expandedKeys={expandedKeys}
				onExpandedChange={(keys) => {
					setExpandedKeys(keys);
				}}
			>
				{list.items.map((item) => (
					<ContentBlockItem
						key={String(item.id)}
						hasFootnotes={hasFootnotes}
						initialAssets={initialAssets}
						item={item}
						onDelete={() => {
							list.remove(item.id);
							setExpandedKeys((prev) => {
								const next = new Set(prev);
								next.delete(String(item.id));
								return next;
							});
						}}
						onKeyboardReorder={handleKeyboardReorder}
						onReorder={handleReorder}
						onUpdate={(content) => {
							list.update(item.id, {
								...item,
								content,
							} as ContentBlockListItem);
						}}
					/>
				))}
			</DisclosureGroup>
			{list.items
				.flatMap((item): Array<object> => {
					if (item.type === "unified_content") {
						return splitDocumentToBlocks(item.content ?? { type: "doc", content: [] });
					}
					return [item];
				})
				.map((block, idx) => (
					<input
						key={`block-${String(idx)}`}
						name={`contentBlocks.${String(idx)}`}
						type="hidden"
						value={JSON.stringify(block)}
					/>
				))}
			<ContentBlockMenu onAdd={addItem} />
		</Fragment>
	);
}

interface ContentBlockItemProps {
	hasFootnotes: boolean;
	initialAssets?: Array<MediaLibraryAsset>;
	item: ContentBlockListItem;
	onDelete: () => void;
	onReorder: (sourceIdStr: string, targetId: Key, position: "before" | "after") => void;
	onUpdate: (content: NonNullable<PanelContentBlockItem["content"]>) => void;
	onKeyboardReorder: (e: KeyboardEvent<HTMLButtonElement>, id: Key) => void;
}

function ContentBlockItem({
	hasFootnotes,
	initialAssets,
	item,
	onDelete,
	onReorder,
	onUpdate,
	onKeyboardReorder,
}: Readonly<ContentBlockItemProps>): ReactNode {
	const t = useExtracted();
	const dropRef = useRef<HTMLDivElement>(null);
	const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

	// useDrag / useDrop coordinate via a shared DragManager global — no provider needed.
	// hasDragButton: true separates native drag events (dragProps → header div, for mouse)
	// from keyboard/screen reader activation (dragButtonProps.onPress → handle button,
	// which calls DragManager.beginDragging() enabling Tab-between-targets keyboard flow).
	const { dragProps, dragButtonProps, isDragging } = useDrag({
		hasDragButton: true,
		getItems() {
			return [{ "text/plain": String(item.id) }];
		},
		getAllowedDropOperations() {
			return ["move"];
		},
	});

	// DropEvent x/y are already relative to the target element (confirmed in @react-types/shared).
	// Use the approximate header height as the threshold so that tall expanded panels
	// don't push the "insert before" zone out of reach.
	const HEADER_HEIGHT = 48;
	function computeDropPosition(y: number): "before" | "after" {
		const height = dropRef.current?.getBoundingClientRect().height ?? 96;
		return y < Math.min(HEADER_HEIGHT, height / 2) ? "before" : "after";
	}

	// useDrop registers this element with DragManager.registerDropTarget(), which wires up
	// Tab navigation between drop targets during an active keyboard drag automatically.
	const { dropProps, isDropTarget } = useDrop({
		ref: dropRef,
		getDropOperation() {
			return "move";
		},
		onDropEnter(e) {
			setDropPosition(computeDropPosition(e.y));
		},
		onDropMove(e) {
			setDropPosition(computeDropPosition(e.y));
		},
		onDropExit() {
			setDropPosition(null);
		},
		// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
		async onDrop(e) {
			// Capture position before clearing — onDrop is async.
			const position = dropPosition ?? "after";
			setDropPosition(null);
			for (const dragItem of e.items) {
				if (dragItem.kind === "text" && dragItem.types.has("text/plain")) {
					const sourceId = await dragItem.getText("text/plain");
					onReorder(sourceId, item.id, position);
				}
			}
		},
	});

	const contentBlockTypeNames: Record<ContentBlockTypes["type"] | "unified_content", string> = {
		accordion: t("Accordion"),
		accordion_item: t("Accordion panel"),
		callout: t("Callout"),
		data: t("Data"),
		embed: t("Embed"),
		gallery: t("Gallery"),
		hero: t("Hero"),
		image: t("Image"),
		media_text: t("Media with text"),
		rich_text: t("Rich text"),
		unified_content: t("Content"),
	};

	const contentBlockTypeIcons: Record<ContentBlockTypes["type"] | "unified_content", ReactNode> = {
		accordion: <ListBulletIcon className="shrink-0 block-4 inline-4" />,
		accordion_item: <ListBulletIcon className="shrink-0 block-4 inline-4" />,
		callout: <InformationCircleIcon className="shrink-0 block-4 inline-4" />,
		data: <Square3Stack3DIcon className="shrink-0 block-4 inline-4" />,
		embed: <CodeBracketSquareIcon className="shrink-0 block-4 inline-4" />,
		gallery: <Squares2X2Icon className="shrink-0 block-4 inline-4" />,
		hero: <RectangleGroupIcon className="shrink-0 block-4 inline-4" />,
		image: <PhotoIcon className="shrink-0 block-4 inline-4" />,
		media_text: <ViewColumnsIcon className="shrink-0 block-4 inline-4" />,
		rich_text: <PencilSquareIcon className="shrink-0 block-4 inline-4" />,
		unified_content: <PencilSquareIcon className="shrink-0 block-4 inline-4" />,
	};

	return (
		<>
			{isDropTarget && dropPosition === "before" && (
				<div aria-hidden={true} className="mx-1 rounded-full bg-accent block-0.5" />
			)}
			{/* tabIndex={-1} makes the element programmatically focusable for DragManager
			    keyboard navigation without adding it to the natural tab order. */}
			<div ref={dropRef} tabIndex={-1} {...dropProps}>
				<Disclosure
					className={twMerge(
						"group rounded-lg inset-ring inset-ring-border transition-opacity",
						isDragging && "opacity-50",
					)}
					id={String(item.id)}
				>
					{/* dragProps (draggable + native drag events) on the header div restricts
					    mouse-initiated drags to the header area, keeping the editor panel clear. */}
					<div className="flex items-center gap-x-2 px-3 py-2.5" {...dragProps}>
						<AriaButton
							aria-describedby={[dragButtonProps["aria-describedby"], DRAG_HANDLE_DESCRIPTION_ID]
								.filter(Boolean)
								.join(" ")}
							aria-label={t("Drag to reorder")}
							className="cursor-grab touch-none text-muted-fg"
							onKeyDown={(e) => {
								onKeyboardReorder(e, item.id);
							}}
							onPress={dragButtonProps.onPress}
						>
							<svg
								className="text-muted-fg block-5 inline-5 sm:block-4 sm:inline-4"
								fill="none"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M11 5.5C11 6.32843 10.3284 7 9.5 7C8.67157 7 8 6.32843 8 5.5C8 4.67157 8.67157 4 9.5 4C10.3284 4 11 4.67157 11 5.5Z"
									fill="currentColor"
								/>
								<path
									d="M16 5.5C16 6.32843 15.3284 7 14.5 7C13.6716 7 13 6.32843 13 5.5C13 4.67157 13.6716 4 14.5 4C15.3284 4 16 4.67157 16 5.5Z"
									fill="currentColor"
								/>
								<path
									d="M11 18.5C11 19.3284 10.3284 20 9.5 20C8.67157 20 8 19.3284 8 18.5C8 17.6716 8.67157 17 9.5 17C10.3284 17 11 17.6716 11 18.5Z"
									fill="currentColor"
								/>
								<path
									d="M16 18.5C16 19.3284 15.3284 20 14.5 20C13.6716 20 13 19.3284 13 18.5C13 17.6716 13.6716 17 14.5 17C15.3284 17 16 17.6716 16 18.5Z"
									fill="currentColor"
								/>
								<path
									d="M11 12C11 12.8284 10.3284 13.5 9.5 13.5C8.67157 13.5 8 12.8284 8 12C8 11.1716 8.67157 10.5 9.5 10.5C10.3284 10.5 11 11.1716 11 12Z"
									fill="currentColor"
								/>
								<path
									d="M16 12C16 12.8284 15.3284 13.5 14.5 13.5C13.6716 13.5 13 12.8284 13 12C13 11.1716 13.6716 10.5 14.5 10.5C15.3284 10.5 16 11.1716 16 12Z"
									fill="currentColor"
								/>
							</svg>
						</AriaButton>
						<Heading className="flex flex-1 items-center">
							<AriaButton
								className="flex flex-1 items-center gap-x-2 text-start text-sm/6 font-medium outline-hidden"
								slot="trigger"
							>
								{contentBlockTypeIcons[item.type]}
								<span className="flex-1">{contentBlockTypeNames[item.type]}</span>
								<ChevronDownIcon className="shrink-0 transition-transform block-4 inline-4 group-data-expanded:rotate-180" />
							</AriaButton>
						</Heading>
						<Modal>
							<AriaButton
								aria-label={t("Remove block")}
								className="shrink-0 rounded-sm text-muted-fg hover:text-danger focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
							>
								<TrashIcon className="block-4 inline-4" />
							</AriaButton>
							<ModalContent role="alertdialog" size="sm">
								<ModalHeader>
									<ModalTitle>{t("Remove block")}</ModalTitle>
								</ModalHeader>
								<ModalBody>
									<p className="text-sm/6 text-muted-fg">
										{t(
											"Are you sure you want to remove this content block? This action cannot be undone.",
										)}
									</p>
								</ModalBody>
								<ModalFooter>
									<ModalClose>{t("Cancel")}</ModalClose>
									<Button intent="danger" onPress={onDelete} slot="close">
										{t("Remove")}
									</Button>
								</ModalFooter>
							</ModalContent>
						</Modal>
					</div>
					{/* Named so the panel is announced as its own region rather than inheriting the
					    surrounding form, and so each block's fields can be addressed unambiguously. */}
					<DisclosurePanel aria-label={contentBlockTypeNames[item.type]} className="px-3 pbe-3">
						<ContentBlockPanel
							hasFootnotes={hasFootnotes}
							initialAssets={initialAssets}
							item={item}
							onChange={onUpdate}
						/>
					</DisclosurePanel>
				</Disclosure>
			</div>
			{isDropTarget && dropPosition === "after" && (
				<div aria-hidden={true} className="mx-1 rounded-full bg-accent block-0.5" />
			)}
		</>
	);
}

interface ContentBlockPanelProps {
	hasFootnotes: boolean;
	initialAssets?: Array<MediaLibraryAsset>;
	item: ContentBlockListItem;
	onChange: (content: NonNullable<PanelContentBlockItem["content"]>) => void;
}

function ContentBlockPanel({
	hasFootnotes,
	initialAssets,
	item,
	onChange,
}: Readonly<ContentBlockPanelProps>): ReactNode {
	switch (item.type) {
		// These are in `UNIFIED_BLOCK_TYPES`, so they only ever exist as nodes inside a unified
		// document and never reach the list as items of their own — they are edited through their
		// node views in the richtext editor. `accordion_item` never appears at this level at all: it
		// only exists inside an accordion. The cases remain because the types stay in `ContentBlock`:
		// that is the shape the server hands us before merging.
		case "accordion":
		case "accordion_item":
		case "callout":
		case "embed":
		case "gallery":
		case "image":
		case "media_text": {
			return null;
		}

		case "data": {
			return <DataContentBlockPanel item={item} onChange={onChange} />;
		}

		case "hero": {
			return (
				<HeroContentBlockPanel initialAssets={initialAssets} item={item} onChange={onChange} />
			);
		}

		case "rich_text":
		case "unified_content": {
			return (
				<RichTextEditor
					aria-label="Content"
					className="inline-full"
					content={item.content}
					onChange={(content: JSONContent) => {
						onChange(content);
					}}
					blocks={[
						"embed",
						"callout",
						"accordion",
						"mediaText",
						"gallery",
						"buttonLink",
						"placeholderValue",
						// Only where the entity's form asked for them; every other editor also refuses to take
						// one by paste.
						...(hasFootnotes ? (["footnote"] as const) : []),
					]}
					renderAssetMetadata={({ imageKey, onMetadataChange }) => (
						<BlockAssetMetadata assetKey={imageKey} onMetadataChange={onMetadataChange} />
					)}
					renderImagePicker={
						initialAssets != null
							? (insert) => (
									<MediaLibraryDialog
										defaultPrefix="images"
										initialAssets={initialAssets}
										onSelect={(key, url, asset) => {
											insert(key, url, asset);
										}}
										prefixes={["avatars", "images", "logos"]}
										trigger={({ open }) => (
											<RichTextEditorToolbarButton
												aria-label="Insert image"
												icon={ImageIcon}
												onClick={open}
											/>
										)}
									/>
								)
							: undefined
					}
					renderImageInsert={
						initialAssets != null
							? ({ isOpen, onOpenChange, select }) => (
									<MediaLibraryDialog
										defaultPrefix="images"
										initialAssets={initialAssets}
										isOpen={isOpen}
										onOpenChange={onOpenChange}
										onSelect={select}
										prefixes={["avatars", "images", "logos"]}
									/>
								)
							: undefined
					}
					renderDocumentPicker={
						initialAssets != null
							? ({ isOpen, onOpenChange, select, current }) => (
									<MediaLibraryDialog
										acceptedFileTypes={documentMimeTypes}
										defaultPrefix="documents"
										initialAssets={initialAssets}
										isOpen={isOpen}
										onOpenChange={onOpenChange}
										onSelect={(key, _url, asset) => {
											select(key, asset?.label ?? key);
										}}
										prefixes={["documents"]}
										selectedKey={current}
									/>
								)
							: undefined
					}
					renderEntityPicker={({ isOpen, onOpenChange, select, current }) => (
						<EntityLinkDialog
							isOpen={isOpen}
							onOpenChange={onOpenChange}
							onSelect={select}
							selectedEntityId={current}
						/>
					)}
					renderLinkTargetSummary={(target) => <LinkTargetSummary target={target} />}
				/>
			);
		}

		default: {
			return null;
		}
	}
}

interface ContentBlockEntry {
	id: string;
	title: string;
}

interface DataContentBlockPanelProps {
	item: DataContentBlockItem;
	onChange: (content: NonNullable<DataContentBlockItem["content"]>) => void;
}

function DataContentBlockPanel({
	item,
	onChange,
}: Readonly<DataContentBlockPanelProps>): ReactNode {
	const t = useExtracted();

	const dataType = item.content?.dataType;
	// selectedIds === undefined → recent mode; selectedIds is an array → explicit mode
	const selectedIds = item.content?.selectedIds;
	const isExplicit = selectedIds !== undefined;
	const limit = item.content?.limit;

	const [query, setQuery] = useState("");
	const [entries, setEntries] = useState<Array<ContentBlockEntry>>([]);

	async function fetchEntries(type: DataContentBlockType, q: string) {
		const params = new URLSearchParams({ type, limit: "20" });
		if (q.trim() !== "") {
			params.set("q", q.trim());
		}
		const res = await fetch(`/api/content-block-entries?${params.toString()}`);
		const data = (await res.json()) as { items: Array<ContentBlockEntry> };
		setEntries(data.items);
	}

	return (
		<div className="flex flex-col gap-y-4">
			<Select
				onChange={(key) => {
					onChange({
						...item.content,
						dataType: key as DataContentBlockType,
						selectedIds: undefined,
					});
					setQuery("");
					setEntries([]);
				}}
				value={dataType ?? null}
			>
				<Label>{t("Data type")}</Label>
				<SelectTrigger />
				<SelectContent
					items={DATA_CONTENT_BLOCK_TYPES.map((id) => {
						const labels: Record<(typeof DATA_CONTENT_BLOCK_TYPES)[number], string> = {
							events: t("Events"),
							news: t("News"),
							opportunities: t("Opportunities"),
							funding_calls: t("Funding calls"),
							pages: t("Pages"),
							spotlight_articles: t("Spotlight articles"),
							impact_case_studies: t("Impact case studies"),
						};

						return { id, name: labels[id] };
					})}
				>
					{(entry) => (
						<SelectItem id={entry.id} textValue={entry.name}>
							<SelectLabel>{entry.name}</SelectLabel>
						</SelectItem>
					)}
				</SelectContent>
			</Select>

			{dataType != null && (
				<ToggleGroup
					aria-label={t("Selection mode")}
					disallowEmptySelection={true}
					onSelectionChange={(keys) => {
						const key = [...keys][0];
						if (key === "explicit") {
							onChange({ ...item.content, selectedIds: [], limit: undefined });
							setQuery("");
							void fetchEntries(dataType, "");
						} else {
							onChange({ ...item.content, selectedIds: undefined, limit: limit ?? 5 });
							setQuery("");
							setEntries([]);
						}
					}}
					selectedKeys={isExplicit ? new Set(["explicit"]) : new Set(["recent"])}
					selectionMode="single"
				>
					<ToggleGroupItem id="recent">{t("Most recent")}</ToggleGroupItem>
					<ToggleGroupItem id="explicit">{t("Explicit selection")}</ToggleGroupItem>
				</ToggleGroup>
			)}

			{dataType != null && !isExplicit && (
				<NumberField
					maxValue={50}
					minValue={1}
					onChange={(value) => {
						onChange({ ...item.content, limit: value });
					}}
					value={limit ?? 5}
				>
					<Label>{t("Number of entries")}</Label>
					<NumberInput />
				</NumberField>
			)}

			{dataType != null && isExplicit && (
				<div className="flex flex-col gap-y-3">
					<SearchField
						aria-label={t("Search")}
						onChange={(q) => {
							setQuery(q);
							void fetchEntries(dataType, q);
						}}
						value={query}
					>
						<SearchInput />
					</SearchField>
					<div className="flex flex-col gap-y-2 overflow-y-auto rounded-lg border border-border p-2 max-block-64">
						{entries.length === 0 ? (
							<p className="px-2 py-1 text-sm text-muted-fg">
								{query.trim() !== "" ? t("No entries found.") : t("Search to browse entries.")}
							</p>
						) : (
							entries.map((entry) => (
								<Checkbox
									key={entry.id}
									// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
									isSelected={selectedIds?.includes(entry.id) ?? false}
									onChange={(checked) => {
										const next = checked
											? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
												[...(selectedIds ?? []), entry.id]
											: // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
												(selectedIds ?? []).filter((id) => id !== entry.id);
										onChange({ ...item.content, selectedIds: next });
									}}
								>
									{entry.title}
								</Checkbox>
							))
						)}
					</div>
					{/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
					{selectedIds != null && selectedIds.length > 0 && (
						<p className="text-xs text-muted-fg">
							{selectedIds.length} {t("selected")}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

interface HeroContentBlockPanelProps {
	initialAssets?: Array<MediaLibraryAsset>;
	item: HeroContentBlockItem;
	onChange: (content: NonNullable<HeroContentBlockItem["content"]>) => void;
}

function HeroContentBlockPanel({
	initialAssets,
	item,
	onChange,
}: Readonly<HeroContentBlockPanelProps>): ReactNode {
	const t = useExtracted();

	const title = item.content?.title;
	const eyebrow = item.content?.eyebrow;
	const imageKey = item.content?.imageKey;
	const imageUrl = item.content?.imageUrl;
	const asset = item.content?.asset;
	const ctas = item.content?.ctas ?? [];

	const picker = (
		<MediaLibraryDialog
			defaultPrefix="images"
			initialAssets={initialAssets ?? []}
			onSelect={(key, url, selected) => {
				onChange({
					...item.content,
					imageKey: key,
					imageUrl: url,
					asset: { ...selected, key, url },
				});
			}}
			prefixes={["avatars", "images", "logos"]}
			triggerLabel={imageUrl != null ? t("Change image") : undefined}
		/>
	);

	return (
		<div className="flex flex-col gap-y-4">
			<TextField
				isRequired={true}
				onChange={(value) => {
					onChange({ ...item.content, title: value });
				}}
				value={title ?? ""}
			>
				<Label>{t("Title")}</Label>
				<Input />
			</TextField>
			<TextField
				onChange={(value) => {
					onChange({ ...item.content, eyebrow: value });
				}}
				value={eyebrow ?? ""}
			>
				<Label>{t("Eyebrow")}</Label>
				<Input />
			</TextField>
			<div className="flex flex-col gap-y-3">
				<Label>{t("Image")}</Label>
				{asset != null ? (
					<SelectedImageCard
						footer={
							<ImageCaptionModeField
								assetCaption={asset.caption}
								caption={item.content?.caption ?? null}
								captionMode={item.content?.captionMode ?? "inherit"}
								onChange={(value) => {
									onChange({ ...item.content, ...value });
								}}
							/>
						}
						image={asset}
						onMetadataChange={(next) => {
							onChange({ ...item.content, asset: next });
						}}
					>
						{picker}
					</SelectedImageCard>
				) : (
					picker
				)}
				{imageKey != null && (
					<input name="heroContentBlock.imageKey" type="hidden" value={imageKey} />
				)}
			</div>
			<div className="flex flex-col gap-y-3">
				<Label>{t("CTAs")}</Label>
				{ctas.map((cta, idx) => (
					<div key={idx} className="flex items-end gap-x-2">
						<TextField
							className="flex-1"
							isRequired={true}
							onChange={(value) => {
								const next = ctas.map((c, i) => (i === idx ? { ...c, label: value } : c));
								onChange({ ...item.content, ctas: next });
							}}
							value={cta.label}
						>
							<Label>{t("Label")}</Label>
							<Input />
						</TextField>
						<TextField
							className="flex-1"
							isRequired={true}
							onChange={(value) => {
								const next = ctas.map((c, i) => (i === idx ? { ...c, url: value } : c));
								onChange({ ...item.content, ctas: next });
							}}
							value={cta.url}
						>
							<Label>{t("URL")}</Label>
							<Input placeholder="https://" />
						</TextField>
						<Button
							intent="outline"
							onPress={() => {
								const next = ctas.filter((_, i) => i !== idx);
								onChange({ ...item.content, ctas: next });
							}}
							size="sm"
						>
							<TrashIcon className="block-4 inline-4" />
						</Button>
					</div>
				))}
				<Button
					intent="secondary"
					onPress={() => {
						onChange({ ...item.content, ctas: [...ctas, { label: "", url: "" }] });
					}}
					size="sm"
				>
					<PlusIcon className="block-4 inline-4" />
					{t("Add CTA")}
				</Button>
			</div>
		</div>
	);
}

interface ContentBlockMenuProps {
	onAdd: (type: ContentBlockListItem["type"]) => void;
}

const MENU_BLOCK_TYPES: Array<{
	type: ContentBlockListItem["type"];
	icon: ReactNode;
}> = [
	{ type: "unified_content", icon: <PencilSquareIcon /> },
	{ type: "data", icon: <Square3Stack3DIcon /> },
	{ type: "hero", icon: <RectangleGroupIcon /> },
];

export function ContentBlockMenu({ onAdd }: Readonly<ContentBlockMenuProps>): ReactNode {
	const t = useExtracted();

	const contentBlockTypeNames: Record<ContentBlockListItem["type"], string> = {
		accordion: t("Accordion"),
		accordion_item: t("Accordion panel"),
		callout: t("Callout"),
		data: t("Data"),
		embed: t("Embed"),
		gallery: t("Gallery"),
		hero: t("Hero"),
		image: t("Image"),
		media_text: t("Media with text"),
		rich_text: t("Rich text"),
		unified_content: t("Content"),
	};

	return (
		<Menu>
			<Button intent="secondary">
				<PlusIcon />
				Add block
			</Button>
			<MenuContent className="min-inline-60" placement="bottom">
				{MENU_BLOCK_TYPES.map(({ type, icon }) => (
					<MenuItem
						key={type}
						onAction={() => {
							onAdd(type);
						}}
					>
						{icon}
						<MenuLabel>{contentBlockTypeNames[type]}</MenuLabel>
					</MenuItem>
				))}
			</MenuContent>
		</Menu>
	);
}

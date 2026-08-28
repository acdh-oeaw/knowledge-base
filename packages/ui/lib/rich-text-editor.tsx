// oxlint-disable jsx-a11y/iframe-has-title

"use client";

import {
	placeholderValueKindLabels,
	placeholderValueKindsEnum,
} from "@dariah-eric/database/placeholder-values";
import { type Extensions, type JSONContent, Node, mergeAttributes } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableKit } from "@tiptap/extension-table/kit";
import { Typography } from "@tiptap/extension-typography";
import {
	EditorContent,
	NodeViewContent,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
	useEditor,
	useEditorState,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import cn from "clsx/lite";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChevronDownIcon,
	LinkIcon,
	PaperclipIcon,
	PencilIcon,
	PlusIcon,
	TableIcon,
	Trash2Icon,
	VariableIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { twMerge } from "tailwind-merge";

import { Button } from "@/lib/button";
import { ButtonLink } from "@/lib/button-link";
import { buttonStyles } from "@/lib/button-styles";
import { InlineRichTextEditor } from "@/lib/inline-rich-text-editor";
import { InlineRichTextRenderer } from "@/lib/inline-rich-text-renderer";
import { Input } from "@/lib/input";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuSubMenu,
	MenuTrigger,
} from "@/lib/menu";
import { Note } from "@/lib/note";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/popover";
import {
	collectFootnotes,
	formatPlaceholderValue,
	isEmptyRichTextDocument,
	toPlainText,
} from "@/lib/rich-text";
import {
	type RichTextInsertableBlock,
	selectRichTextActiveState,
	useRichTextActions,
} from "@/lib/rich-text-actions";
import {
	type ButtonLinkVariant,
	type CalloutIntent,
	type GalleryItemAttrs,
	type GalleryLayout,
	type ImageCaptionMode,
	type ImageLayout,
	type MediaTextSide,
	captionFromElementText,
	normalizeButtonLinkVariant,
	normalizeCalloutIntent,
	normalizeGalleryItems,
	normalizeGalleryLayout,
	normalizeImageLayout,
	normalizeMediaTextSide,
	parseCaptionAttr,
	parseGalleryItemsAttr,
	resolveImageCaption,
	serializeCaptionAttr,
	serializeGalleryItemsAttr,
} from "@/lib/rich-text-block-attrs";
import { FootnotePasteGuard } from "@/lib/rich-text-footnote";
import { FootnoteNode, inlineFootnoteExtensions } from "@/lib/rich-text-footnote-node";
import {
	type SlashCommandHandlers,
	SlashCommandMenu,
	createSlashCommandExtension,
} from "@/lib/rich-text-slash-menu";
import { RichTextEditorToolbarButton } from "@/lib/rich-text-toolbar-button";
import { ToggleGroup, ToggleGroupItem } from "@/lib/toggle-group";
import { Tooltip, TooltipContent } from "@/lib/tooltip";

type RichTextSize = "sm" | "md" | "lg";

const richtextSizeClass: Record<RichTextSize, string> = {
	sm: "richtext-sm",
	md: "richtext-base",
	lg: "richtext-lg",
};

interface RichTextEditorProps {
	"aria-label"?: string;
	className?: string;
	/** Scales the text of the content element. Defaults to the base `richtext` sizing when omitted. */
	size?: RichTextSize;
	content?: JSONContent;
	isEditable?: boolean;
	name?: string;
	onChange?: (content: JSONContent) => void;
	/**
	 * Optional blocks the surrounding form allows, beyond the ones every editor offers. Each is
	 * self-contained — the editor inserts it and its node view opens whatever panel it needs — so
	 * enabling one is a matter of naming it, not of handing back a button to insert it.
	 *
	 * Defaults to none, so a plain editor stays a plain editor.
	 */
	blocks?: ReadonlyArray<RichTextInsertableBlock>;
	/**
	 * Picker a block's own panel opens, to fill in or replace the image it points at. Rendered by the
	 * node view with a trigger of its own, so this keeps the trigger-shaped signature.
	 */
	renderImagePicker?: (insert: InsertImage) => ReactNode;
	/**
	 * Picker the insert menu opens, to drop a finished image into the document. Separate from
	 * `renderImagePicker` because the menu has to own when it opens — inserting an empty image and
	 * making the author fill it in from its panel would cost three clicks the toolbar never did.
	 */
	renderImageInsert?: (args: RichTextPickerRenderArgs<InsertImage>) => ReactNode;
	/**
	 * Card identifying the asset a block points at - what it is called, what it already says, and how
	 * to correct that. Blocks store only a storage key, so the app resolves it: this package cannot
	 * read the media library itself. `onMetadataChange` reports edits back so the block can refresh
	 * the asset data it keeps beside the key.
	 */
	renderAssetMetadata?: (args: {
		imageKey: string;
		onMetadataChange: (metadata: { alt: string | null; caption: JSONContent | null }) => void;
	}) => ReactNode;
	/**
	 * Picker for linking selected text to a stored document. Rendered outside the insert menu and
	 * opened by it: the picker is a modal dialog, and a dialog mounted inside a menu goes away with
	 * the menu that opened it.
	 */
	renderDocumentPicker?: (
		args: RichTextTargetPickerRenderArgs<(assetKey: string, label: string) => void>,
	) => ReactNode;
	/** Picker for linking selected text to another entity. Rendered the same way, for the same reason. */
	renderEntityPicker?: (
		args: RichTextTargetPickerRenderArgs<(entityId: string, label: string) => void>,
	) => ReactNode;
	/**
	 * Names the target a link points at, for the link popover. A link that points at something we own
	 * stores only the reference, so the editor can say which _kind_ of thing it is but not which one:
	 * resolving an asset key or a document id to a title needs the media library or the database, and
	 * this package can read neither. Same division as `renderAssetMetadata`.
	 *
	 * Falls back to naming the kind alone where the host supplies nothing.
	 */
	renderLinkTargetSummary?: (
		target: { kind: "asset"; assetKey: string } | { kind: "entity"; entityId: string },
	) => ReactNode;
}

export type InsertImage = (
	imageKey: string,
	imageUrl: string,
	asset?: { alt?: string | null; caption?: JSONContent | null },
) => void;

/**
 * A host-owned dialog the insert menu drives. The editor decides when it is open — the menu item
 * that opens it has closed the menu by then — and the host renders it wherever it likes.
 */
export interface RichTextPickerRenderArgs<TSelect> {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	select: TSelect;
}

/**
 * What a link-target picker is handed. Beyond opening and reporting a choice, it is told which
 * target it is replacing, so "change this link" opens on the document or page the link points at
 * now rather than on an empty picker.
 */
export interface RichTextTargetPickerRenderArgs<TSelect> extends RichTextPickerRenderArgs<TSelect> {
	/**
	 * The asset key or document id the link at the cursor points at, when the picker was opened from
	 * the link popover to change it. `null` when the insert menu opened it to make a new link.
	 */
	current: string | null;
}

function normalizeInitialContent(content: JSONContent | undefined): JSONContent | undefined {
	if (content == null) {
		return undefined;
	}

	if (typeof content !== "object" || typeof content.type !== "string") {
		return undefined;
	}

	return content;
}

type ImagePickerRenderer = NonNullable<RichTextEditorProps["renderImagePicker"]>;
type AssetMetadataRenderer = NonNullable<RichTextEditorProps["renderAssetMetadata"]>;
// Re-export so existing consumers can keep importing from `@dariah-eric/ui/rich-text-editor`.
export { RichTextEditorToolbarButton };
export type { RichTextEditorToolbarButtonProps } from "@/lib/rich-text-toolbar-button";

// Keep the internal alias for backward-compat within this file.
const RichTextEditorIconButton = RichTextEditorToolbarButton;

/**
 * Matches `RichTextEditorToolbarButton` for the toolbar controls that have to own their own
 * element: a popover or menu trigger is the button, so it cannot wrap one.
 */
const toolbarTriggerClassName =
	"relative inline-flex block-8 cursor-pointer items-center justify-center gap-x-1 rounded-md border-transparent bg-transparent transition-colors text-muted-fg hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pressed:bg-primary-subtle/50 pressed:text-fg";

interface BlockNodeSurfaceProps {
	children: ReactNode;
	className?: string;
	isEditable: boolean;
	isEditing: boolean;
	isSelected?: boolean;
	label: string;
	onDoubleClick?: () => void;
}

function BlockNodeSurface({
	children,
	className,
	isEditable,
	isEditing,
	isSelected = false,
	label,
	onDoubleClick,
}: Readonly<BlockNodeSurfaceProps>): ReactNode {
	const wrapperRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		/** ProseMirror puts `draggable` on the node-view container outside `NodeViewWrapper`. */
		const nodeViewContainer = wrapperRef.current?.parentElement;
		if (nodeViewContainer == null) {
			return;
		}
		if (isEditing || !isEditable) {
			nodeViewContainer.removeAttribute("draggable");
		} else {
			nodeViewContainer.setAttribute("draggable", "true");
		}
	}, [isEditable, isEditing]);

	return (
		<NodeViewWrapper ref={wrapperRef} data-drag-handle={isEditing || !isEditable ? undefined : ""}>
			<div
				aria-label={label}
				className={twMerge(
					"my-2 overflow-clip rounded-lg border border-input bg-bg transition-shadow",
					isEditable && "cursor-default",
					isSelected && "border-primary ring-2 ring-primary/20",
					className,
				)}
				contentEditable={false}
				onDoubleClick={(e) => {
					if (isEditing || !isEditable || onDoubleClick == null) {
						return;
					}
					e.preventDefault();
					onDoubleClick();
				}}
			>
				{children}
			</div>
		</NodeViewWrapper>
	);
}

/**
 * Footer of a block edit panel. Its buttons act on the block as a whole rather than on the setting
 * directly above them, so they sit below a rule which spans the full panel — the panel's own `p-4`
 * is reversed out and then reapplied.
 */
const blockPanelFooterClassName =
	"-ms-4 -me-4 mbs-1 flex items-center gap-x-2 border-bs border-border px-4 pbs-3";

function getEmbedUrl(url: string): string {
	const watchMatch = /youtube\.com\/watch\?.*?v=([\w-]+)/.exec(url);
	if (watchMatch != null) {
		return `https://www.youtube-nocookie.com/embed/${watchMatch[1]!}`;
	}
	const shortMatch = /youtu\.be\/([\w-]+)/.exec(url);
	if (shortMatch != null) {
		return `https://www.youtube-nocookie.com/embed/${shortMatch[1]!}`;
	}
	return url;
}

interface EmbedNodeViewProps extends NodeViewProps {
	hasFootnotes?: boolean;
}

function EmbedNodeView({
	editor,
	getPos,
	node,
	selected,
	updateAttributes,
	deleteNode,
	hasFootnotes = false,
}: Readonly<EmbedNodeViewProps>): ReactNode {
	const url = node.attrs.url as string | null;
	const title = node.attrs.title as string | null;
	const caption = node.attrs.caption as JSONContent | null;

	const [isEditing, setIsEditing] = useState(url == null && editor.isEditable);
	const [urlInput, setUrlInput] = useState(url ?? "");
	const [titleInput, setTitleInput] = useState(title ?? "");
	const [captionJson, setCaptionJson] = useState<JSONContent | null>(caption);

	function handleApply() {
		if (!urlInput.trim() || !titleInput.trim()) {
			return;
		}
		updateAttributes({
			url: urlInput.trim(),
			title: titleInput.trim(),
			caption: isEmptyRichTextDocument(captionJson) ? null : captionJson,
		});
		setIsEditing(false);
	}

	const embedUrl = url != null ? getEmbedUrl(url) : null;

	const urlInputId = useId();
	const titleInputId = useId();

	function resetInputs() {
		setUrlInput(url ?? "");
		setTitleInput(title ?? "");
		setCaptionJson(caption);
	}

	function selectNode() {
		const pos = getPos();
		if (typeof pos !== "number") {
			return;
		}
		editor.commands.setNodeSelection(pos);
	}

	return (
		<BlockNodeSurface
			isEditable={editor.isEditable}
			isEditing={isEditing}
			isSelected={selected}
			label="Embed block"
			onDoubleClick={() => {
				selectNode();
				resetInputs();
				setIsEditing(true);
			}}
		>
			<div className={twMerge("transition-opacity", selected && "bg-primary-subtle/10")}>
				{isEditing ? (
					<div className="flex flex-col gap-y-3 p-4 select-none **:[[contenteditable]]:select-text [&_input]:select-text">
						<div className="flex flex-col gap-y-1">
							<label className="text-sm/6 font-medium" htmlFor={urlInputId}>
								{"URL"}
							</label>
							<Input
								id={urlInputId}
								onChange={(e) => {
									setUrlInput(e.target.value);
								}}
								placeholder="https://"
								type="url"
								value={urlInput}
							/>
						</div>
						<div className="flex flex-col gap-y-1">
							<label className="text-sm/6 font-medium" htmlFor={titleInputId}>
								{"Title"}
							</label>
							<Input
								id={titleInputId}
								onChange={(e) => {
									setTitleInput(e.target.value);
								}}
								placeholder="Descriptive title for screen readers"
								type="text"
								value={titleInput}
							/>
						</div>
						<div className="flex flex-col gap-y-1">
							<span className="text-sm/6 font-medium">{"Caption"}</span>
							<InlineRichTextEditor
								aria-label="Caption"
								content={caption ?? undefined}
								extensions={hasFootnotes ? inlineFootnoteExtensions : undefined}
								onChange={setCaptionJson}
							/>
						</div>
						<div className={blockPanelFooterClassName}>
							<Button
								intent="primary"
								isDisabled={!urlInput.trim() || !titleInput.trim()}
								onPress={handleApply}
								size="sm"
								type="button"
							>
								{"Apply"}
							</Button>
							{url != null ? (
								<Button
									intent="outline"
									onPress={() => {
										setIsEditing(false);
									}}
									size="sm"
									type="button"
								>
									{"Cancel"}
								</Button>
							) : (
								<Button intent="outline" onPress={deleteNode} size="sm" type="button">
									{"Remove"}
								</Button>
							)}
						</div>
					</div>
				) : (
					<div>
						{embedUrl != null && (
							<div className="aspect-video inline-full">
								<iframe
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowFullScreen={true}
									className="block-full inline-full"
									referrerPolicy="strict-origin-when-cross-origin"
									sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
									src={embedUrl}
									title={title ?? embedUrl}
								/>
							</div>
						)}
						{editor.isEditable ? (
							<div className="flex items-center justify-between gap-x-2 border-bs border-border px-4 py-2">
								<span className="truncate text-xs text-muted-fg min-inline-0">{url}</span>
								<div className="flex shrink-0 gap-x-1">
									<button
										aria-label="Edit embed"
										className="rounded-sm p-1 text-muted-fg hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={() => {
											selectNode();
											setUrlInput(url ?? "");
											setTitleInput(title ?? "");
											setCaptionJson(caption);
											setIsEditing(true);
										}}
										type="button"
									>
										<PencilIcon className="block-3.5 inline-3.5" />
									</button>
									<button
										aria-label="Remove embed"
										className="rounded-sm p-1 text-muted-fg hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={deleteNode}
										type="button"
									>
										<Trash2Icon className="block-3.5 inline-3.5" />
									</button>
								</div>
							</div>
						) : (
							<div className="border-bs border-border px-4 py-2">
								<span className="truncate text-xs text-muted-fg min-inline-0">{url}</span>
							</div>
						)}
						{!isEmptyRichTextDocument(caption) ? (
							<InlineRichTextRenderer
								className="border-bs border-border px-4 py-2 text-muted-fg"
								content={caption!}
							/>
						) : null}
					</div>
				)}
			</div>
		</BlockNodeSurface>
	);
}

/**
 * Block-level embed node (YouTube, iframes). Stores url/title/caption and renders an inline editing
 * UI via a React NodeView.
 */
function createEmbedNode(hasFootnotes = false): Node {
	return Node.create({
		name: "embedBlock",
		group: "block",
		atom: true,
		draggable: true,
		selectable: true,

		addAttributes() {
			return {
				url: { default: null },
				title: { default: null },
				caption: { default: null },
			};
		},

		parseHTML() {
			return [
				{
					tag: "div[data-embed-block]",
					getAttrs(dom) {
						const el = dom;
						return {
							url: el.dataset.url,
							title: el.dataset.title,
							caption: parseCaptionAttr(el.dataset.caption),
						};
					},
				},
			];
		},

		renderHTML({ node }) {
			return [
				"div",
				{
					"data-embed-block": "",
					"data-url": node.attrs.url as string | null,
					"data-title": node.attrs.title as string | null,
					"data-caption": serializeCaptionAttr(node.attrs.caption as JSONContent | null),
				},
			];
		},

		addNodeView() {
			return ReactNodeViewRenderer((props) => (
				<EmbedNodeView {...props} hasFootnotes={hasFootnotes} />
			));
		},
	});
}

/**
 * Marks a container node's DOM as draggable, and hands back the ref to put on its
 * `NodeViewWrapper`.
 *
 * ProseMirror sets `draggable` itself only for nodes with no content hole (see `NodeViewDesc`), so
 * a container — whose body is editable prose — never gets it. Without the attribute the browser
 * fires no `dragstart`, tiptap's `data-drag-handle` handling never runs, and the block cannot be
 * moved at all. The same reason `BlockNodeSurface` sets it for the atoms it wraps.
 *
 * Cleared while the node is not draggable — a read-only editor, or a settings panel the author is
 * filling in — so a drag can never start from a form.
 */
function useContainerDraggable(isDraggable: boolean): RefObject<HTMLDivElement | null> {
	const wrapperRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const nodeViewContainer = wrapperRef.current?.parentElement;
		if (nodeViewContainer == null) {
			return;
		}

		if (isDraggable) {
			nodeViewContainer.setAttribute("draggable", "true");
		} else {
			nodeViewContainer.removeAttribute("draggable");
		}
	}, [isDraggable]);

	return wrapperRef;
}

/**
 * The settings a callout carries beside its body: how loudly it speaks, and what it is called. Both
 * are committed on Apply rather than per keystroke — writing straight to `updateAttributes` would
 * dispatch a transaction into the outer editor on every character.
 */
function CalloutSettings({
	intent,
	onApply,
	onCancel,
	title,
}: Readonly<{
	intent: CalloutIntent;
	onApply: (values: { intent: CalloutIntent; title: string | null }) => void;
	onCancel: () => void;
	title: string | null;
}>): ReactNode {
	const [intentInput, setIntentInput] = useState<CalloutIntent>(intent);
	const [titleInput, setTitleInput] = useState(title ?? "");
	const titleInputId = useId();

	return (
		<div
			className="flex flex-col gap-y-3 border border-input bg-bg p-4 select-none [&_input]:select-text"
			contentEditable={false}
		>
			<div className="flex flex-col gap-y-1">
				<span className="text-sm/6 font-medium">{"Style"}</span>
				<ToggleGroup
					aria-label="Callout style"
					disallowEmptySelection={true}
					onSelectionChange={(keys) => {
						const nextIntent = [...keys][0] as CalloutIntent | undefined;
						if (nextIntent != null) {
							setIntentInput(nextIntent);
						}
					}}
					selectedKeys={[intentInput]}
					size="sm"
				>
					<ToggleGroupItem id="neutral">{"Neutral"}</ToggleGroupItem>
					<ToggleGroupItem id="info">{"Info"}</ToggleGroupItem>
					<ToggleGroupItem id="warning">{"Warning"}</ToggleGroupItem>
					<ToggleGroupItem id="danger">{"Danger"}</ToggleGroupItem>
					<ToggleGroupItem id="success">{"Success"}</ToggleGroupItem>
				</ToggleGroup>
			</div>
			<div className="flex flex-col gap-y-1">
				<label className="text-sm/6 font-medium" htmlFor={titleInputId}>
					{"Title (optional)"}
				</label>
				<Input
					id={titleInputId}
					onChange={(event) => {
						setTitleInput(event.target.value);
					}}
					value={titleInput}
				/>
			</div>
			<div className={blockPanelFooterClassName}>
				<Button
					intent="primary"
					onPress={() => {
						onApply({ intent: intentInput, title: titleInput.trim() || null });
					}}
					size="sm"
					type="button"
				>
					{"Apply"}
				</Button>
				<Button intent="outline" onPress={onCancel} size="sm" type="button">
					{"Cancel"}
				</Button>
			</div>
		</div>
	);
}

/**
 * A callout as the author edits it: framing that belongs to the block, wrapped around a body that
 * is ordinary document content.
 *
 * The body is a real content hole (`NodeViewContent`), not a document tucked into an attribute, so
 * everything the surrounding editor can do works inside a callout too — including dropping in an
 * image, which becomes an `image` block of its own on save and keeps a real reference to its
 * asset.
 */
function CalloutNodeView({
	editor,
	node,
	selected,
	updateAttributes,
	deleteNode,
}: Readonly<NodeViewProps>): ReactNode {
	const intent = normalizeCalloutIntent(node.attrs.intent);
	const title = node.attrs.title as string | null;
	const [isEditing, setIsEditing] = useState(false);
	const wrapperRef = useContainerDraggable(editor.isEditable && !isEditing);

	return (
		<NodeViewWrapper
			ref={wrapperRef}
			// A named group so the settings panel and the callout it configures read as one thing —
			// and so a test can address the block rather than whatever its current title happens to be.
			aria-label="Callout block"
			role="group"
		>
			{isEditing ? (
				<CalloutSettings
					intent={intent}
					onApply={(values) => {
						updateAttributes(values);
						setIsEditing(false);
					}}
					onCancel={() => {
						setIsEditing(false);
					}}
					title={title}
				/>
			) : null}
			<aside
				aria-label={title ?? `${intent} callout`}
				className={twMerge(
					"group relative my-2 rounded-lg transition-shadow",
					selected && "ring-2 ring-primary/20",
				)}
			>
				<Note intent={intent === "neutral" ? "default" : intent}>
					{/*
					    Both colours are restated because the editor sits inside a `richtext` container and the
					    preview does not, which otherwise inverts the pair: there the title is the only part of a
					    callout outside a `richtext` element (so it takes the note's intent colour) and the body
					    the only part inside one (so it takes the richtext body colour), while here the container
					    reaches the title's `strong` — painting it in the prose bold colour — and leaves the body
					    to inherit the note's.
					*/}
					{title != null ? (
						<strong className="mbe-1 block text-current" contentEditable={false}>
							{title}
						</strong>
					) : null}
					<NodeViewContent className="text-(--richtext-body)" data-callout-content="" />
				</Note>
				{editor.isEditable && !isEditing ? (
					// Chrome, not content: `contentEditable={false}` keeps ProseMirror from treating the
					// controls as part of the body, and the drag handle lives here so dragging the block
					// never competes with selecting the prose inside it.
					<div
						className="absolute inset-e-2 inset-bs-2 flex gap-x-1 opacity-0 transition-opacity group-hover:opacity-100"
						contentEditable={false}
						data-drag-handle=""
					>
						<button
							aria-label="Edit callout"
							className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-fg"
							onClick={() => {
								setIsEditing(true);
							}}
							type="button"
						>
							<PencilIcon className="block-3.5 inline-3.5" />
						</button>
						<button
							aria-label="Remove callout"
							className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-danger"
							onClick={deleteNode}
							type="button"
						>
							<Trash2Icon className="block-3.5 inline-3.5" />
						</button>
					</div>
				) : null}
			</aside>
		</NodeViewWrapper>
	);
}

export const CalloutNode = Node.create({
	name: "calloutBlock",
	// `container`, not `block`: a container's content spec accepts `block+`, so keeping containers out
	// of that group is what makes a callout inside a callout — or inside an accordion panel —
	// impossible in the schema rather than merely discouraged. The document node accepts both groups.
	group: "container",
	content: "block+",
	// `defining` keeps the callout when its content is replaced by a paste; `isolating` stops
	// backspace at the start of the body from lifting the prose out into the block above.
	defining: true,
	isolating: true,
	draggable: true,
	selectable: true,
	addAttributes() {
		return { intent: { default: "info" }, title: { default: null } };
	},
	parseHTML() {
		return [
			{
				tag: "aside[data-callout-block]",
				getAttrs(dom) {
					return {
						intent: normalizeCalloutIntent(dom.dataset.intent),
						title: dom.dataset.title ?? null,
					};
				},
			},
			{
				tag: "div[data-callout-block]",
				getAttrs(dom) {
					return {
						intent: normalizeCalloutIntent(dom.dataset.intent),
						title: dom.dataset.title ?? null,
					};
				},
			},
		];
	},
	renderHTML({ node }) {
		return [
			"aside",
			{
				"aria-label":
					(node.attrs.title as string | null) ?? `${node.attrs.intent as string} callout`,
				"data-callout-block": "",
				"data-intent": node.attrs.intent as string,
				"data-title": node.attrs.title as string | null,
			},
			0,
		];
	},
	addNodeView() {
		return ReactNodeViewRenderer(CalloutNodeView);
	},
});

/** One panel of an accordion: a summary the author types, and a body of ordinary blocks. */
function AccordionItemNodeView({
	editor,
	node,
	updateAttributes,
	deleteNode,
}: Readonly<NodeViewProps>): ReactNode {
	const title = node.attrs.title as string;
	const [titleInput, setTitleInput] = useState(title);
	const wrapperRef = useContainerDraggable(editor.isEditable);

	// The attribute is the source of truth; the input only holds keystrokes until they are committed.
	// Re-seeding on change is what makes undo, redo and a collaborator's edit show up in the field
	// instead of leaving it stranded on what was typed here.
	useEffect(() => {
		setTitleInput(title);
	}, [title]);

	function commitTitle() {
		const next = titleInput.trim();
		if (next !== title) {
			updateAttributes({ title: next });
		}
	}

	return (
		<NodeViewWrapper ref={wrapperRef}>
			<div className="border-be border-border p-4 last:border-be-0">
				{/* Chrome, not content — and the drag handle, so a panel can be reordered without the
				    gesture competing with selecting its prose. */}
				<div
					className="flex items-center gap-x-2"
					contentEditable={false}
					data-drag-handle={editor.isEditable ? "" : undefined}
				>
					{editor.isEditable ? (
						<>
							<Input
								aria-label="Panel title"
								className="flex-1"
								onBlur={commitTitle}
								onChange={(event) => {
									setTitleInput(event.target.value);
								}}
								placeholder="Panel title"
								value={titleInput}
							/>
							<button
								aria-label="Remove panel"
								className="rounded-sm p-1 text-muted-fg hover:text-danger"
								onClick={deleteNode}
								type="button"
							>
								<Trash2Icon className="block-4 inline-4" />
							</button>
						</>
					) : (
						<strong className="text-sm font-medium">{title}</strong>
					)}
				</div>
				<NodeViewContent className="mbs-2" data-accordion-item-content="" />
			</div>
		</NodeViewWrapper>
	);
}

export const AccordionItemNode = Node.create({
	name: "accordionItem",
	// In no group at all: an item is only ever reachable through `accordionBlock`'s content spec, so
	// it cannot be dropped into a document — or into a callout — on its own.
	content: "block+",
	defining: true,
	isolating: true,
	draggable: true,
	selectable: true,
	addAttributes() {
		return { title: { default: "" } };
	},
	parseHTML() {
		return [
			{
				tag: "div[data-accordion-item]",
				getAttrs(dom) {
					return { title: dom.dataset.title ?? "" };
				},
			},
		];
	},
	renderHTML({ node }) {
		return ["div", { "data-accordion-item": "", "data-title": node.attrs.title as string }, 0];
	},
	addNodeView() {
		return ReactNodeViewRenderer(AccordionItemNodeView);
	},
});

function AccordionNodeView({ editor, getPos, node }: Readonly<NodeViewProps>): ReactNode {
	const wrapperRef = useContainerDraggable(editor.isEditable);

	function addItem() {
		const pos = getPos();
		if (typeof pos !== "number") {
			return;
		}

		// Just inside the accordion's closing token, so the panel lands after the ones already there.
		editor
			.chain()
			.focus()
			.insertContentAt(pos + node.nodeSize - 1, {
				type: "accordionItem",
				attrs: { title: "" },
				content: [{ type: "paragraph" }],
			})
			.run();
	}

	return (
		<NodeViewWrapper ref={wrapperRef} aria-label="Accordion block" role="group">
			<div className="my-2 rounded-lg border border-border">
				<NodeViewContent />
				{editor.isEditable ? (
					<div className="border-bs border-border p-2" contentEditable={false}>
						<Button intent="outline" onPress={addItem} size="sm" type="button">
							<PlusIcon className="block-4 inline-4" />
							{"Add panel"}
						</Button>
					</div>
				) : null}
			</div>
		</NodeViewWrapper>
	);
}

export const AccordionNode = Node.create({
	name: "accordionBlock",
	group: "container",
	content: "accordionItem+",
	defining: true,
	isolating: true,
	draggable: true,
	selectable: true,
	parseHTML() {
		return [{ tag: "div[data-accordion-block]" }];
	},
	renderHTML() {
		return ["div", { "data-accordion-block": "" }, 0];
	},
	addNodeView() {
		return ReactNodeViewRenderer(AccordionNodeView);
	},
});

/**
 * The document, widened to take containers as well as ordinary blocks.
 *
 * StarterKit's own `doc` accepts `block+`, and containers are deliberately not in that group (see
 * {@link CalloutNode}) — so without this a callout could not sit at the top level either. Naming
 * both groups here is what draws the line in the schema: containers are legal in a document, and
 * nowhere else.
 */
const DocumentWithContainers = Node.create({
	name: "doc",
	topNode: true,
	content: "(block | container)+",
});

/**
 * Inline call-to-action node: a link rendered to look like a button. Stored as structured
 * `href`/`label`/`variant` attributes (not styled text) and edited through a popover anchored to
 * the button itself, mirroring the `EmbedNode`/`CalloutNode` pattern but at the inline level.
 */
function ButtonLinkNodeView({
	editor,
	getPos,
	node,
	selected,
	updateAttributes,
	deleteNode,
}: Readonly<NodeViewProps>): ReactNode {
	const href = node.attrs.href as string | null;
	const label = node.attrs.label as string | null;
	const variant = normalizeButtonLinkVariant(node.attrs.variant);

	const [isOpen, setIsOpen] = useState(href == null && editor.isEditable);
	const [hrefInput, setHrefInput] = useState(href ?? "");
	const [labelInput, setLabelInput] = useState(label ?? "");
	const [variantInput, setVariantInput] = useState<ButtonLinkVariant>(variant);

	const hrefInputId = useId();
	const labelInputId = useId();

	const displayLabel = label ?? "Button";

	if (!editor.isEditable) {
		return (
			<NodeViewWrapper as="span" className="inline-block align-baseline">
				<ButtonLink href={href ?? "#"} intent={variant} size="sm">
					{displayLabel}
				</ButtonLink>
			</NodeViewWrapper>
		);
	}

	function selectNode() {
		const pos = getPos();
		if (typeof pos === "number") {
			editor.commands.setNodeSelection(pos);
		}
	}

	function resetInputs() {
		setHrefInput(href ?? "");
		setLabelInput(label ?? "");
		setVariantInput(variant);
	}

	function handleApply() {
		const nextHref = hrefInput.trim();
		const nextLabel = labelInput.trim();
		if (!nextHref || !nextLabel) {
			return;
		}
		updateAttributes({ href: nextHref, label: nextLabel, variant: variantInput });
		setIsOpen(false);
	}

	function handleOpenChange(open: boolean) {
		if (open) {
			selectNode();
			resetInputs();
			setIsOpen(true);
			return;
		}
		// Dismissing a button that was never configured removes the placeholder node.
		if (href == null) {
			deleteNode();
			return;
		}
		setIsOpen(false);
	}

	return (
		<NodeViewWrapper as="span" className="inline-block align-baseline" contentEditable={false}>
			<Popover isOpen={isOpen} onOpenChange={handleOpenChange}>
				<PopoverTrigger
					aria-label="Edit button link"
					className={twMerge(
						buttonStyles({ intent: variant, size: "sm" }),
						"cursor-pointer",
						selected && "ring-2 ring-primary/40",
					)}
				>
					{displayLabel}
				</PopoverTrigger>
				<PopoverContent className="p-3">
					<form
						className="flex flex-col gap-2 inline-64"
						onSubmit={(e) => {
							e.preventDefault();
							handleApply();
						}}
					>
						<div className="flex flex-col gap-y-1">
							<label className="text-sm/6 font-medium" htmlFor={labelInputId}>
								{"Label"}
							</label>
							<Input
								autoFocus={true}
								id={labelInputId}
								onChange={(e) => {
									setLabelInput(e.target.value);
								}}
								placeholder="Learn more"
								type="text"
								value={labelInput}
							/>
						</div>
						<div className="flex flex-col gap-y-1">
							<label className="text-sm/6 font-medium" htmlFor={hrefInputId}>
								{"URL"}
							</label>
							<Input
								id={hrefInputId}
								onChange={(e) => {
									setHrefInput(e.target.value);
								}}
								placeholder="https://example.com"
								type="text"
								value={hrefInput}
							/>
						</div>
						<div className="flex flex-col gap-y-1">
							<span className="text-sm/6 font-medium">{"Style"}</span>
							<ToggleGroup
								aria-label="Button style"
								disallowEmptySelection={true}
								onSelectionChange={(keys) => {
									const nextVariant = [...keys][0] as ButtonLinkVariant | undefined;
									if (nextVariant != null) {
										setVariantInput(nextVariant);
									}
								}}
								selectedKeys={[variantInput]}
								size="sm"
							>
								<ToggleGroupItem id="primary">{"Primary"}</ToggleGroupItem>
								<ToggleGroupItem id="secondary">{"Secondary"}</ToggleGroupItem>
								<ToggleGroupItem id="outline">{"Outline"}</ToggleGroupItem>
							</ToggleGroup>
						</div>
						<div className="flex gap-2">
							<Button
								className="flex-1"
								intent="primary"
								isDisabled={!hrefInput.trim() || !labelInput.trim()}
								size="sm"
								type="submit"
							>
								{"Apply"}
							</Button>
							<Button intent="outline" onPress={deleteNode} size="sm" type="button">
								{"Remove"}
							</Button>
						</div>
					</form>
				</PopoverContent>
			</Popover>
		</NodeViewWrapper>
	);
}

export const ButtonLinkNode = Node.create({
	name: "buttonLink",
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	draggable: false,

	addAttributes() {
		return {
			href: { default: null },
			label: { default: null },
			variant: { default: "primary" },
		};
	},

	parseHTML() {
		return [
			{
				tag: "a[data-button-link]",
				getAttrs(dom) {
					return {
						href: dom.getAttribute("href"),
						label: dom.textContent,
						variant: normalizeButtonLinkVariant(dom.dataset.variant),
					};
				},
			},
		];
	},

	renderHTML({ node }) {
		return [
			"a",
			mergeAttributes({
				"data-button-link": "",
				href: node.attrs.href as string | null,
				"data-variant": node.attrs.variant as string,
			}),
			(node.attrs.label as string | null) ?? "",
		];
	},

	addNodeView() {
		return ReactNodeViewRenderer(ButtonLinkNodeView);
	},
});

/**
 * Inline reference to a placeholder value (e.g. the current number of member countries). The
 * document stores only a `kind` reference plus a display `label`; read paths substitute the current
 * value server-side, so the editor renders a placeholder chip instead of text.
 */
function PlaceholderValueNodeView({
	editor,
	getPos,
	node,
	selected,
	deleteNode,
}: Readonly<NodeViewProps>): ReactNode {
	const kind = node.attrs.kind as string | null;
	const label = (node.attrs.label as string | null) ?? kind ?? "Placeholder value";

	const chipClassName = twMerge(
		"inline-flex items-center gap-x-1 rounded-full border border-border bg-muted px-2 py-0.5 text-sm text-muted-fg",
		selected && "ring-2 ring-ring",
	);

	if (!editor.isEditable) {
		// Read views receive annotated nodes (a resolved `value` attribute) and render the plain
		// value; nodes without one (unknown kind) degrade to the labelled chip.
		const resolved = formatPlaceholderValue(node.attrs);
		if (resolved != null) {
			return (
				<NodeViewWrapper as="span" className="inline align-baseline">
					{resolved}
				</NodeViewWrapper>
			);
		}

		return (
			<NodeViewWrapper as="span" className="inline-block align-baseline">
				<span className={chipClassName}>
					<VariableIcon aria-hidden={true} className="block-3.5 inline-3.5" />
					{label}
				</span>
			</NodeViewWrapper>
		);
	}

	function selectNode() {
		const pos = getPos();
		if (typeof pos === "number") {
			editor.commands.setNodeSelection(pos);
		}
	}

	return (
		<NodeViewWrapper as="span" className="inline-block align-baseline" contentEditable={false}>
			<Popover
				onOpenChange={(open) => {
					if (open) {
						selectNode();
					}
				}}
			>
				<PopoverTrigger aria-label={label} className={chipClassName}>
					<VariableIcon aria-hidden={true} className="block-3.5 inline-3.5" />
					{label}
				</PopoverTrigger>
				<PopoverContent className="p-3">
					<div className="flex flex-col gap-2 inline-64">
						<span className="text-sm font-medium">{label}</span>
						<p className="text-xs text-muted-fg">
							{"Replaced with the current value whenever the content is displayed."}
						</p>
						<Button intent="outline" onPress={deleteNode} size="sm" type="button">
							{"Remove"}
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		</NodeViewWrapper>
	);
}

export const PlaceholderValueNode = Node.create({
	name: "placeholderValue",
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	draggable: false,

	addAttributes() {
		return {
			kind: { default: null },
			label: { default: null },
			/** Resolved data attached by the server on read paths; never present in editor content. */
			value: { default: null },
		};
	},

	parseHTML() {
		return [
			{
				tag: "span[data-placeholder-value]",
				getAttrs(dom) {
					return {
						kind: dom.dataset.placeholderValue ?? null,
						label: dom.textContent,
					};
				},
			},
		];
	},

	renderHTML({ node }) {
		const resolved = formatPlaceholderValue(node.attrs as Record<string, unknown>);

		return [
			"span",
			mergeAttributes({
				"data-placeholder-value": node.attrs.kind as string | null,
			}),
			resolved ?? (node.attrs.label as string | null) ?? (node.attrs.kind as string | null) ?? "",
		];
	},

	addNodeView() {
		return ReactNodeViewRenderer(PlaceholderValueNodeView);
	},
});

interface AssetImageNodeViewProps extends NodeViewProps {
	hasFootnotes?: boolean;
	renderImagePicker?: ImagePickerRenderer;
	renderAssetMetadata?: AssetMetadataRenderer;
}

function AssetImageNodeView({
	editor,
	getPos,
	node,
	selected,
	updateAttributes,
	deleteNode,
	renderImagePicker,
	renderAssetMetadata,
	hasFootnotes = false,
}: Readonly<AssetImageNodeViewProps>): ReactNode {
	const imageKey = node.attrs.imageKey as string | null;
	const imageUrl = node.attrs.imageUrl as string | null;
	const alt = node.attrs.alt as string | null;
	const assetCaption = node.attrs.assetCaption as JSONContent | null;
	const caption = node.attrs.caption as JSONContent | null;
	const captionMode = node.attrs.captionMode as ImageCaptionMode;
	const layout = normalizeImageLayout(node.attrs.layout);
	const resolvedCaption = resolveImageCaption(captionMode, caption, assetCaption);

	const [isEditing, setIsEditing] = useState(
		(editor.isEditable && (imageKey == null || imageUrl == null)) || false,
	);
	const [imageKeyInput, setImageKeyInput] = useState(imageKey ?? "");
	const [imageUrlInput, setImageUrlInput] = useState(imageUrl ?? "");
	const [captionJson, setCaptionJson] = useState<JSONContent | null>(caption);
	const [captionModeInput, setCaptionModeInput] = useState<ImageCaptionMode>(captionMode);
	const [layoutInput, setLayoutInput] = useState<ImageLayout>(layout);

	const imageKeyInputId = useId();
	const imageUrlInputId = useId();

	function resetInputs() {
		setImageKeyInput(imageKey ?? "");
		setImageUrlInput(imageUrl ?? "");
		setCaptionJson(caption);
		setCaptionModeInput(captionMode);
		setLayoutInput(layout);
	}

	function selectNode() {
		const pos = getPos();
		if (typeof pos !== "number") {
			return;
		}
		editor.commands.setNodeSelection(pos);
	}

	function handleApply() {
		const nextImageUrl = imageUrlInput.trim();
		if (!nextImageUrl) {
			return;
		}

		updateAttributes({
			imageKey: imageKeyInput.trim() || null,
			imageUrl: nextImageUrl,
			caption: isEmptyRichTextDocument(captionJson) ? null : captionJson,
			captionMode: captionModeInput,
			layout: layoutInput,
		});
		setIsEditing(false);
	}

	return (
		<BlockNodeSurface
			isEditable={editor.isEditable}
			isEditing={isEditing}
			isSelected={selected}
			label="Image block"
			onDoubleClick={() => {
				selectNode();
				resetInputs();
				setIsEditing(true);
			}}
		>
			{isEditing ? (
				/* Opening the panel puts a ProseMirror NodeSelection on the image, which spans this
				   node's DOM — so every label rendered inside it comes up highlighted as if the user
				   had dragged across it. The panel is a form, not document text, so nothing in its
				   chrome is selectable; the fields inside it opt back in. */
				<div className="flex flex-col gap-y-3 p-4 select-none **:[[contenteditable]]:select-text [&_input]:select-text">
					{renderAssetMetadata != null && imageKey != null
						? renderAssetMetadata({
								imageKey,
								/* The block keeps a copy of the asset's alt text and caption beside the key, for
								   rendering and for the `inherit` caption. Editing the asset from here would
								   otherwise leave those copies describing the old metadata. */
								onMetadataChange: (metadata) => {
									updateAttributes({ alt: metadata.alt, assetCaption: metadata.caption });
								},
							})
						: null}
					{renderImagePicker != null ? (
						<div className="flex flex-col gap-y-2">
							<div className="text-sm/6 font-medium">{"Pick image"}</div>
							{renderImagePicker((nextImageKey, nextImageUrl, asset) => {
								updateAttributes({
									imageKey: nextImageKey,
									imageUrl: nextImageUrl,
									alt: asset?.alt ?? null,
									assetCaption: asset?.caption ?? null,
									caption: isEmptyRichTextDocument(captionJson) ? null : captionJson,
									captionMode: captionModeInput,
								});
								setImageKeyInput(nextImageKey);
								setImageUrlInput(nextImageUrl);
							})}
						</div>
					) : null}
					{renderImagePicker == null ? (
						<>
							<div className="flex flex-col gap-y-1">
								<label className="text-sm/6 font-medium" htmlFor={imageKeyInputId}>
									{"Asset key"}
								</label>
								<Input
									id={imageKeyInputId}
									onChange={(e) => {
										setImageKeyInput(e.target.value);
									}}
									placeholder="Asset key"
									type="text"
									value={imageKeyInput}
								/>
							</div>
							<div className="flex flex-col gap-y-1">
								<label className="text-sm/6 font-medium" htmlFor={imageUrlInputId}>
									{"Image URL"}
								</label>
								<Input
									id={imageUrlInputId}
									onChange={(e) => {
										setImageUrlInput(e.target.value);
									}}
									placeholder="https://"
									type="url"
									value={imageUrlInput}
								/>
							</div>
						</>
					) : null}
					<div className="flex flex-col gap-y-1">
						<span className="text-sm/6 font-medium">{"Layout"}</span>
						<ToggleGroup
							aria-label="Layout"
							className="[--toggle-focused-bg:var(--color-muted)] [--toggle-hover-bg:var(--color-muted)] [--toggle-selected-bg:var(--color-secondary)] [--toggle-selected-fg:var(--color-secondary-fg)]"
							disallowEmptySelection={true}
							onSelectionChange={(keys) => {
								const nextLayout = [...keys][0] as ImageLayout | undefined;
								if (nextLayout != null) {
									setLayoutInput(nextLayout);
								}
							}}
							selectedKeys={[layoutInput]}
							size="sm"
						>
							<ToggleGroupItem id="default">{"Default"}</ToggleGroupItem>
							<ToggleGroupItem id="wide">{"Wide"}</ToggleGroupItem>
							<ToggleGroupItem id="full">{"Full width"}</ToggleGroupItem>
							<ToggleGroupItem id="float-start">{"Float left"}</ToggleGroupItem>
							<ToggleGroupItem id="float-end">{"Float right"}</ToggleGroupItem>
						</ToggleGroup>
					</div>
					<div className="flex flex-col gap-y-1">
						<span className="text-sm/6 font-medium">{"Caption behavior"}</span>
						<ToggleGroup
							aria-label="Caption behavior"
							className="[--toggle-focused-bg:var(--color-muted)] [--toggle-hover-bg:var(--color-muted)] [--toggle-selected-bg:var(--color-secondary)] [--toggle-selected-fg:var(--color-secondary-fg)]"
							disallowEmptySelection={true}
							onSelectionChange={(keys) => {
								const mode = [...keys][0] as ImageCaptionMode | undefined;
								if (mode != null) {
									setCaptionModeInput(mode);
								}
							}}
							selectedKeys={[captionModeInput]}
							size="sm"
						>
							<ToggleGroupItem id="inherit">{"Use asset caption"}</ToggleGroupItem>
							<ToggleGroupItem id="override">{"Custom caption"}</ToggleGroupItem>
							<ToggleGroupItem id="hidden">{"No caption"}</ToggleGroupItem>
						</ToggleGroup>
						{captionModeInput === "override" ? (
							<InlineRichTextEditor
								aria-label="Custom caption"
								content={captionJson ?? undefined}
								extensions={hasFootnotes ? inlineFootnoteExtensions : undefined}
								onChange={setCaptionJson}
							/>
						) : null}
						{captionModeInput === "inherit" && !isEmptyRichTextDocument(assetCaption) ? (
							<InlineRichTextRenderer
								className="rounded-lg border border-border px-3 py-2 text-muted-fg"
								content={assetCaption!}
							/>
						) : null}
					</div>
					<div className={blockPanelFooterClassName}>
						<Button
							intent="primary"
							isDisabled={imageUrlInput.trim() === ""}
							onPress={handleApply}
							size="sm"
							type="button"
						>
							{"Apply"}
						</Button>
						{imageKey != null || imageUrl != null ? (
							<Button
								intent="outline"
								onPress={() => {
									resetInputs();
									setIsEditing(false);
								}}
								size="sm"
								type="button"
							>
								{"Cancel"}
							</Button>
						) : null}
						{(imageKey != null || imageUrl != null) && editor.isEditable ? (
							<Button intent="outline" onPress={deleteNode} size="sm" type="button">
								{"Remove"}
							</Button>
						) : null}
					</div>
				</div>
			) : (
				<div className="group">
					<div className="relative">
						{/* Natural width, centred, never upscaled: imgproxy does not enlarge, so stretching a
						    source narrower than the card only rendered it soft and told the author the block
						    was bigger than the read view will draw it. `max-block-96` still bounds a tall
						    image, and scales it down by ratio because the width stays `auto`. */}
						<img
							alt={alt ?? ""}
							className="ms-auto me-auto block inline-auto max-block-96 max-inline-full"
							data-asset-image=""
							data-image-key={imageKey ?? undefined}
							draggable={false}
							src={imageUrl ?? ""}
						/>
						<div className="absolute inset-x-0 inset-bs-0 flex justify-end gap-x-1 p-2 opacity-0 transition-opacity group-hover:opacity-100">
							<button
								aria-label="Edit image"
								className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => {
									selectNode();
									resetInputs();
									setIsEditing(true);
								}}
								type="button"
							>
								<PencilIcon className="block-3.5 inline-3.5" />
							</button>
							<button
								aria-label="Remove image"
								className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={deleteNode}
								type="button"
							>
								<Trash2Icon className="block-3.5 inline-3.5" />
							</button>
						</div>
					</div>
					{!isEmptyRichTextDocument(resolvedCaption) ? (
						<InlineRichTextRenderer
							className="border-bs border-border px-4 py-2 text-muted-fg"
							content={resolvedCaption!}
						/>
					) : null}
				</div>
			)}
		</BlockNodeSurface>
	);
}

function createAssetImageNode(
	renderImagePicker?: ImagePickerRenderer,
	renderAssetMetadata?: AssetMetadataRenderer,
	hasFootnotes = false,
): Node {
	return Node.create({
		name: "assetImage",
		group: "block",
		atom: true,
		draggable: true,
		selectable: true,

		addAttributes() {
			return {
				imageKey: { default: null },
				imageUrl: { default: null },
				alt: { default: null },
				assetCaption: { default: null },
				caption: { default: null },
				captionMode: { default: "inherit" },
				layout: { default: "default" },
			};
		},

		parseHTML() {
			return [
				{
					tag: "img[data-asset-image]",
					getAttrs(dom) {
						const el = dom;
						return {
							imageKey: el.dataset.imageKey,
							imageUrl: el.getAttribute("src"),
							alt: el.getAttribute("alt"),
							assetCaption: parseCaptionAttr(el.dataset.assetCaption),
							caption: parseCaptionAttr(el.dataset.caption),
							captionMode: el.dataset.captionMode ?? "inherit",
							layout: normalizeImageLayout(el.dataset.layout),
						};
					},
				},
			];
		},

		renderHTML({ node }) {
			return [
				"img",
				mergeAttributes(
					{
						src: node.attrs.imageUrl as string | null,
						alt: node.attrs.alt as string | null,
						"data-asset-image": "",
						"data-image-key": node.attrs.imageKey as string | null,
						"data-caption-mode": node.attrs.captionMode as ImageCaptionMode,
						"data-layout": normalizeImageLayout(node.attrs.layout),
					},
					node.attrs.assetCaption != null
						? {
								"data-asset-caption": serializeCaptionAttr(
									node.attrs.assetCaption as JSONContent | null,
								),
							}
						: {},
					node.attrs.caption != null
						? { "data-caption": serializeCaptionAttr(node.attrs.caption as JSONContent | null) }
						: {},
				),
			];
		},

		addNodeView() {
			return ReactNodeViewRenderer((props) => (
				<AssetImageNodeView
					{...props}
					hasFootnotes={hasFootnotes}
					renderAssetMetadata={renderAssetMetadata}
					renderImagePicker={renderImagePicker}
				/>
			));
		},
	});
}

interface MediaTextNodeViewProps extends NodeViewProps {
	hasFootnotes?: boolean;
	renderImagePicker?: ImagePickerRenderer;
	renderAssetMetadata?: AssetMetadataRenderer;
}

/**
 * Unlike the other custom nodes here, this one is not an atom: its prose is real document content
 * rendered through `NodeViewContent`, so authors type into it with the outer toolbar and a single
 * undo stack. Only the media settings are a form — those commit on Apply, because a nested
 * `InlineRichTextEditor` writing to `updateAttributes` on every keystroke would dispatch a
 * transaction into the outer editor per character and fight it for focus.
 */
function MediaTextNodeView({
	editor,
	node,
	selected,
	updateAttributes,
	deleteNode,
	renderImagePicker,
	renderAssetMetadata,
	hasFootnotes = false,
}: Readonly<MediaTextNodeViewProps>): ReactNode {
	const imageKey = node.attrs.imageKey as string | null;
	const imageUrl = node.attrs.imageUrl as string | null;
	const alt = node.attrs.alt as string | null;
	const assetCaption = node.attrs.assetCaption as JSONContent | null;
	const caption = node.attrs.caption as JSONContent | null;
	const captionMode = (node.attrs.captionMode as ImageCaptionMode | null) ?? "inherit";
	const side = normalizeMediaTextSide(node.attrs.side);

	// Settings open while the block has no image: `upsertTypedContentBlock` cannot store a media
	// block without one, so picking the image is the first thing an author needs to do.
	const [isEditing, setIsEditing] = useState(imageKey == null && editor.isEditable);
	const [captionModeInput, setCaptionModeInput] = useState<ImageCaptionMode>(captionMode);
	const [captionInput, setCaptionInput] = useState<JSONContent | null>(caption);
	const wrapperRef = useContainerDraggable(editor.isEditable && !isEditing);

	const resolvedCaption = resolveImageCaption(captionMode, caption, assetCaption);

	function resetInputs() {
		setCaptionModeInput(captionMode);
		setCaptionInput(caption);
	}

	return (
		<NodeViewWrapper
			ref={wrapperRef}
			aria-label="Media with text block"
			className={twMerge(
				"my-2 overflow-clip rounded-lg border border-input bg-bg transition-shadow",
				selected && "border-primary ring-2 ring-primary/20",
			)}
		>
			{isEditing && editor.isEditable ? (
				<div
					className="flex flex-col gap-y-3 border-be border-border bg-muted p-4 select-none **:[[contenteditable]]:select-text [&_input]:select-text"
					contentEditable={false}
				>
					{renderAssetMetadata != null && imageKey != null
						? renderAssetMetadata({
								imageKey,
								onMetadataChange: (metadata) => {
									updateAttributes({ alt: metadata.alt, assetCaption: metadata.caption });
								},
							})
						: null}
					{renderImagePicker != null ? (
						<div className="flex flex-col gap-y-2">
							<span className="text-sm/6 font-medium">{"Pick image"}</span>
							{renderImagePicker((nextImageKey, nextImageUrl, asset) => {
								updateAttributes({
									imageKey: nextImageKey,
									imageUrl: nextImageUrl,
									alt: asset?.alt ?? null,
									assetCaption: asset?.caption ?? null,
								});
							})}
						</div>
					) : null}
					<div className="flex flex-col gap-y-1">
						<span className="text-sm/6 font-medium">{"Image placement"}</span>
						<ToggleGroup
							aria-label="Image placement"
							className="[--toggle-focused-bg:var(--color-muted)] [--toggle-hover-bg:var(--color-muted)] [--toggle-selected-bg:var(--color-secondary)] [--toggle-selected-fg:var(--color-secondary-fg)]"
							disallowEmptySelection={true}
							onSelectionChange={(keys) => {
								const nextSide = [...keys][0] as MediaTextSide | undefined;
								if (nextSide != null) {
									updateAttributes({ side: nextSide });
								}
							}}
							selectedKeys={[side]}
							size="sm"
						>
							<ToggleGroupItem id="start">{"Left"}</ToggleGroupItem>
							<ToggleGroupItem id="end">{"Right"}</ToggleGroupItem>
						</ToggleGroup>
					</div>
					<div className="flex flex-col gap-y-1">
						<span className="text-sm/6 font-medium">{"Caption behavior"}</span>
						<ToggleGroup
							aria-label="Caption behavior"
							className="[--toggle-focused-bg:var(--color-muted)] [--toggle-hover-bg:var(--color-muted)] [--toggle-selected-bg:var(--color-secondary)] [--toggle-selected-fg:var(--color-secondary-fg)]"
							disallowEmptySelection={true}
							onSelectionChange={(keys) => {
								const mode = [...keys][0] as ImageCaptionMode | undefined;
								if (mode != null) {
									setCaptionModeInput(mode);
								}
							}}
							selectedKeys={[captionModeInput]}
							size="sm"
						>
							<ToggleGroupItem id="inherit">{"Use asset caption"}</ToggleGroupItem>
							<ToggleGroupItem id="override">{"Custom caption"}</ToggleGroupItem>
							<ToggleGroupItem id="hidden">{"No caption"}</ToggleGroupItem>
						</ToggleGroup>
						{captionModeInput === "override" ? (
							<InlineRichTextEditor
								aria-label="Custom caption"
								content={captionInput ?? undefined}
								extensions={hasFootnotes ? inlineFootnoteExtensions : undefined}
								onChange={setCaptionInput}
							/>
						) : null}
						{captionModeInput === "inherit" && !isEmptyRichTextDocument(assetCaption) ? (
							<InlineRichTextRenderer
								className="rounded-lg border border-border px-3 py-2 text-muted-fg"
								content={assetCaption!}
							/>
						) : null}
					</div>
					<div className={blockPanelFooterClassName}>
						<Button
							intent="primary"
							isDisabled={imageKey == null}
							onPress={() => {
								updateAttributes({
									caption: isEmptyRichTextDocument(captionInput) ? null : captionInput,
									captionMode: captionModeInput,
								});
								setIsEditing(false);
							}}
							size="sm"
							type="button"
						>
							{"Apply"}
						</Button>
						{imageKey != null ? (
							<Button
								intent="outline"
								onPress={() => {
									resetInputs();
									setIsEditing(false);
								}}
								size="sm"
								type="button"
							>
								{"Cancel"}
							</Button>
						) : null}
						<Button intent="outline" onPress={deleteNode} size="sm" type="button">
							{"Remove"}
						</Button>
					</div>
				</div>
			) : null}
			<div
				className={twMerge(
					"group flex flex-col gap-4 p-4 sm:flex-row",
					side === "end" && "sm:flex-row-reverse",
				)}
			>
				{/* The media column is chrome, not content — ProseMirror must not treat it as either
				    editable text or a second content hole. It doubles as the drag handle so that
				    dragging the block never competes with selecting its prose. */}
				<div
					className="relative shrink-0 sm:inline-1/3"
					contentEditable={false}
					data-drag-handle={editor.isEditable ? "" : undefined}
				>
					{imageUrl != null ? (
						<img
							alt={alt ?? ""}
							className="block rounded-md object-cover inline-full"
							draggable={false}
							src={imageUrl}
						/>
					) : (
						<div className="flex items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-fg block-32">
							{"No image"}
						</div>
					)}
					{!isEmptyRichTextDocument(resolvedCaption) ? (
						<InlineRichTextRenderer
							className="mbs-1 text-sm text-muted-fg"
							content={resolvedCaption!}
						/>
					) : null}
					{editor.isEditable && !isEditing ? (
						<div className="absolute inset-e-1 inset-bs-1 flex gap-x-1 opacity-0 transition-opacity group-hover:opacity-100">
							<button
								aria-label="Edit media settings"
								className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => {
									resetInputs();
									setIsEditing(true);
								}}
								type="button"
							>
								<PencilIcon className="block-3.5 inline-3.5" />
							</button>
							<button
								aria-label="Remove media with text"
								className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={deleteNode}
								type="button"
							>
								<Trash2Icon className="block-3.5 inline-3.5" />
							</button>
						</div>
					) : null}
				</div>
				<NodeViewContent className="flex-1 min-inline-0" data-media-text-content="" />
			</div>
		</NodeViewWrapper>
	);
}

function createMediaTextNode(
	renderImagePicker?: ImagePickerRenderer,
	renderAssetMetadata?: AssetMetadataRenderer,
	hasFootnotes = false,
): Node {
	return Node.create({
		name: "mediaTextBlock",
		group: "block",
		// Prose only. The body is a passage bound to the image — a speaker bio, typically — so
		// excluding headings keeps the document outline meaningful and makes a heading nested inside
		// a media block impossible by construction rather than something the toolbar has to police.
		content: "(paragraph | bulletList | orderedList)+",
		// `defining` keeps the wrapper when its content is replaced by a paste; `isolating` stops
		// backspace at the start of the body from lifting the prose out into the paragraph above.
		defining: true,
		isolating: true,
		draggable: true,
		selectable: true,

		addAttributes() {
			return {
				imageKey: { default: null },
				imageUrl: { default: null },
				alt: { default: null },
				assetCaption: { default: null },
				caption: { default: null },
				captionMode: { default: "inherit" },
				side: { default: "start" },
			};
		},

		parseHTML() {
			return [
				{
					tag: "div[data-media-text-block]",
					getAttrs(dom) {
						return {
							imageKey: dom.dataset.imageKey ?? null,
							imageUrl: dom.dataset.imageUrl ?? null,
							alt: dom.dataset.alt ?? null,
							assetCaption: parseCaptionAttr(dom.dataset.assetCaption),
							caption: parseCaptionAttr(dom.dataset.caption),
							captionMode: dom.dataset.captionMode ?? "inherit",
							side: normalizeMediaTextSide(dom.dataset.side),
						};
					},
				},
			];
		},

		renderHTML({ node }) {
			return [
				"div",
				mergeAttributes(
					{
						"data-media-text-block": "",
						"data-image-key": node.attrs.imageKey as string | null,
						"data-image-url": node.attrs.imageUrl as string | null,
						"data-alt": node.attrs.alt as string | null,
						"data-caption-mode": node.attrs.captionMode as ImageCaptionMode,
						"data-side": normalizeMediaTextSide(node.attrs.side),
					},
					node.attrs.assetCaption != null
						? {
								"data-asset-caption": serializeCaptionAttr(
									node.attrs.assetCaption as JSONContent | null,
								),
							}
						: {},
					node.attrs.caption != null
						? { "data-caption": serializeCaptionAttr(node.attrs.caption as JSONContent | null) }
						: {},
				),
				0,
			];
		},

		addNodeView() {
			return ReactNodeViewRenderer((props) => (
				<MediaTextNodeView
					{...props}
					hasFootnotes={hasFootnotes}
					renderAssetMetadata={renderAssetMetadata}
					renderImagePicker={renderImagePicker}
				/>
			));
		},
	});
}

interface GalleryNodeViewProps extends NodeViewProps {
	hasFootnotes?: boolean;
	renderImagePicker?: ImagePickerRenderer;
	renderAssetMetadata?: AssetMetadataRenderer;
}

/**
 * A gallery is an atom: it holds a list of images rather than prose, so — unlike `mediaTextBlock` —
 * nothing about it is document content. The whole list is one form committed on Apply, for the same
 * reason media settings are: a per-item `InlineRichTextEditor` writing straight to
 * `updateAttributes` would dispatch a transaction into the outer editor on every keystroke of every
 * caption.
 */
function GalleryNodeView({
	editor,
	getPos,
	node,
	selected,
	updateAttributes,
	deleteNode,
	renderImagePicker,
	renderAssetMetadata,
	hasFootnotes = false,
}: Readonly<GalleryNodeViewProps>): ReactNode {
	const layout = normalizeGalleryLayout(node.attrs.layout);
	const items = useMemo(() => normalizeGalleryItems(node.attrs.items), [node.attrs.items]);
	const caption = node.attrs.caption as JSONContent | null;

	const [isEditing, setIsEditing] = useState(items.length === 0 && editor.isEditable);
	const [layoutInput, setLayoutInput] = useState<GalleryLayout>(layout);
	const [itemsInput, setItemsInput] = useState<Array<GalleryItemAttrs>>(items);
	const [captionInput, setCaptionInput] = useState<JSONContent | null>(caption);

	function resetInputs() {
		setLayoutInput(layout);
		setItemsInput(items);
		setCaptionInput(caption);
	}

	function selectNode() {
		const pos = getPos();
		if (typeof pos !== "number") {
			return;
		}
		editor.commands.setNodeSelection(pos);
	}

	function updateItem(index: number, changes: Partial<GalleryItemAttrs>) {
		setItemsInput((current) =>
			current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)),
		);
	}

	function moveItem(index: number, direction: -1 | 1) {
		setItemsInput((current) => {
			const nextIndex = index + direction;
			if (nextIndex < 0 || nextIndex >= current.length) {
				return current;
			}
			const next = [...current];
			const [moved] = next.splice(index, 1);
			if (moved == null) {
				return current;
			}
			next.splice(nextIndex, 0, moved);
			return next;
		});
	}

	function handleApply() {
		const nextItems = itemsInput
			.filter((item) => item.imageKey != null)
			.map((item) => {
				return {
					...item,
					caption: isEmptyRichTextDocument(item.caption) ? null : item.caption,
				};
			});

		if (nextItems.length === 0) {
			return;
		}

		updateAttributes({
			layout: layoutInput,
			items: nextItems,
			caption: isEmptyRichTextDocument(captionInput) ? null : captionInput,
		});
		setIsEditing(false);
	}

	return (
		<BlockNodeSurface
			isEditable={editor.isEditable}
			isEditing={isEditing}
			isSelected={selected}
			label="Gallery block"
			onDoubleClick={() => {
				selectNode();
				resetInputs();
				setIsEditing(true);
			}}
		>
			{isEditing ? (
				<div className="flex flex-col gap-y-3 p-4 select-none **:[[contenteditable]]:select-text [&_input]:select-text">
					<div className="flex flex-col gap-y-1">
						<span className="text-sm/6 font-medium">{"Layout"}</span>
						<ToggleGroup
							aria-label="Layout"
							className="[--toggle-focused-bg:var(--color-muted)] [--toggle-hover-bg:var(--color-muted)] [--toggle-selected-bg:var(--color-secondary)] [--toggle-selected-fg:var(--color-secondary-fg)]"
							disallowEmptySelection={true}
							onSelectionChange={(keys) => {
								const nextLayout = [...keys][0] as GalleryLayout | undefined;
								if (nextLayout != null) {
									setLayoutInput(nextLayout);
								}
							}}
							selectedKeys={[layoutInput]}
							size="sm"
						>
							<ToggleGroupItem id="grid">{"Grid"}</ToggleGroupItem>
							<ToggleGroupItem id="carousel">{"Carousel"}</ToggleGroupItem>
						</ToggleGroup>
					</div>
					{/* The gallery's own caption, describing the set. The per-item captions below credit the
					    individual images, and follow the shared inherit/override/hide model; this one has no
					    asset behind it, so it is simply written or left empty. */}
					<div className="flex flex-col gap-y-1">
						<span className="text-sm/6 font-medium">{"Caption"}</span>
						<InlineRichTextEditor
							aria-label="Gallery caption"
							content={caption ?? undefined}
							extensions={hasFootnotes ? inlineFootnoteExtensions : undefined}
							onChange={setCaptionInput}
						/>
					</div>
					{itemsInput.map((item, index) => (
						<div
							// Items carry no id of their own, and two placements of the same asset are a
							// legitimate gallery, so position is the only thing that identifies a row.
							key={index}
							className="flex flex-col gap-y-3 rounded-lg border border-border p-3"
						>
							<div className="flex items-center justify-between gap-x-2">
								<span className="text-sm/6 font-medium">{`Image ${String(index + 1)}`}</span>
								<div className="flex shrink-0 items-center gap-x-1">
									<Button
										aria-label={`Move image ${String(index + 1)} earlier`}
										intent="outline"
										isDisabled={index === 0}
										onPress={() => {
											moveItem(index, -1);
										}}
										size="sm"
										type="button"
									>
										<ArrowUpIcon className="block-3.5 inline-3.5" />
									</Button>
									<Button
										aria-label={`Move image ${String(index + 1)} later`}
										intent="outline"
										isDisabled={index === itemsInput.length - 1}
										onPress={() => {
											moveItem(index, 1);
										}}
										size="sm"
										type="button"
									>
										<ArrowDownIcon className="block-3.5 inline-3.5" />
									</Button>
									<Button
										aria-label={`Remove image ${String(index + 1)}`}
										intent="outline"
										onPress={() => {
											setItemsInput((current) =>
												current.filter((_, itemIndex) => itemIndex !== index),
											);
										}}
										size="sm"
										type="button"
									>
										<Trash2Icon className="block-3.5 inline-3.5" />
									</Button>
								</div>
							</div>
							{renderAssetMetadata != null && item.imageKey != null
								? renderAssetMetadata({
										imageKey: item.imageKey,
										onMetadataChange: (metadata) => {
											updateItem(index, { alt: metadata.alt, assetCaption: metadata.caption });
										},
									})
								: null}
							<div className="flex flex-col gap-y-1">
								<span className="text-sm/6 font-medium">{"Caption behavior"}</span>
								<ToggleGroup
									aria-label={`Caption behavior for image ${String(index + 1)}`}
									className="[--toggle-focused-bg:var(--color-muted)] [--toggle-hover-bg:var(--color-muted)] [--toggle-selected-bg:var(--color-secondary)] [--toggle-selected-fg:var(--color-secondary-fg)]"
									disallowEmptySelection={true}
									onSelectionChange={(keys) => {
										const mode = [...keys][0] as ImageCaptionMode | undefined;
										if (mode != null) {
											updateItem(index, { captionMode: mode });
										}
									}}
									selectedKeys={[item.captionMode]}
									size="sm"
								>
									<ToggleGroupItem id="inherit">{"Use asset caption"}</ToggleGroupItem>
									<ToggleGroupItem id="override">{"Custom caption"}</ToggleGroupItem>
									<ToggleGroupItem id="hidden">{"No caption"}</ToggleGroupItem>
								</ToggleGroup>
								{item.captionMode === "override" ? (
									<InlineRichTextEditor
										aria-label={`Custom caption for image ${String(index + 1)}`}
										content={item.caption ?? undefined}
										extensions={hasFootnotes ? inlineFootnoteExtensions : undefined}
										onChange={(caption) => {
											updateItem(index, { caption });
										}}
									/>
								) : null}
								{item.captionMode === "inherit" && !isEmptyRichTextDocument(item.assetCaption) ? (
									<InlineRichTextRenderer
										className="rounded-lg border border-border px-3 py-2 text-muted-fg"
										content={item.assetCaption!}
									/>
								) : null}
							</div>
						</div>
					))}
					{renderImagePicker != null ? (
						<div className="flex flex-col gap-y-2">
							<span className="text-sm/6 font-medium">{"Add image"}</span>
							{/* One asset per trip through the picker: the media library dialog is
							    single-select, so a gallery is built up by picking repeatedly. */}
							{renderImagePicker((imageKey, imageUrl, asset) => {
								setItemsInput((current) => [
									...current,
									{
										imageKey,
										imageUrl,
										alt: asset?.alt ?? null,
										assetCaption: asset?.caption ?? null,
										caption: null,
										captionMode: "inherit",
									},
								]);
							})}
						</div>
					) : null}
					{itemsInput.length === 0 ? (
						<Note intent="info">{"Pick at least one image to keep this gallery."}</Note>
					) : null}
					<div className={blockPanelFooterClassName}>
						<Button
							intent="primary"
							isDisabled={itemsInput.length === 0}
							onPress={handleApply}
							size="sm"
							type="button"
						>
							{"Apply"}
						</Button>
						{items.length > 0 ? (
							<Button
								intent="outline"
								onPress={() => {
									resetInputs();
									setIsEditing(false);
								}}
								size="sm"
								type="button"
							>
								{"Cancel"}
							</Button>
						) : null}
						{editor.isEditable ? (
							<Button intent="outline" onPress={deleteNode} size="sm" type="button">
								{"Remove"}
							</Button>
						) : null}
					</div>
				</div>
			) : (
				<div className="group">
					<div className="relative">
						<ul
							className={cn(
								"grid list-none gap-2 p-2",
								layout === "carousel"
									? "auto-cols-[minmax(8rem,1fr)] grid-flow-col overflow-x-auto"
									: "grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))]",
							)}
						>
							{items.map((item, index) => {
								const resolvedCaption = resolveImageCaption(
									item.captionMode,
									item.caption,
									item.assetCaption,
								);

								return (
									<li key={index} className="flex flex-col gap-y-1">
										<img
											alt={item.alt ?? ""}
											className="block aspect-video rounded-sm object-cover inline-full"
											draggable={false}
											src={item.imageUrl ?? ""}
										/>
										{!isEmptyRichTextDocument(resolvedCaption) ? (
											<InlineRichTextRenderer
												className="text-xs text-muted-fg"
												content={resolvedCaption!}
											/>
										) : null}
									</li>
								);
							})}
						</ul>
						{editor.isEditable ? (
							<div className="absolute inset-x-0 inset-bs-0 flex justify-end gap-x-1 p-2 opacity-0 transition-opacity group-hover:opacity-100">
								<button
									aria-label="Edit gallery"
									className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={() => {
										selectNode();
										resetInputs();
										setIsEditing(true);
									}}
									type="button"
								>
									<PencilIcon className="block-3.5 inline-3.5" />
								</button>
								<button
									aria-label="Remove gallery"
									className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={deleteNode}
									type="button"
								>
									<Trash2Icon className="block-3.5 inline-3.5" />
								</button>
							</div>
						) : null}
					</div>
					{!isEmptyRichTextDocument(caption) ? (
						<InlineRichTextRenderer
							className="border-bs border-border px-4 py-2 text-muted-fg"
							content={caption!}
						/>
					) : null}
					<div className="border-bs border-border px-4 py-2 text-xs text-muted-fg">
						{`${layout === "carousel" ? "Carousel" : "Grid"} · ${String(items.length)} ${items.length === 1 ? "image" : "images"}`}
					</div>
				</div>
			)}
		</BlockNodeSurface>
	);
}

function createGalleryNode(
	renderImagePicker?: ImagePickerRenderer,
	renderAssetMetadata?: AssetMetadataRenderer,
	hasFootnotes = false,
): Node {
	return Node.create({
		name: "galleryBlock",
		group: "block",
		atom: true,
		draggable: true,
		selectable: true,

		addAttributes() {
			return {
				layout: { default: "grid" },
				items: { default: [] },
				caption: { default: null },
			};
		},

		parseHTML() {
			return [
				{
					tag: "div[data-gallery-block]",
					getAttrs(dom) {
						return {
							layout: normalizeGalleryLayout(dom.dataset.layout),
							items: parseGalleryItemsAttr(dom.dataset.items),
							caption: parseCaptionAttr(dom.dataset.caption),
						};
					},
				},
			];
		},

		renderHTML({ node }) {
			return [
				"div",
				mergeAttributes({
					"data-gallery-block": "",
					"data-layout": normalizeGalleryLayout(node.attrs.layout),
					"data-items": serializeGalleryItemsAttr(normalizeGalleryItems(node.attrs.items)),
					"data-caption": serializeCaptionAttr(node.attrs.caption as JSONContent | null),
				}),
			];
		},

		addNodeView() {
			return ReactNodeViewRenderer((props) => (
				<GalleryNodeView
					{...props}
					hasFootnotes={hasFootnotes}
					renderAssetMetadata={renderAssetMetadata}
					renderImagePicker={renderImagePicker}
				/>
			));
		},
	});
}

interface TableNodeViewProps extends NodeViewProps {
	hasFootnotes?: boolean;
}

/**
 * A table's caption, edited in place. Everything else about the table is ordinary document content
 * rendered through the row group below.
 *
 * The caption lives in an attribute rather than in the table's content, because
 * `prosemirror-tables` reads a table's children positionally — `TableMap` takes `childCount` for
 * the row count and each child as a row — so a caption node inside the table would shift every row
 * index and corrupt the column map the cell commands depend on. Kept in `attrs`, it is invisible to
 * all of that, and only this node view and the read paths ever assemble the `<caption>` element.
 *
 * Committed on Apply rather than per keystroke, like the other caption editors here: a nested
 * `InlineRichTextEditor` writing to `updateAttributes` on every character would dispatch a
 * transaction into the outer editor and fight it for focus.
 */
function TableNodeView({
	editor,
	node,
	updateAttributes,
	hasFootnotes = false,
}: Readonly<TableNodeViewProps>): ReactNode {
	const caption = node.attrs.caption as JSONContent | null;

	const captionRef = useRef<HTMLElement>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [captionInput, setCaptionInput] = useState<JSONContent | null>(caption);

	/*
	 * A caption has to be the table's first child to name it. The row group is appended by the node
	 * view renderer itself, and for a document that already holds tables when the editor mounts that
	 * happens before React renders this element — leaving `<table><tbody><caption>`, which browsers
	 * still lay out above the table but which no longer reads as the table's caption in markup.
	 */
	useLayoutEffect(() => {
		const element = captionRef.current;
		const table = element?.parentElement;

		if (element != null && table != null && table.firstElementChild !== element) {
			table.prepend(element);
		}
	});

	function startEditing() {
		setCaptionInput(caption);
		setIsEditing(true);
	}

	return (
		/*
		 * The caption is chrome, not content: ProseMirror must not treat it as editable text or as a
		 * second content hole. The editor nested inside it opts back in, the same way the media and
		 * embed panels do.
		 */
		<NodeViewWrapper
			as="caption"
			className="select-none **:[[contenteditable]]:select-text"
			contentEditable={false}
			ref={captionRef}
		>
			{isEditing && editor.isEditable ? (
				/* No padding of its own: the caption box already sits clear of the table above it. */
				<div className="flex flex-col gap-y-2 text-start">
					<InlineRichTextEditor
						aria-label="Table caption"
						content={captionInput ?? undefined}
						extensions={hasFootnotes ? inlineFootnoteExtensions : undefined}
						onChange={setCaptionInput}
					/>
					<div className="flex items-center gap-x-2">
						<Button
							intent="primary"
							onPress={() => {
								updateAttributes({
									caption: isEmptyRichTextDocument(captionInput) ? null : captionInput,
								});
								setIsEditing(false);
							}}
							size="sm"
							type="button"
						>
							{"Apply"}
						</Button>
						<Button
							intent="outline"
							onPress={() => {
								setCaptionInput(caption);
								setIsEditing(false);
							}}
							size="sm"
							type="button"
						>
							{"Cancel"}
						</Button>
						{!isEmptyRichTextDocument(caption) ? (
							<Button
								intent="outline"
								onPress={() => {
									updateAttributes({ caption: null });
									setCaptionInput(null);
									setIsEditing(false);
								}}
								size="sm"
								type="button"
							>
								{"Remove caption"}
							</Button>
						) : null}
					</div>
				</div>
			) : !isEmptyRichTextDocument(caption) ? (
				<div className="group flex items-start gap-x-2 text-start">
					{/* The renderer declares its own richtext scale, which would otherwise override the
					    caption styling the surrounding prose gives this element. */}
					<InlineRichTextRenderer className="flex-1 text-sm text-muted-fg" content={caption!} />
					{editor.isEditable ? (
						<button
							aria-label="Edit table caption"
							className="rounded-sm p-1 text-muted-fg opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={startEditing}
							type="button"
						>
							<PencilIcon className="block-3.5 inline-3.5" />
						</button>
					) : null}
				</div>
			) : editor.isEditable ? (
				<button
					className="rounded-sm text-sm text-muted-fg underline decoration-dotted underline-offset-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={startEditing}
					type="button"
				>
					{"Add caption"}
				</button>
			) : null}
		</NodeViewWrapper>
	);
}

/**
 * The stock table node, given a `caption` attribute — see {@link TableNodeView} for why the caption
 * is an attribute and not part of the table's content.
 *
 * Copy/paste carries the caption as JSON in `data-caption`, the same way the image and embed blocks
 * carry theirs, so a table pasted from one document into another keeps its formatting and
 * footnotes. The `<caption>` element `renderHTML` writes alongside it is the semantic one — the
 * flattened text, because a DOM output spec has nowhere to render richtext JSON — and doubles as
 * the parse fallback for tables that come from anywhere else (the WordPress import, a paste out of
 * a word processor), where a caption used to be dropped on the floor.
 */
function createTableNode(hasFootnotes = false): Node {
	return Table.extend({
		addAttributes() {
			return {
				...this.parent?.(),
				caption: {
					default: null,
					parseHTML: (element) =>
						parseCaptionAttr(element.dataset.caption) ??
						captionFromElementText(element.querySelector(":scope > caption")?.textContent),
					renderHTML: (attributes) => {
						const caption = attributes.caption as JSONContent | null;
						return caption == null ? {} : { "data-caption": serializeCaptionAttr(caption) };
					},
				},
			};
		},

		/**
		 * Replaces the stock rendering rather than extending it: that one carries a `colgroup` and an
		 * inline width for the column resizing this editor turns off (`resizable: false`), so nothing
		 * of it is wanted here beyond the row group.
		 */
		renderHTML({ node, HTMLAttributes }) {
			const caption = node.attrs.caption as JSONContent | null;
			const captionText = isEmptyRichTextDocument(caption) ? "" : toPlainText(caption).trim();

			// The caption's text is a child rather than the spec's second element: an output spec puts
			// attributes there, and the static renderer refuses a string in that position.
			return captionText === ""
				? ["table", mergeAttributes(HTMLAttributes), ["tbody", 0]]
				: ["table", mergeAttributes(HTMLAttributes), ["caption", {}, captionText], ["tbody", 0]];
		},

		/**
		 * `as`/`contentDOMElementTag` put the node view's own elements on the table: the renderer's
		 * element is the `<table>`, the wrapper the `<caption>`, and the content hole the `<tbody>` —
		 * so the editor's markup is the markup a reader gets, rather than a table wrapped in divs.
		 */
		addNodeView() {
			return ReactNodeViewRenderer(
				(props: NodeViewProps) => <TableNodeView {...props} hasFootnotes={hasFootnotes} />,
				{ as: "table", contentDOMElementTag: "tbody" },
			);
		},
		// Tables carry data, not layout: column widths are left to the stylesheet, so no `colwidth`
		// attributes are ever written.
	}).configure({ resizable: false });
}

/**
 * The built-in `link` mark, widened so a link can point at one of our own assets instead of a typed
 * url — see `link-targets.ts` in `@dariah-eric/database` for the model and the read-time
 * resolution.
 *
 * The extension is replaced rather than merely given extra attributes, because the target also
 * changes when a link _parses_: an asset link stores a reference and no href, and the stock parse
 * rule is `a[href]`, so a round-trip through HTML (copy/paste, the WordPress import) would drop the
 * mark and leave bare text behind. The rules below are the stock ones plus one for our own markup.
 *
 * `asset` is write-only from the editor's point of view: read paths attach it (url, filename, size)
 * and it is deliberately neither parsed nor serialised, so a resolved url can never end up in
 * stored content and go stale.
 */
const LinkWithTargets = Link.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			targetKind: {
				default: null,
				parseHTML: (element) => element.dataset.targetKind ?? null,
				renderHTML: (attributes) => {
					const targetKind = attributes.targetKind as string | null;
					return targetKind == null ? {} : { "data-target-kind": targetKind };
				},
			},
			assetKey: {
				default: null,
				parseHTML: (element) => element.dataset.assetKey ?? null,
				renderHTML: (attributes) => {
					const assetKey = attributes.assetKey as string | null;
					return assetKey == null ? {} : { "data-asset-key": assetKey };
				},
			},
			entityId: {
				default: null,
				parseHTML: (element) => element.dataset.entityId ?? null,
				renderHTML: (attributes) => {
					const entityId = attributes.entityId as string | null;
					return entityId == null ? {} : { "data-entity-id": entityId };
				},
			},
			asset: {
				default: null,
				parseHTML: () => null,
				renderHTML: () => {
					return {};
				},
			},
			entity: {
				default: null,
				parseHTML: () => null,
				renderHTML: () => {
					return {};
				},
			},
		};
	},

	parseHTML() {
		return [...(this.parent?.() ?? []), { tag: "a[data-asset-key]" }, { tag: "a[data-entity-id]" }];
	},
	/**
	 * `target`/`rel` are nulled against the extension's `_blank` / `noopener noreferrer nofollow`
	 * defaults: opening in a new tab is the reader's call, and the default applied to `#fragment` and
	 * `mailto:` links too. Nulled one by one rather than `HTMLAttributes: {}`, because `configure`
	 * deep-merges.
	 *
	 * These are also _declared attributes_ defaulting to this option, so the stock options had every
	 * saved link storing them — which is how they reached the database. Saves now write `"target":
	 * null`, which renders as nothing and `normalizeRichTextDocument` strips.
	 */
}).configure({
	openOnClick: false,
	defaultProtocol: "https",
	HTMLAttributes: { target: null, rel: null },
});

interface CreateRichTextExtensionsOptions {
	/**
	 * Whether the caption editors on the block nodes offer footnotes. Follows the field's own opt-in:
	 * a caption cites the same evidence its article does, so the two are one decision.
	 *
	 * `FootnoteNode` is in the schema either way — see {@link FootnotePasteGuard} — so this only
	 * decides what a caption editor offers, never what it can open.
	 */
	hasFootnotes?: boolean;
	renderImagePicker?: ImagePickerRenderer;
	renderAssetMetadata?: AssetMetadataRenderer;
	/**
	 * Enables the slash command menu. Left out by the read-only renderer, which has no caret to
	 * trigger it from.
	 */
	slashCommandHandlersRef?: RefObject<SlashCommandHandlers | null>;
}

/**
 * Canonical extension set for the rich text editor. Shared with the static renderer so that the
 * read-only details views resolve the same node types the editor can produce (e.g. `image`,
 * `assetImage`, `embedBlock`); otherwise rendering content authored in the editor or imported from
 * WordPress throws `Unknown node type`.
 */
export function createRichTextExtensions(
	options?: Readonly<CreateRichTextExtensionsOptions>,
): Extensions {
	return [
		// The link mark comes from `LinkWithTargets` below instead, which extends it to carry asset
		// targets; two link extensions would collide on the same mark name.
		StarterKit.configure({
			heading: { levels: [2, 3, 4] },
			link: false,
			// Replaced by `DocumentWithContainers` below, which widens the top level to take containers.
			document: false,
		}),
		DocumentWithContainers,
		// Normalise typography as authors type. Keep the unambiguous substitutions (smart
		// quotes/apostrophes, `--` → em dash, `...` → ellipsis) and disable the rest, which corrupt
		// legitimate technical/academic text — e.g. `(c)` as a list marker → ©, `1/2` → ½, `->` → →,
		// `!=` → ≠, `<<`/`>>` → «/».
		Typography.configure({
			copyright: false,
			registeredTrademark: false,
			trademark: false,
			servicemark: false,
			oneHalf: false,
			oneQuarter: false,
			threeQuarters: false,
			plusMinus: false,
			notEqual: false,
			laquo: false,
			raquo: false,
			leftArrow: false,
			rightArrow: false,
			multiplication: false,
			superscriptTwo: false,
			superscriptThree: false,
		}),
		// Cells hold ordinary block content. Without these node types a pasted or imported `<table>` is
		// silently flattened into one paragraph of run-together cell text — which is exactly what the
		// WordPress migration produced.
		//
		// The kit's own table node is left out for the captioned one below; the rest of it (rows,
		// cells, header cells) is unchanged.
		TableKit.configure({ table: false }),
		createTableNode(options?.hasFootnotes),
		LinkWithTargets,
		Image,
		createAssetImageNode(
			options?.renderImagePicker,
			options?.renderAssetMetadata,
			options?.hasFootnotes,
		),
		createMediaTextNode(
			options?.renderImagePicker,
			options?.renderAssetMetadata,
			options?.hasFootnotes,
		),
		createGalleryNode(
			options?.renderImagePicker,
			options?.renderAssetMetadata,
			options?.hasFootnotes,
		),
		createEmbedNode(options?.hasFootnotes),
		CalloutNode,
		AccordionNode,
		AccordionItemNode,
		ButtonLinkNode,
		PlaceholderValueNode,
		FootnoteNode,
		...(options?.slashCommandHandlersRef != null
			? [createSlashCommandExtension(options.slashCommandHandlersRef)]
			: []),
	];
}

export function RichTextEditor(props: Readonly<RichTextEditorProps>): ReactNode {
	const {
		"aria-label": ariaLabel,
		content,
		onChange,
		isEditable = true,
		name,
		className,
		size,
		blocks = [],
		renderImagePicker,
		renderImageInsert,
		renderAssetMetadata,
		renderDocumentPicker,
		renderEntityPicker,
		renderLinkTargetSummary,
	} = props;

	const t = useExtracted("ui");

	const initialContent = useMemo(() => normalizeInitialContent(content), [content]);

	const slashCommandHandlersRef = useRef<SlashCommandHandlers | null>(null);

	/**
	 * Whether this field takes footnotes at all — the same opt-in that puts the action in the toolbar
	 * also decides whether one may arrive by other means (see {@link FootnotePasteGuard}).
	 */
	const hasFootnotes = blocks.includes("footnote");

	const extensions = useMemo(
		() => [
			...createRichTextExtensions({
				hasFootnotes,
				renderImagePicker,
				renderAssetMetadata,
				slashCommandHandlersRef: isEditable ? slashCommandHandlersRef : undefined,
			}),
			...(hasFootnotes ? [] : [FootnotePasteGuard]),
		],
		[renderImagePicker, renderAssetMetadata, isEditable, hasFootnotes],
	);

	const editor = useEditor({
		extensions,
		content: initialContent,
		editable: isEditable,
		immediatelyRender: false,
		onUpdate() {
			if (editor) {
				const json = editor.getJSON();
				// oxlint-disable-next-line no-use-before-define
				setEditorJson(json);
				onChange?.(json);
			}
		},
		editorProps: {
			attributes: {
				class: twMerge(
					// `footnotes` roots the counter that numbers footnote markers: one editor holds one whole
					// document (the app splits it into content blocks only on save), so numbering here runs
					// across the article exactly as it will on the page.
					"richtext px-4 py-3 footnotes max-inline-none min-block-37.5 focus:outline-none",
					size != null ? richtextSizeClass[size] : undefined,
				),
				role: "textbox",
				"aria-multiline": "true",
				...(ariaLabel != null ? { "aria-label": ariaLabel } : {}),
			},
		},
	});

	const activeState = useEditorState({ editor, selector: selectRichTextActiveState });

	/** Which host-owned picker dialog the insert menu has asked for, if any. */
	const [openPicker, setOpenPicker] = useState<"document" | "entity" | "image" | null>(null);

	/**
	 * The target the open picker is replacing — the asset key or document id the link at the cursor
	 * currently points at — or `null` when the picker was opened to make a new link. The same two
	 * dialogs serve both: the insert menu opens them to link a selection, the link popover to point
	 * an existing link somewhere else.
	 *
	 * Held as state rather than a ref because the pickers are handed it, to open on the target they
	 * are about to replace. Safe to clear when the picker closes: both dialogs report the selection
	 * before they close, so this is still set when `linkTarget` reads it.
	 */
	const [linkRetarget, setLinkRetarget] = useState<{
		kind: "document" | "entity";
		target: string;
	} | null>(null);

	const closePicker = useCallback((isOpen: boolean) => {
		if (!isOpen) {
			setOpenPicker(null);
			setLinkRetarget(null);
		}
	}, []);

	const pickImage = useCallback(() => {
		setOpenPicker("image");
	}, []);

	/** Opens a target picker to link the selection to whatever is picked. */
	const openTargetPicker = useCallback((kind: "document" | "entity") => {
		setLinkRetarget(null);
		setOpenPicker(kind);
	}, []);

	const actions = useRichTextActions({
		editor,
		activeState: activeState ?? null,
		blocks,
		hasImagePicker: renderImagePicker != null,
		onPickImage: renderImageInsert != null ? pickImage : undefined,
	});

	const actionsByGroup = useMemo(() => {
		return {
			blockStyle: actions.filter((action) => action.group === "block-style"),
			format: actions.filter((action) => action.group === "format"),
			block: actions.filter((action) => action.group === "block"),
			insert: actions.filter((action) => action.group === "insert"),
		};
	}, [actions]);

	/** The slash menu offers everything but inline marks — it fires on an empty cursor. */
	const slashCommandItems = useMemo(
		() => actions.filter((action) => action.group !== "format"),
		[actions],
	);

	/** What the text-style trigger shows: the style at the cursor, falling back to the first entry. */
	const activeBlockStyle =
		actionsByGroup.blockStyle.find((action) => action.isActive === true) ??
		actionsByGroup.blockStyle[0];

	const insertActions = useMemo(
		() => actionsByGroup.insert.filter((action) => action.isAvailable?.() !== false),
		[actionsByGroup],
	);

	const hasLinkTargetPickers =
		renderDocumentPicker != null ||
		renderEntityPicker != null ||
		blocks.includes("placeholderValue");

	/**
	 * The picker that can repoint the link at the cursor, or `null` where there is no such link or
	 * the host did not supply that picker — a form that never offered document links has no dialog to
	 * change one with, even if the content it opened on holds some.
	 */
	const retargetPicker: "document" | "entity" | null =
		activeState?.linkTargetKind === "asset" && renderDocumentPicker != null
			? "document"
			: activeState?.linkTargetKind === "entity" && renderEntityPicker != null
				? "entity"
				: null;

	/** The reference the link at the cursor holds, which is what a picker would be replacing. */
	const currentLinkTarget =
		retargetPicker === "document"
			? (activeState?.linkAssetKey ?? null)
			: retargetPicker === "entity"
				? (activeState?.linkEntityId ?? null)
				: null;

	/**
	 * What the popover says the link points at. The host names the target where it can; otherwise the
	 * kind alone, which is all the editor itself knows.
	 */
	const linkTargetSummary =
		activeState?.linkTargetKind === "asset" && activeState.linkAssetKey != null
			? renderLinkTargetSummary?.({ kind: "asset", assetKey: activeState.linkAssetKey })
			: activeState?.linkTargetKind === "entity" && activeState.linkEntityId != null
				? renderLinkTargetSummary?.({ kind: "entity", entityId: activeState.linkEntityId })
				: null;

	const [editorJson, setEditorJson] = useState<JSONContent | undefined>(initialContent);

	/**
	 * The document's notes, in the order their markers are numbered in. Shown as a list under the
	 * editor because that is where a reader meets them — a marker in the prose carries only its
	 * number, so without this an author would have to open every one to proof-read the references.
	 *
	 * Read off the same JSON the form submits (rather than through `useEditorState`, whose first
	 * snapshot is taken before the editor has its content) so the list is right on the first render,
	 * and through the same helper the read paths use, so both build the list the same way.
	 *
	 * Shown whenever the document holds notes, not only where the feature is enabled: a field that
	 * has footnotes turned off can still be opened on content that already had them, and hiding the
	 * notes would hide text the markers in the prose are pointing at.
	 */
	const footnotes = useMemo(() => collectFootnotes(editorJson), [editorJson]);

	const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
	const [linkHrefInput, setLinkHrefInput] = useState("");
	const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

	const handleLinkPopoverOpenChange = useCallback(
		(open: boolean) => {
			if (open && editor) {
				savedSelectionRef.current = {
					from: editor.state.selection.from,
					to: editor.state.selection.to,
				};
				setLinkHrefInput(activeState?.linkHref ?? "");
			}
			setIsLinkPopoverOpen(open);
		},
		[editor, activeState?.linkHref],
	);

	const applyLink = useCallback(() => {
		if (!editor) {
			return;
		}
		const href = linkHrefInput.trim();
		if (!href) {
			return;
		}

		const sel = savedSelectionRef.current;
		const chain = editor.chain().focus();
		if (sel) {
			chain.setTextSelection(sel);
		}

		if (sel && sel.from === sel.to && !(activeState?.isLink ?? false)) {
			chain
				.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
				.run();
		} else {
			if (activeState?.isLink === true) {
				chain.extendMarkRange("link");
			}
			chain.setLink({ href }).run();
		}

		setIsLinkPopoverOpen(false);
	}, [editor, linkHrefInput, activeState?.isLink]);

	const removeLink = useCallback(() => {
		if (!editor) {
			return;
		}
		const sel = savedSelectionRef.current;
		const chain = editor.chain().focus();
		if (sel) {
			chain.setTextSelection(sel);
		}
		if (activeState?.isLink === true) {
			chain.extendMarkRange("link");
		}
		chain.unsetLink().run();
		setIsLinkPopoverOpen(false);
	}, [editor, activeState?.isLink]);

	const insertPlaceholderValue = useCallback(
		(value: { kind: string; label: string }) => {
			if (!editor) {
				return;
			}
			editor
				.chain()
				.focus()
				.insertContent({
					type: "placeholderValue",
					attrs: { kind: value.kind, label: value.label },
				})
				.run();
		},
		[editor],
	);

	/**
	 * Turns the selection into a link to something we own — or, with nothing selected, inserts the
	 * target's label as the link text, so a picked target always ends up readable. Where the picker
	 * was opened to retarget, points the link the cursor is in at the new target instead, keeping
	 * whatever text it already reads as: the author wrote that, and a picked label would overwrite
	 * it.
	 *
	 * No href is stored: the reference is, and read paths resolve it to wherever the target currently
	 * lives.
	 */
	const linkTarget = useCallback(
		(attrs: Record<string, unknown>, label: string) => {
			if (!editor) {
				return;
			}

			// Every target attribute is spelled out, including the ones this kind leaves empty, because
			// `setMark` merges into the mark that is already there. A document link retargeted at a page
			// would otherwise keep its `assetKey`, and be read back as a document link by the
			// `a[data-asset-key]` parse rule on the next round-trip through HTML.
			const targetAttrs = {
				href: null,
				targetKind: null,
				assetKey: null,
				entityId: null,
				asset: null,
				entity: null,
				...attrs,
			};

			// `setMark` rather than `setLink` throughout: the link extension's setter takes (and
			// validates) an href, and these links deliberately have none — the reference is the target.
			if (linkRetarget != null && editor.isActive("link")) {
				const chain = editor.chain().focus();
				// The popover took the cursor out of the editor when it opened, so restore what it saved
				// before extending over the link — the same restore `applyLink` and `removeLink` do.
				const selection = savedSelectionRef.current;
				if (selection) {
					chain.setTextSelection(selection);
				}
				chain.extendMarkRange("link").setMark("link", targetAttrs).run();
				return;
			}

			const { from, to } = editor.state.selection;
			const chain = editor.chain().focus();

			if (from === to) {
				chain
					.insertContent({
						type: "text",
						text: label,
						marks: [{ type: "link", attrs: targetAttrs }],
					})
					.run();
				return;
			}

			if (editor.isActive("link")) {
				chain.extendMarkRange("link");
			}

			chain.setMark("link", targetAttrs).run();
		},
		[editor, linkRetarget],
	);

	const linkDocument = useCallback(
		(assetKey: string, label: string) => {
			linkTarget({ targetKind: "asset", assetKey }, label);
		},
		[linkTarget],
	);

	const linkEntity = useCallback(
		(entityId: string, label: string) => {
			linkTarget({ targetKind: "entity", entityId }, label);
		},
		[linkTarget],
	);

	/**
	 * Opens a target picker to point the link the cursor is in at something else. Closes the popover
	 * that offered it: the picker is a modal dialog, and the popover would sit under it and take the
	 * selection restore with it when it closed.
	 */
	const retargetLink = useCallback((kind: "document" | "entity", target: string) => {
		setLinkRetarget({ kind, target });
		setIsLinkPopoverOpen(false);
		setOpenPicker(kind);
	}, []);

	const insertImage = useCallback<InsertImage>(
		(imageKey, imageUrl, asset) => {
			if (!editor) {
				return;
			}
			if (imageKey) {
				editor
					.chain()
					.focus()
					.insertContent({
						type: "assetImage",
						attrs: {
							imageKey,
							imageUrl,
							alt: asset?.alt ?? null,
							assetCaption: asset?.caption ?? null,
							captionMode: "inherit",
						},
					})
					.run();
			} else {
				editor.chain().focus().setImage({ src: imageUrl }).run();
			}
		},
		[editor],
	);

	if (editor == null) {
		return null;
	}

	return (
		<div
			className={twMerge("relative overflow-clip rounded-lg border border-input bg-bg", className)}
		>
			{isEditable ? (
				<div className="sticky inset-bs-0 z-10 flex flex-wrap items-center gap-0.5 border-be border-border bg-muted px-2 py-1.5">
					{/* Paragraph and the headings are alternatives to one another, so they read as one
					    choice rather than as four toggles that happen to cancel each other out. */}
					<Menu>
						<Tooltip>
							{/* The name carries the visible label as well as the purpose: the trigger shows the
							    style at the cursor, and a name of "Text style" alone would not contain it. */}
							<MenuTrigger
								aria-label={`${t("Text style")}: ${activeBlockStyle?.label ?? t("Paragraph")}`}
								className={twMerge(toolbarTriggerClassName, "px-2 text-sm")}
							>
								{activeBlockStyle?.label ?? t("Paragraph")}
								<ChevronDownIcon className="block-3 inline-3" />
							</MenuTrigger>
							<TooltipContent inverse={true}>{t("Text style")}</TooltipContent>
						</Tooltip>
						{/* The styles are alternatives, so the menu marks the one at the cursor rather than
						    leaving the trigger as the only place it is named. */}
						<MenuContent
							disallowEmptySelection={true}
							placement="bottom start"
							selectedKeys={activeBlockStyle != null ? [activeBlockStyle.id] : []}
							selectionMode="single"
						>
							{actionsByGroup.blockStyle.map((action) => (
								<MenuItem id={action.id} key={action.id} onAction={action.run}>
									<action.icon data-slot="icon" />
									<MenuLabel>{action.label}</MenuLabel>
								</MenuItem>
							))}
						</MenuContent>
					</Menu>
					<span className="mx-1 bg-border block-4 inline-px" />
					{actionsByGroup.format.map((action) => (
						<RichTextEditorIconButton
							aria-label={action.label}
							icon={action.icon}
							isActive={action.isActive}
							key={action.id}
							onClick={action.run}
						/>
					))}
					<span className="mx-1 bg-border block-4 inline-px" />
					{actionsByGroup.block.map((action) => (
						<RichTextEditorIconButton
							aria-label={action.label}
							icon={action.icon}
							isActive={action.isActive}
							key={action.id}
							onClick={action.run}
						/>
					))}
					<span className="mx-1 bg-border block-4 inline-px" />
					<Popover isOpen={isLinkPopoverOpen} onOpenChange={handleLinkPopoverOpenChange}>
						<Tooltip>
							<PopoverTrigger
								aria-label={t("Link")}
								className={twMerge(
									toolbarTriggerClassName,
									"inline-8",
									activeState?.isLink === true && "bg-primary-subtle/50 text-fg",
								)}
							>
								<LinkIcon className="block-4 inline-4" />
							</PopoverTrigger>
							<TooltipContent inverse={true}>{t("Link")}</TooltipContent>
						</Tooltip>
						<PopoverContent className="p-3">
							{activeState?.linkTargetKind != null ? (
								// These links hold a reference, not an href, so the url field would have nothing
								// to show and applying it would silently replace the target. Changing one means
								// picking a new target, which is the same dialog the insert menu opens.
								<div className="flex flex-col gap-2 inline-56">
									{linkTargetSummary ?? (
										<Note intent="info">
											{activeState.linkTargetKind === "asset"
												? t("This link points to a document.")
												: t("This link points to another page.")}
										</Note>
									)}
									<div className="flex gap-2">
										{retargetPicker != null && currentLinkTarget != null ? (
											<Button
												className="flex-1"
												intent="primary"
												onPress={() => {
													retargetLink(retargetPicker, currentLinkTarget);
												}}
												size="sm"
												type="button"
											>
												{retargetPicker === "document" ? t("Change document") : t("Change page")}
											</Button>
										) : null}
										<Button intent="outline" onPress={removeLink} size="sm" type="button">
											{t("Remove")}
										</Button>
									</div>
								</div>
							) : (
								<form
									className="flex flex-col gap-2 inline-56"
									onSubmit={(e) => {
										e.preventDefault();
										applyLink();
									}}
								>
									<Input
										autoFocus={true}
										onChange={(e) => {
											setLinkHrefInput(e.target.value);
										}}
										placeholder="https://example.com"
										required={true}
										type="text"
										value={linkHrefInput}
									/>
									<div className="flex gap-2">
										<Button className="flex-1" intent="primary" size="sm" type="submit">
											{t("Apply")}
										</Button>
										{activeState?.isLink === true && (
											<Button intent="outline" onPress={removeLink} size="sm" type="button">
												{t("Remove")}
											</Button>
										)}
									</div>
								</form>
							)}
						</PopoverContent>
					</Popover>
					{/* The row and column commands act on the cell holding the cursor, so the whole control
					    only appears once the selection is inside a table. Inserting one is in the insert
					    menu, with every other block. */}
					{activeState?.isInTable === true ? (
						<Menu>
							<Tooltip>
								<MenuTrigger
									aria-label={t("Table")}
									className={twMerge(
										toolbarTriggerClassName,
										"inline-8",
										"bg-primary-subtle/50 text-fg",
									)}
								>
									<TableIcon className="block-4 inline-4" />
								</MenuTrigger>
								<TooltipContent inverse={true}>{t("Table")}</TooltipContent>
							</Tooltip>
							{/* A menu rather than a popover of buttons: these are commands, like the ones the
							    insert menu offers, and a menu is what gives them keyboard navigation. */}
							<MenuContent placement="bottom start">
								<MenuItem
									onAction={() => {
										editor.chain().focus().toggleHeaderRow().run();
									}}
								>
									<MenuLabel>{t("Toggle header row")}</MenuLabel>
								</MenuItem>
								<MenuSeparator />
								<MenuItem
									onAction={() => {
										editor.chain().focus().addRowBefore().run();
									}}
								>
									<MenuLabel>{t("Add row above")}</MenuLabel>
								</MenuItem>
								<MenuItem
									onAction={() => {
										editor.chain().focus().addRowAfter().run();
									}}
								>
									<MenuLabel>{t("Add row below")}</MenuLabel>
								</MenuItem>
								<MenuItem
									onAction={() => {
										editor.chain().focus().deleteRow().run();
									}}
								>
									<MenuLabel>{t("Delete row")}</MenuLabel>
								</MenuItem>
								<MenuSeparator />
								<MenuItem
									onAction={() => {
										editor.chain().focus().addColumnBefore().run();
									}}
								>
									<MenuLabel>{t("Add column before")}</MenuLabel>
								</MenuItem>
								<MenuItem
									onAction={() => {
										editor.chain().focus().addColumnAfter().run();
									}}
								>
									<MenuLabel>{t("Add column after")}</MenuLabel>
								</MenuItem>
								<MenuItem
									onAction={() => {
										editor.chain().focus().deleteColumn().run();
									}}
								>
									<MenuLabel>{t("Delete column")}</MenuLabel>
								</MenuItem>
								<MenuSeparator />
								<MenuItem
									intent="danger"
									onAction={() => {
										editor.chain().focus().deleteTable().run();
									}}
								>
									<MenuLabel>{t("Delete table")}</MenuLabel>
								</MenuItem>
							</MenuContent>
						</Menu>
					) : null}
					<span className="mx-1 bg-border block-4 inline-px" />
					<Menu>
						<Tooltip>
							<MenuTrigger
								aria-label={t("Insert")}
								className={twMerge(toolbarTriggerClassName, "px-2 text-sm")}
							>
								<PlusIcon className="block-4 inline-4" />
								{t("Insert")}
								<ChevronDownIcon className="block-3 inline-3" />
							</MenuTrigger>
							<TooltipContent inverse={true}>{t("Insert")}</TooltipContent>
						</Tooltip>
						{/* Aligned to the trigger's start rather than its end: the menu is wider than the
						    trigger, and an end-aligned one hangs off to the left over unrelated toolbar. */}
						<MenuContent placement="bottom start">
							{/* `isAvailable` keeps the menu from offering a block the schema would refuse
							    where the cursor is — a table inside a table, an image inside a media body. */}
							{insertActions.map((action) => (
								<MenuItem key={action.id} onAction={action.run}>
									<action.icon data-slot="icon" />
									<MenuLabel>{action.label}</MenuLabel>
								</MenuItem>
							))}
							{hasLinkTargetPickers ? <MenuSeparator /> : null}
							{renderDocumentPicker != null ? (
								<MenuItem
									onAction={() => {
										openTargetPicker("document");
									}}
								>
									<PaperclipIcon data-slot="icon" />
									<MenuLabel>{t("Link to document")}</MenuLabel>
								</MenuItem>
							) : null}
							{renderEntityPicker != null ? (
								<MenuItem
									onAction={() => {
										openTargetPicker("entity");
									}}
								>
									<LinkIcon data-slot="icon" />
									<MenuLabel>{t("Link to page")}</MenuLabel>
								</MenuItem>
							) : null}
							{blocks.includes("placeholderValue") ? (
								<MenuSubMenu>
									<MenuItem>
										<VariableIcon data-slot="icon" />
										<MenuLabel>{t("Placeholder value")}</MenuLabel>
									</MenuItem>
									<MenuContent>
										{placeholderValueKindsEnum.map((kind) => (
											<MenuItem
												key={kind}
												onAction={() => {
													insertPlaceholderValue({
														kind,
														label: placeholderValueKindLabels[kind],
													});
												}}
											>
												<MenuLabel>{placeholderValueKindLabels[kind]}</MenuLabel>
											</MenuItem>
										))}
									</MenuContent>
								</MenuSubMenu>
							) : null}
						</MenuContent>
					</Menu>
					{/* Mounted outside the menu that opens them: a dialog nested in a menu is unmounted by
					    the menu closing, before it ever gets to open. */}
					{renderImageInsert?.({
						isOpen: openPicker === "image",
						onOpenChange: closePicker,
						select: insertImage,
					})}
					{renderDocumentPicker?.({
						isOpen: openPicker === "document",
						onOpenChange: closePicker,
						select: linkDocument,
						current: linkRetarget?.kind === "document" ? linkRetarget.target : null,
					})}
					{renderEntityPicker?.({
						isOpen: openPicker === "entity",
						onOpenChange: closePicker,
						select: linkEntity,
						current: linkRetarget?.kind === "entity" ? linkRetarget.target : null,
					})}
				</div>
			) : null}
			{name != null && (
				<input
					name={name}
					type="hidden"
					value={JSON.stringify(editorJson ?? { type: "doc", content: [] })}
				/>
			)}
			<EditorContent editor={editor} />
			{footnotes.length > 0 ? (
				<div className="border-bs border-border bg-muted/40 px-4 py-3">
					<h3 className="text-xs font-medium tracking-wide text-muted-fg uppercase">
						{t("Footnotes")}
					</h3>
					<ol className="mbs-2 list-decimal space-y-1 ps-5 text-sm">
						{footnotes.map((note, index) => (
							// Positional keys: a note has no identity of its own — it is the marker at this
							// position in the document, and the list is rebuilt from the document on every change.
							<li key={index}>
								{note != null ? (
									<InlineRichTextRenderer content={note} />
								) : (
									<span className="text-muted-fg italic">{t("Empty note")}</span>
								)}
							</li>
						))}
					</ol>
				</div>
			) : null}
			{isEditable ? (
				<SlashCommandMenu
					editor={editor}
					emptyLabel={t("No matching blocks")}
					handlersRef={slashCommandHandlersRef}
					items={slashCommandItems}
					label={t("Insert block")}
				/>
			) : null}
		</div>
	);
}

interface RichTextRendererProps {
	content: JSONContent;
	className?: string;
}

export function RichTextRenderer(props: Readonly<RichTextRendererProps>): ReactNode {
	const { content, className } = props;

	return (
		<RichTextEditor
			className={cn("[&_.ProseMirror]:cursor-default", className)}
			content={content}
			isEditable={false}
		/>
	);
}

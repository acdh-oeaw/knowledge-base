// oxlint-disable jsx-a11y/iframe-has-title

"use client";

import { type Extensions, type JSONContent, Node, mergeAttributes } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import {
	EditorContent,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
	useEditor,
	useEditorState,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import cn from "clsx/lite";
import {
	BoldIcon,
	CodeIcon,
	Heading2Icon,
	Heading3Icon,
	Heading4Icon,
	ItalicIcon,
	LinkIcon,
	ListIcon,
	ListOrderedIcon,
	PencilIcon,
	QuoteIcon,
	Trash2Icon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useCallback, useId, useMemo, useRef, useState } from "react";
import { Button as ButtonPrimitive } from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { Button } from "@/lib/button";
import { Input } from "@/lib/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/popover";
import { Tooltip, TooltipContent } from "@/lib/tooltip";

interface RichTextEditorProps {
	"aria-label"?: string;
	className?: string;
	content?: JSONContent;
	isEditable?: boolean;
	name?: string;
	onChange?: (content: JSONContent) => void;
	renderEmbedInsert?: (insertEmbed: () => void) => ReactNode;
	renderImagePicker?: (insert: (imageKey: string, imageUrl: string) => void) => ReactNode;
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

export interface RichTextEditorToolbarButtonProps {
	"aria-label": string;
	icon: React.ComponentType<{ className?: string }>;
	isActive?: boolean;
	onClick: () => void;
}

export function RichTextEditorToolbarButton({
	"aria-label": ariaLabel,
	icon: Icon,
	isActive,
	onClick,
}: Readonly<RichTextEditorToolbarButtonProps>): ReactNode {
	return (
		<Tooltip>
			<ButtonPrimitive
				aria-label={ariaLabel}
				className={twMerge(
					"relative inline-flex block-8 inline-8 items-center justify-center rounded-md transition-colors text-muted-fg hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring",
					isActive === true && "bg-primary-subtle/50 text-fg",
				)}
				onPress={() => {
					onClick();
				}}
				type="button"
			>
				<Icon className="block-4 inline-4" />
			</ButtonPrimitive>
			<TooltipContent inverse={true}>{ariaLabel}</TooltipContent>
		</Tooltip>
	);
}

// Keep the internal alias for backward-compat within this file.
const RichTextEditorIconButton = RichTextEditorToolbarButton;

interface BlockNodeSurfaceProps {
	children: ReactNode;
	className?: string;
	isEditable: boolean;
	isSelected?: boolean;
	label: string;
	onDoubleClick?: () => void;
}

function BlockNodeSurface({
	children,
	className,
	isEditable,
	isSelected = false,
	label,
	onDoubleClick,
}: Readonly<BlockNodeSurfaceProps>): ReactNode {
	return (
		<NodeViewWrapper data-drag-handle="">
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
					if (!isEditable || onDoubleClick == null) {
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

function EmbedNodeView({
	editor,
	getPos,
	node,
	selected,
	updateAttributes,
	deleteNode,
}: Readonly<NodeViewProps>): ReactNode {
	const url = node.attrs.url as string | null;
	const title = node.attrs.title as string | null;
	const caption = node.attrs.caption as string | null;

	const [isEditing, setIsEditing] = useState(url == null && editor.isEditable);
	const [urlInput, setUrlInput] = useState(url ?? "");
	const [titleInput, setTitleInput] = useState(title ?? "");
	const [captionInput, setCaptionInput] = useState(caption ?? "");

	function handleApply() {
		if (!urlInput.trim() || !titleInput.trim()) {
			return;
		}
		updateAttributes({
			url: urlInput.trim(),
			title: titleInput.trim(),
			caption: captionInput.trim() ?? null,
		});
		setIsEditing(false);
	}

	const embedUrl = url != null ? getEmbedUrl(url) : null;

	const urlInputId = useId();
	const titleInputId = useId();
	const captionInputId = useId();

	function resetInputs() {
		setUrlInput(url ?? "");
		setTitleInput(title ?? "");
		setCaptionInput(caption ?? "");
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
					<div className="flex flex-col gap-y-3 p-4">
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
							<label className="text-sm/6 font-medium" htmlFor={captionInputId}>
								{"Caption"}
							</label>
							<Input
								id={captionInputId}
								onChange={(e) => {
									setCaptionInput(e.target.value);
								}}
								type="text"
								value={captionInput}
							/>
						</div>
						<div className="flex items-center gap-x-2">
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
								<span className="min-inline-0 truncate text-xs text-muted-fg">{url}</span>
								<div className="flex shrink-0 gap-x-1">
									<button
										aria-label="Edit embed"
										className="rounded-sm p-1 text-muted-fg hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={() => {
											selectNode();
											setUrlInput(url ?? "");
											setTitleInput(title ?? "");
											setCaptionInput(caption ?? "");
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
								<span className="min-inline-0 truncate text-xs text-muted-fg">{url}</span>
							</div>
						)}
						{caption != null && caption !== "" && (
							<p className="border-bs border-border px-4 py-2 text-sm text-muted-fg">{caption}</p>
						)}
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
export const EmbedNode = Node.create({
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
						caption: el.dataset.caption,
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
				"data-caption": node.attrs.caption as string | null,
			},
		];
	},

	addNodeView() {
		return ReactNodeViewRenderer(EmbedNodeView);
	},
});

interface AssetImageNodeViewProps extends NodeViewProps {
	renderImagePicker?: ImagePickerRenderer;
}

function AssetImageNodeView({
	editor,
	getPos,
	node,
	selected,
	updateAttributes,
	deleteNode,
	renderImagePicker,
}: Readonly<AssetImageNodeViewProps>): ReactNode {
	const imageKey = node.attrs.imageKey as string | null;
	const imageUrl = node.attrs.imageUrl as string | null;
	const caption = node.attrs.caption as string | null;

	const [isEditing, setIsEditing] = useState(
		(editor.isEditable && (imageKey == null || imageUrl == null)) || false,
	);
	const [imageKeyInput, setImageKeyInput] = useState(imageKey ?? "");
	const [imageUrlInput, setImageUrlInput] = useState(imageUrl ?? "");
	const [captionInput, setCaptionInput] = useState(caption ?? "");

	const imageKeyInputId = useId();
	const imageUrlInputId = useId();
	const captionInputId = useId();

	function resetInputs() {
		setImageKeyInput(imageKey ?? "");
		setImageUrlInput(imageUrl ?? "");
		setCaptionInput(caption ?? "");
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
			imageKey: imageKeyInput.trim() ?? null,
			imageUrl: nextImageUrl,
			caption: captionInput.trim() ?? null,
		});
		setIsEditing(false);
	}

	return (
		<BlockNodeSurface
			isEditable={editor.isEditable}
			isSelected={selected}
			label="Image block"
			onDoubleClick={() => {
				selectNode();
				resetInputs();
				setIsEditing(true);
			}}
		>
			{isEditing ? (
				<div className="flex flex-col gap-y-3 p-4">
					{renderImagePicker != null ? (
						<div className="flex flex-col gap-y-2">
							<div className="text-sm/6 font-medium">{"Pick image"}</div>
							{renderImagePicker((nextImageKey, nextImageUrl) => {
								updateAttributes({
									imageKey: nextImageKey,
									imageUrl: nextImageUrl,
									caption: captionInput.trim() ?? null,
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
						<label className="text-sm/6 font-medium" htmlFor={captionInputId}>
							{"Caption"}
						</label>
						<Input
							id={captionInputId}
							onChange={(e) => {
								setCaptionInput(e.target.value);
							}}
							type="text"
							value={captionInput}
						/>
					</div>
					<div className="flex items-center gap-x-2">
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
						<img
							alt={caption ?? ""}
							className="block inline-full max-block-96 object-contain"
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
					{caption != null && caption !== "" ? (
						<p className="border-bs border-border px-4 py-2 text-sm text-muted-fg">{caption}</p>
					) : null}
				</div>
			)}
		</BlockNodeSurface>
	);
}

function createAssetImageNode(renderImagePicker?: ImagePickerRenderer): Node {
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
				caption: { default: null },
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
							caption: el.dataset.caption,
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
						"data-asset-image": "",
						"data-image-key": node.attrs.imageKey as string | null,
					},
					node.attrs.caption != null ? { "data-caption": node.attrs.caption as string } : {},
				),
			];
		},

		addNodeView() {
			return ReactNodeViewRenderer((props) => (
				<AssetImageNodeView {...props} renderImagePicker={renderImagePicker} />
			));
		},
	});
}

interface CreateRichTextExtensionsOptions {
	renderImagePicker?: ImagePickerRenderer;
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
		StarterKit.configure({
			heading: { levels: [2, 3, 4] },
			link: {
				openOnClick: false,
				defaultProtocol: "https",
			},
		}),
		Image,
		createAssetImageNode(options?.renderImagePicker),
		EmbedNode,
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
		renderEmbedInsert,
		renderImagePicker,
	} = props;

	const t = useExtracted("ui");

	const initialContent = useMemo(() => normalizeInitialContent(content), [content]);

	const extensions = useMemo(
		() => createRichTextExtensions({ renderImagePicker }),
		[renderImagePicker],
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
				class: "richtext max-w-none focus:outline-none px-4 py-3 min-h-37.5",
				role: "textbox",
				"aria-multiline": "true",
				...(ariaLabel != null ? { "aria-label": ariaLabel } : {}),
			},
		},
	});

	const activeState = useEditorState({
		editor,
		selector(ctx) {
			return {
				isBold: ctx.editor?.isActive("bold"),
				isItalic: ctx.editor?.isActive("italic"),
				isCode: ctx.editor?.isActive("code"),
				isHeading2: ctx.editor?.isActive("heading", { level: 2 }),
				isHeading3: ctx.editor?.isActive("heading", { level: 3 }),
				isHeading4: ctx.editor?.isActive("heading", { level: 4 }),
				isBulletList: ctx.editor?.isActive("bulletList"),
				isOrderedList: ctx.editor?.isActive("orderedList"),
				isBlockquote: ctx.editor?.isActive("blockquote"),
				isLink: ctx.editor?.isActive("link"),
				linkHref: ctx.editor?.getAttributes("link").href as string | undefined,
			};
		},
	});

	const [editorJson, setEditorJson] = useState<JSONContent | undefined>(initialContent);

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

	const insertEmbed = useCallback(() => {
		if (!editor) {
			return;
		}
		editor
			.chain()
			.focus()
			.insertContent({ type: "embedBlock", attrs: { url: null, title: null, caption: null } })
			.run();
	}, [editor]);

	const insertImage = useCallback(
		(imageKey: string, imageUrl: string) => {
			if (!editor) {
				return;
			}
			if (imageKey) {
				editor
					.chain()
					.focus()
					.insertContent({ type: "assetImage", attrs: { imageKey, imageUrl } })
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
					<RichTextEditorIconButton
						aria-label={t("Bold")}
						icon={BoldIcon}
						isActive={activeState?.isBold}
						onClick={() => {
							editor.chain().focus().toggleBold().run();
						}}
					/>
					<RichTextEditorIconButton
						aria-label={t("Italic")}
						icon={ItalicIcon}
						isActive={activeState?.isItalic}
						onClick={() => {
							editor.chain().focus().toggleItalic().run();
						}}
					/>
					<RichTextEditorIconButton
						aria-label={t("Code")}
						icon={CodeIcon}
						isActive={activeState?.isCode}
						onClick={() => {
							editor.chain().focus().toggleCode().run();
						}}
					/>
					<span className="mx-1 block-4 inline-px bg-border" />
					<RichTextEditorIconButton
						aria-label={t("Heading 2")}
						icon={Heading2Icon}
						isActive={activeState?.isHeading2}
						onClick={() => {
							editor.chain().focus().toggleHeading({ level: 2 }).run();
						}}
					/>
					<RichTextEditorIconButton
						aria-label={t("Heading 3")}
						icon={Heading3Icon}
						isActive={activeState?.isHeading3}
						onClick={() => {
							editor.chain().focus().toggleHeading({ level: 3 }).run();
						}}
					/>
					<RichTextEditorIconButton
						aria-label={t("Heading 4")}
						icon={Heading4Icon}
						isActive={activeState?.isHeading4}
						onClick={() => {
							editor.chain().focus().toggleHeading({ level: 4 }).run();
						}}
					/>
					<span className="mx-1 block-4 inline-px bg-border" />
					<RichTextEditorIconButton
						aria-label={t("Bullet List")}
						icon={ListIcon}
						isActive={activeState?.isBulletList}
						onClick={() => {
							editor.chain().focus().toggleBulletList().run();
						}}
					/>
					<RichTextEditorIconButton
						aria-label={t("Ordered List")}
						icon={ListOrderedIcon}
						isActive={activeState?.isOrderedList}
						onClick={() => {
							editor.chain().focus().toggleOrderedList().run();
						}}
					/>
					<RichTextEditorIconButton
						aria-label={t("Blockquote")}
						icon={QuoteIcon}
						isActive={activeState?.isBlockquote}
						onClick={() => {
							editor.chain().focus().toggleBlockquote().run();
						}}
					/>
					<span className="mx-1 block-4 inline-px bg-border" />
					<Popover isOpen={isLinkPopoverOpen} onOpenChange={handleLinkPopoverOpenChange}>
						<Tooltip>
							<PopoverTrigger
								aria-label={t("Link")}
								className={twMerge(
									"relative inline-flex block-8 inline-8 cursor-pointer items-center justify-center rounded-md border-transparent bg-transparent transition-colors text-muted-fg hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
									activeState?.isLink === true && "bg-primary-subtle/50 text-fg",
								)}
							>
								<LinkIcon className="block-4 inline-4" />
							</PopoverTrigger>
							<TooltipContent inverse={true}>{t("Link")}</TooltipContent>
						</Tooltip>
						<PopoverContent className="p-3">
							<form
								className="flex inline-56 flex-col gap-2"
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
						</PopoverContent>
					</Popover>
					{renderImagePicker != null ? (
						<>
							<span className="mx-1 block-4 inline-px bg-border" />
							{renderImagePicker(insertImage)}
						</>
					) : null}
					{renderEmbedInsert != null ? (
						<>
							{renderImagePicker == null ? (
								<span className="mx-1 block-4 inline-px bg-border" />
							) : null}
							{renderEmbedInsert(insertEmbed)}
						</>
					) : null}
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

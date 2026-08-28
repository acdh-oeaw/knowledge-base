"use client";

import { Extension, type Extensions, type JSONContent } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode, type Schema, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { BoldIcon, ItalicIcon, LinkIcon, SuperscriptIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

import { Button } from "@/lib/button";
import { Input } from "@/lib/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/popover";
import { FootnotePasteGuard } from "@/lib/rich-text-footnote";
import { RichTextEditorToolbarButton } from "@/lib/rich-text-toolbar-button";
import { Tooltip, TooltipContent } from "@/lib/tooltip";

interface InlineRichTextEditorProps {
	"aria-label"?: string;
	className?: string;
	content?: JSONContent;
	/**
	 * Extensions on top of the inline set — today only `FootnoteNode`, for the captions that carry a
	 * citation apparatus.
	 *
	 * Passed in rather than switched on by a flag, so that this module never imports the footnote
	 * node. The node's own note is written with this editor, and a note that could hold a footnote
	 * would break the one thing the read paths rely on: that walking a document finds every marker
	 * exactly once, in reading order. Here the note editor simply passes nothing, and nesting is
	 * impossible rather than merely discouraged.
	 *
	 * Pass a stable reference — a module-level constant. The schema is rebuilt whenever this array
	 * changes identity, and that pushes `setOptions` through the live editor, so an inline literal
	 * would do so on every render.
	 */
	extensions?: Extensions;
	isEditable?: boolean;
	name?: string;
	onChange?: (content: JSONContent) => void;
}

/** Stable default, so the schema is not rebuilt on every render of a caller that passes none. */
const noExtensions: Extensions = [];

function normalizeInitialContent(content: JSONContent | undefined): JSONContent | undefined {
	if (content == null) {
		return undefined;
	}

	if (typeof content !== "object" || typeof content.type !== "string") {
		return undefined;
	}

	return content;
}

/**
 * The inline content of a fragment, with each block's content run onto the same line.
 *
 * Blocks are separated by a space rather than concatenated, so two pasted paragraphs read as two
 * sentences instead of colliding into one word. The separator carries no marks of its own: a space
 * inheriting the link before it would quietly extend that link past its text.
 */
function toInlineFragment(fragment: Fragment, schema: Schema): Fragment {
	const nodes: Array<ProseMirrorNode> = [];

	function endsWithSpace(): boolean {
		// oxlint-disable-next-line prefer-at
		const last = nodes[nodes.length - 1];
		return last == null || (last.isText && /\s$/.test(last.text ?? ""));
	}

	fragment.forEach((node) => {
		// Text and inline atoms (a footnote marker, where the field takes them) carry over as they are.
		if (node.isInline) {
			nodes.push(node);
			return;
		}

		const inline = toInlineFragment(node.content, schema);

		if (inline.childCount === 0) {
			return;
		}

		if (!endsWithSpace() && !/^\s/.test(inline.child(0).text ?? "")) {
			nodes.push(schema.text(" "));
		}

		inline.forEach((child) => {
			nodes.push(child);
		});
	});

	return Fragment.fromArray(nodes);
}

/**
 * A pasted slice as one line of inline content, ready to merge into the paragraph holding the
 * cursor — which is what a plain-text paste does too. See {@link SingleLinePasteGuard}.
 *
 * Both depths are closed: nothing here opens a block, because nothing here is one any more.
 */
export function flattenPastedSlice(slice: Slice, schema: Schema): Slice {
	return new Slice(toInlineFragment(slice.content, schema), 0, 0);
}

/**
 * Flattens pasted content to a single line.
 *
 * The editor swallows Enter (see `handleKeyDown`) so a caption stays one line, and every read path
 * relies on that: the caption renderers walk a `{ doc > paragraph > text }` document, and a caption
 * is flattened to plain text wherever an element cannot hold richtext. Paste is the one way around
 * the key handler — the schema accepts as many paragraphs as the clipboard holds, and pasting two
 * of them left a caption no renderer expects.
 *
 * A guard rather than a narrower schema (as with {@link FootnotePasteGuard}): a caption that was
 * stored with several paragraphs before this existed still opens and still renders, instead of
 * failing to parse.
 */
const SingleLinePasteGuard = Extension.create({
	name: "singleLinePasteGuard",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("singleLinePasteGuard"),
				props: {
					transformPasted(slice, view) {
						/* The slice arrives already parsed against this editor's schema, so nothing here has
						   to consider a node the schema refuses. */
						return flattenPastedSlice(slice, view.state.schema);
					},
				},
			}),
		];
	},
});

/**
 * Extension set for the inline caption editor: a single paragraph carrying only bold, italic and
 * link marks. Everything block-producing that StarterKit ships (headings, lists, blockquote, code
 * block, horizontal rule, hard break) is disabled so captions stay a single line of formatted text,
 * and the output JSON matches the `{ doc > paragraph > text }` shape used everywhere captions are
 * rendered.
 *
 * `extensions` widens that set — see {@link InlineRichTextEditorProps.extensions}. Whatever it does
 * not bring in is also refused by paste, the same opt-in the block editor applies: hiding an action
 * only covers the way an author would use it deliberately.
 */
export function createInlineRichTextExtensions(extensions: Extensions = []): Extensions {
	const hasFootnotes = extensions.some((extension) => extension.name === "footnote");

	return [
		StarterKit.configure({
			heading: false,
			bulletList: false,
			orderedList: false,
			listItem: false,
			blockquote: false,
			codeBlock: false,
			horizontalRule: false,
			strike: false,
			code: false,
			hardBreak: false,
			/**
			 * `target`/`rel` are nulled against the extension's `_blank` / `noopener noreferrer nofollow`
			 * defaults, the same way the block editor nulls them (see `LinkWithTargets`): whether a link
			 * opens in a new tab is the reader's call, and the default applied to `#fragment` and
			 * `mailto:` links too.
			 *
			 * These are _declared attributes_ defaulting to this option, so the stock ones had every
			 * caption link storing them. Nulled one by one rather than `HTMLAttributes: {}`, because
			 * `configure` deep-merges.
			 */
			link: {
				openOnClick: false,
				defaultProtocol: "https",
				HTMLAttributes: { target: null, rel: null },
			},
		}),
		SingleLinePasteGuard,
		...(hasFootnotes ? [] : [FootnotePasteGuard]),
		...extensions,
	];
}

export function InlineRichTextEditor(props: Readonly<InlineRichTextEditorProps>): ReactNode {
	const {
		"aria-label": ariaLabel,
		className,
		content,
		extensions: extraExtensions = noExtensions,
		isEditable = true,
		name,
		onChange,
	} = props;

	const t = useExtracted("ui");

	const initialContent = useMemo(() => normalizeInitialContent(content), [content]);

	const extensions = useMemo(
		() => createInlineRichTextExtensions(extraExtensions),
		[extraExtensions],
	);

	const hasFootnotes = extraExtensions.some((extension) => extension.name === "footnote");

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
			// Keep captions single-line: swallow Enter so authors can't split the paragraph.
			handleKeyDown(_view, event) {
				if (event.key === "Enter") {
					return true;
				}
				return false;
			},
			attributes: {
				class: "richtext richtext-sm max-inline-none px-3 py-2 focus:outline-none",
				role: "textbox",
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

	if (editor == null) {
		return null;
	}

	return (
		<div
			className={twMerge("relative overflow-clip rounded-lg border border-input bg-bg", className)}
		>
			{isEditable ? (
				<div className="flex flex-wrap items-center gap-0.5 border-be border-border bg-muted px-2 py-1">
					<RichTextEditorToolbarButton
						aria-label={t("Bold")}
						icon={BoldIcon}
						isActive={activeState?.isBold}
						onClick={() => {
							editor.chain().focus().toggleBold().run();
						}}
					/>
					<RichTextEditorToolbarButton
						aria-label={t("Italic")}
						icon={ItalicIcon}
						isActive={activeState?.isItalic}
						onClick={() => {
							editor.chain().focus().toggleItalic().run();
						}}
					/>
					<span className="mx-1 bg-border block-4 inline-px" />
					<Popover isOpen={isLinkPopoverOpen} onOpenChange={handleLinkPopoverOpenChange}>
						<Tooltip>
							<PopoverTrigger
								aria-label={t("Link")}
								className={twMerge(
									"relative inline-flex cursor-pointer items-center justify-center rounded-md border-transparent bg-transparent text-muted-fg transition-colors block-8 inline-8 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
									activeState?.isLink === true && "bg-primary-subtle/50 text-fg",
								)}
							>
								<LinkIcon className="block-4 inline-4" />
							</PopoverTrigger>
							<TooltipContent inverse={true}>{t("Link")}</TooltipContent>
						</Tooltip>
						<PopoverContent className="p-3">
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
						</PopoverContent>
					</Popover>
					{hasFootnotes ? (
						<RichTextEditorToolbarButton
							aria-label={t("Footnote")}
							icon={SuperscriptIcon}
							onClick={() => {
								editor
									.chain()
									.focus()
									// Inserted empty: the node view opens its own note editor as it mounts, and
									// removes the marker again if it is dismissed without a note.
									.insertContent({ type: "footnote", attrs: { content: null } })
									.run();
							}}
						/>
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

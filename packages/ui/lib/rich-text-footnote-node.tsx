"use client";

import { type Extensions, type JSONContent, Node, mergeAttributes } from "@tiptap/core";
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { type ReactNode, useState } from "react";
import { twMerge } from "tailwind-merge";

import { Button } from "@/lib/button";
import { InlineRichTextEditor } from "@/lib/inline-rich-text-editor";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/popover";
import { isEmptyRichTextDocument, toPlainText } from "@/lib/rich-text";
import { parseCaptionAttr, serializeCaptionAttr } from "@/lib/rich-text-block-attrs";
import { Tooltip, TooltipContent } from "@/lib/tooltip";

/**
 * Inline footnote: a marker in the prose which carries its own note text.
 *
 * The note lives in the marker's `content` attribute. Prior art splits two ways: the ProseMirror
 * footnote example keeps the note as the marker's node _content_, edited through a popup
 * sub-editor, while `buttondown/tiptap-footnotes` puts a `footnotes` list at the end of the
 * document and links the two by uuid.
 *
 * The list is out because a document here is split into content blocks on save
 * (`splitDocumentToBlocks` in the app): a trailing list would land in whichever block happened to
 * be last while its markers stayed behind in the others. It also needs a plugin to renumber, to
 * strip orphans and to re-key pasted references, none of which can go wrong if there is nothing to
 * keep in sync. An attribute rather than node content keeps the note out of the editable flow, so a
 * caption editor can own it.
 *
 * Either way marker and note move, copy and delete as one: a note can never be orphaned, and a
 * marker can never point at a note that is gone — exactly the failure the hand-numbered `[1]`/`[2]`
 * references in the migrated WordPress case studies show.
 *
 * No number is stored. Markers number themselves from document order through a CSS counter (see the
 * `footnotes` utility in the stylesheet), so inserting one renumbers the rest for free; read paths
 * that build their own list (the dashboard preview, the public site) number it the same way, by
 * walking the document.
 *
 * The note is written with {@link InlineRichTextEditor}, which is why this node lives in its own
 * module: the editor never imports the footnote back, so a note can hold no footnote of its own.
 */
function FootnoteNodeView({
	editor,
	getPos,
	node,
	selected,
	updateAttributes,
	deleteNode,
}: Readonly<NodeViewProps>): ReactNode {
	const content = node.attrs.content as JSONContent | null;

	const [isOpen, setIsOpen] = useState(content == null && editor.isEditable);
	const [contentInput, setContentInput] = useState<JSONContent | null>(content);

	const text = toPlainText(content);

	if (!editor.isEditable) {
		return <NodeViewWrapper as="sup" data-footnote="" />;
	}

	function selectNode() {
		const pos = getPos();
		if (typeof pos === "number") {
			editor.commands.setNodeSelection(pos);
		}
	}

	function handleApply() {
		if (isEmptyRichTextDocument(contentInput)) {
			return;
		}
		updateAttributes({ content: contentInput });
		setIsOpen(false);
	}

	function handleOpenChange(open: boolean) {
		if (open) {
			selectNode();
			setContentInput(content);
			setIsOpen(true);
			return;
		}
		// A marker whose note was never written points at nothing, so dismissing it removes it rather
		// than leaving an empty number in the text.
		if (content == null) {
			deleteNode();
			return;
		}
		setIsOpen(false);
	}

	return (
		<NodeViewWrapper as="span" className="inline align-baseline" contentEditable={false}>
			<Popover isOpen={isOpen} onOpenChange={handleOpenChange}>
				<Tooltip>
					<PopoverTrigger
						/* The number itself is the CSS counter's `::before`, so it sits inside the trigger and
						   the whole marker — number included — is what opens the note. */
						aria-label={text !== "" ? `Footnote: ${text}` : "Footnote"}
						className={twMerge(
							"cursor-pointer align-super text-[0.75em] font-medium text-primary underline decoration-dotted underline-offset-2",
							selected && "bg-primary-subtle/50",
						)}
						data-footnote=""
					/>
					{text !== "" ? <TooltipContent inverse={true}>{text}</TooltipContent> : null}
				</Tooltip>
				<PopoverContent className="p-3">
					<form
						className="flex flex-col gap-2 inline-72"
						onSubmit={(e) => {
							e.preventDefault();
							handleApply();
						}}
					>
						<div className="flex flex-col gap-y-1">
							<span className="text-sm/6 font-medium">{"Note"}</span>
							<InlineRichTextEditor
								aria-label="Footnote text"
								content={contentInput ?? undefined}
								onChange={setContentInput}
							/>
						</div>
						<div className="flex gap-2">
							<Button
								className="flex-1"
								intent="primary"
								isDisabled={isEmptyRichTextDocument(contentInput)}
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

export const FootnoteNode = Node.create({
	name: "footnote",
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	draggable: false,

	addAttributes() {
		return {
			/** The note itself, as the constrained `{ doc > paragraph }` richtext captions also use. */
			content: { default: null },
			/**
			 * The marker's place in the document, attached by read paths (`numberFootnotes`) so a
			 * renderer can anchor a marker to its note. Never authored and never serialised: the editor
			 * numbers its markers from the `footnotes` CSS counter instead, which is what lets an
			 * insertion renumber the rest for free.
			 */
			number: {
				default: null,
				parseHTML: () => null,
				renderHTML: () => {
					return {};
				},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: "sup[data-footnote]",
				getAttrs(dom) {
					return { content: parseCaptionAttr(dom.dataset.content) };
				},
			},
		];
	},

	renderHTML({ node }) {
		// The marker has no text of its own: its number comes from the `footnotes` CSS counter, and
		// whoever renders the note list walks the document rather than reading it back out of here.
		//
		// The empty string child is what closes the tag. Serialized without one this is `<sup/>`, and
		// HTML has no self-closing syntax for `sup`: a parser reads that as an *open* tag and
		// superscripts the rest of the paragraph.
		return [
			"sup",
			mergeAttributes({
				"data-footnote": "",
				"data-content": serializeCaptionAttr(node.attrs.content as JSONContent | null),
			}),
			"",
		];
	},

	addNodeView() {
		return ReactNodeViewRenderer(FootnoteNodeView);
	},
});

/**
 * What a caption editor passes as `InlineRichTextEditor`'s `extensions` to offer footnotes. A
 * module-level constant because that prop rebuilds the schema whenever it changes identity.
 */
export const inlineFootnoteExtensions: Extensions = [FootnoteNode];

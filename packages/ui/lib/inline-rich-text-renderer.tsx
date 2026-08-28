import type { JSONContent } from "@tiptap/core";
import { Fragment, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

function renderText(node: JSONContent, key: number): ReactNode {
	let element: ReactNode = node.text ?? "";

	for (const mark of node.marks ?? []) {
		if (mark.type === "bold") {
			element = <strong>{element}</strong>;
		} else if (mark.type === "italic") {
			element = <em>{element}</em>;
		} else if (mark.type === "link") {
			const href = mark.attrs?.href as string | undefined;
			// No `target`/`rel`: whether a link opens in a new tab is the reader's call, and this
			// renderer also serves in-page anchors, where a new tab is simply wrong. Matches the link
			// mark's own `HTMLAttributes: {}`.
			element = <a href={href}>{element}</a>;
		}
	}

	return <span key={key}>{element}</span>;
}

/**
 * The editor's own marker: an empty `<sup>`, which the `footnotes` CSS counter numbers from its
 * place in the document. Matches `FootnoteNode`'s `renderHTML`, so a preview inside an editor shows
 * the same number the editor does.
 *
 * A marker is an atom with no content, so it has to be handled before the transparent fallback
 * below — which would otherwise render it as nothing at all.
 */
function renderFootnoteMarker(): ReactNode {
	return <sup data-footnote="" />;
}

interface RenderContext {
	isInline: boolean;
	renderFootnote: (props: { node: JSONContent }) => ReactNode;
}

function renderNode(node: JSONContent, key: number, context: RenderContext): ReactNode {
	if (node.type === "text") {
		return renderText(node, key);
	}

	if (node.type === "footnote") {
		return <Fragment key={key}>{context.renderFootnote({ node })}</Fragment>;
	}

	const children = (node.content ?? []).map((child, index) => renderNode(child, index, context));

	if (node.type === "paragraph") {
		return context.isInline ? <span key={key}>{children}</span> : <p key={key}>{children}</p>;
	}

	// `doc` and any unexpected wrapper node: render children transparently.
	return <span key={key}>{children}</span>;
}

interface InlineRichTextRendererProps {
	content: JSONContent;
	className?: string;
	/**
	 * Renders the text as part of the surrounding line rather than as its own block — for a caller
	 * that puts something after it and wants it on the same line, like the backlink following a
	 * footnote. The editor swallows Enter, so this content is a single paragraph and nothing is lost
	 * by dropping the block boxes.
	 */
	isInline?: boolean;
	/**
	 * How a footnote marker is drawn. Defaults to the editor's markup, an empty `<sup>` numbered by
	 * the `footnotes` CSS counter — right for a preview that sits under a counter root.
	 *
	 * Read paths that have already walked the document (`numberFootnotes`) pass their own, to anchor
	 * each marker to its note: a counter can show a number but cannot put one in an `id`.
	 */
	renderFootnote?: (props: { node: JSONContent }) => ReactNode;
}

/**
 * Read-only, server-compatible renderer for inline caption richtext. Walks the constrained `{ doc >
 * paragraph > text }` shape produced by {@link InlineRichTextEditor} and renders bold, italic and
 * link marks. Kept as a static serializer (rather than a headless editor instance) so captions in
 * lists/tables don't each mount a Tiptap editor.
 */
export function InlineRichTextRenderer(props: Readonly<InlineRichTextRendererProps>): ReactNode {
	const { content, className, isInline = false, renderFootnote = renderFootnoteMarker } = props;

	const Element = isInline ? "span" : "div";
	const context = { isInline, renderFootnote };

	return (
		<Element className={twMerge("richtext richtext-sm", className)}>
			{(content.content ?? []).map((node, index) => renderNode(node, index, context))}
		</Element>
	);
}

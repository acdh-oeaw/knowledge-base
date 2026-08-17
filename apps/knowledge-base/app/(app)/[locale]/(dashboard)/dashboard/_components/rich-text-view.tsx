"use client";

import { RichTextEditor } from "@dariah-eric/ui/rich-text-editor";
import type { JSONContent } from "@tiptap/core";
import type { ReactNode } from "react";

interface RichTextViewProps {
	content: JSONContent;
	ariaLabel?: string;
}

export function RichTextView(props: Readonly<RichTextViewProps>): ReactNode {
	const { content, ariaLabel } = props;

	return (
		<RichTextEditor aria-label={ariaLabel ?? "Content"} content={content} isEditable={false} />
	);
}

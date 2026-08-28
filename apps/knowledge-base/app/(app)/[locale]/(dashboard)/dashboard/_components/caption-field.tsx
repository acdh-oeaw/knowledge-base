"use client";

import { labelStyles } from "@dariah-eric/ui/field";
import { InlineRichTextEditor } from "@dariah-eric/ui/inline-rich-text-editor";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

interface CaptionFieldProps {
	/** Name of the hidden input that carries the serialized richtext JSON. */
	name: string;
	defaultValue?: JSONContent | null;
	label?: string;
}

/**
 * Labelled caption input backed by the inline richtext editor (bold/italic/link). The editor posts
 * its value as JSON through a hidden input named {@link CaptionFieldProps.name}.
 */
export function CaptionField(props: Readonly<CaptionFieldProps>): ReactNode {
	const { name, defaultValue, label } = props;

	const t = useExtracted();
	const captionLabel = label ?? t("Caption");

	return (
		<div className="flex flex-col gap-y-1">
			<span className={labelStyles()}>{captionLabel}</span>
			<InlineRichTextEditor
				aria-label={captionLabel}
				content={defaultValue ?? undefined}
				name={name}
			/>
		</div>
	);
}

"use client";

import { descriptionStyles, labelStyles } from "@dariah-eric/ui/field";
import { InlineRichTextEditor } from "@dariah-eric/ui/inline-rich-text-editor";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { type ReactNode, useId } from "react";

interface CaptionFieldProps {
	/** Name of the hidden input that carries the serialized richtext JSON. */
	name: string;
	defaultValue?: JSONContent | null;
	description?: string;
	label?: string;
}

/**
 * Labelled caption input backed by the inline richtext editor (bold/italic/link). The editor posts
 * its value as JSON through a hidden input named {@link CaptionFieldProps.name}.
 */
export function CaptionField(props: Readonly<CaptionFieldProps>): ReactNode {
	const { name, defaultValue, description, label } = props;

	const t = useExtracted();
	const descriptionId = useId();
	const captionLabel = label ?? t("Caption");

	return (
		<div className="flex flex-col gap-y-1">
			<span className={labelStyles()}>{captionLabel}</span>
			{description != null ? (
				<p className={descriptionStyles()} id={descriptionId}>
					{description}
				</p>
			) : null}
			<InlineRichTextEditor
				aria-describedby={description != null ? descriptionId : undefined}
				aria-label={captionLabel}
				content={defaultValue ?? undefined}
				name={name}
			/>
		</div>
	);
}

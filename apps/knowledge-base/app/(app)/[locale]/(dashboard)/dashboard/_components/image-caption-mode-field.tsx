"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import { labelStyles } from "@dariah-eric/ui/field";
import { InlineRichTextEditor } from "@dariah-eric/ui/inline-rich-text-editor";
import { InlineRichTextRenderer } from "@dariah-eric/ui/inline-rich-text-renderer";
import { isEmptyRichTextDocument } from "@dariah-eric/ui/rich-text";
import { ToggleGroup, ToggleGroupItem } from "@dariah-eric/ui/toggle-group";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { type ReactNode, useRef } from "react";

interface ImageCaptionModeFieldProps {
	/** The caption stored on the asset, previewed while inheriting. */
	assetCaption?: JSONContent | null;
	/** The caption written for this placement, shown and edited while overriding. */
	caption: JSONContent | null;
	captionMode: ImageCaptionMode;
	onChange: (value: { caption: JSONContent | null; captionMode: ImageCaptionMode }) => void;
	/**
	 * Posts the value through hidden inputs named `${name}` and `${name}Mode`, for fields submitted
	 * with a plain form. Controlled callers that persist through their own state omit it.
	 */
	name?: string;
}

/**
 * Chooses which caption one placement of an image shows: the asset's own, a caption written for
 * this placement, or none. The caption belongs to the asset and is shared by every placement, so a
 * placement never edits it - it takes it, replaces it locally, or suppresses it.
 */
export function ImageCaptionModeField(props: Readonly<ImageCaptionModeFieldProps>): ReactNode {
	const { assetCaption, caption, captionMode, name, onChange } = props;

	const t = useExtracted();

	/**
	 * The editor reads its content once, so it stays mounted while the author switches modes -
	 * unmounting it would throw away what they typed - and keeps its initial value stable.
	 */
	const initialCaption = useRef(caption);

	const hasAssetCaption = !isEmptyRichTextDocument(assetCaption);

	return (
		<div className="flex flex-col gap-y-2">
			<span className={labelStyles()}>{t("Caption behavior")}</span>

			{/* The group paints its selection with `primary` by default, which would give this setting
			    the same weight as the form's submit button. It is a choice among three, not a call to
			    action, so the selected segment is a neutral chip and hover stays quieter still. */}
			<ToggleGroup
				aria-label={t("Caption behavior")}
				className="self-start [--toggle-focused-bg:var(--color-muted)] [--toggle-hover-bg:var(--color-muted)] [--toggle-selected-bg:var(--color-secondary)] [--toggle-selected-fg:var(--color-secondary-fg)]"
				disallowEmptySelection={true}
				onSelectionChange={(keys) => {
					const [mode] = [...keys] as Array<ImageCaptionMode>;
					if (mode != null) {
						onChange({ caption, captionMode: mode });
					}
				}}
				selectedKeys={new Set([captionMode])}
				selectionMode="single"
				size="xs"
			>
				<ToggleGroupItem id="inherit">{t("Use asset caption")}</ToggleGroupItem>
				<ToggleGroupItem id="override">{t("Custom caption")}</ToggleGroupItem>
				<ToggleGroupItem id="hidden">{t("No caption")}</ToggleGroupItem>
			</ToggleGroup>

			{captionMode === "inherit" ? (
				hasAssetCaption && assetCaption != null ? (
					<InlineRichTextRenderer
						className="rounded-lg border border-border px-3 py-2 text-sm text-muted-fg"
						content={assetCaption}
					/>
				) : (
					<p className="text-xs text-muted-fg">
						{t("This asset has no caption, so no caption will be shown.")}
					</p>
				)
			) : null}

			<div className={captionMode === "override" ? undefined : "hidden"}>
				<InlineRichTextEditor
					aria-label={t("Custom caption")}
					content={initialCaption.current ?? undefined}
					onChange={(value) => {
						onChange({
							caption: isEmptyRichTextDocument(value) ? null : value,
							captionMode,
						});
					}}
				/>
			</div>

			{name != null ? (
				<>
					<input name={`${name}Mode`} type="hidden" value={captionMode} />
					<input name={name} type="hidden" value={caption != null ? JSON.stringify(caption) : ""} />
				</>
			) : null}
		</div>
	);
}

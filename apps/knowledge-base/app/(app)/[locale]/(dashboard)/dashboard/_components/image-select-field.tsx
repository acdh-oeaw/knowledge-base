"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type { AssetPrefix } from "@dariah-eric/storage/config";
import { Button } from "@dariah-eric/ui/button";
import { fieldErrorStyles } from "@dariah-eric/ui/field";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";

import { ImageCaptionModeField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-caption-mode-field";
import type { MediaLibraryAsset } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-asset";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";
import {
	type SelectedImage,
	SelectedImageCard,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/selected-image-card";

export type { SelectedImage };

interface ImageSelectFieldProps<T extends AssetPrefix> {
	allowRemove?: boolean;
	/** Initial per-entity caption, used when {@link captionName} is set. */
	defaultCaption?: JSONContent | null;
	/** Initial caption behaviour, used when {@link captionName} is set. */
	defaultCaptionMode?: ImageCaptionMode;
	/**
	 * Enables the caption-behaviour controls, posting the caption as JSON under this name and the
	 * mode under `${captionName}Mode`. Omit it for images that never carry a caption.
	 */
	captionName?: string;
	defaultPrefix: T;
	initialAssets: Array<MediaLibraryAsset>;
	isRequired?: boolean;
	name?: string;
	onChange: (image: SelectedImage | null) => void;
	prefixes: ReadonlyArray<T>;
	selectedImage: SelectedImage | null;
}

export function ImageSelectField<T extends AssetPrefix>(
	props: Readonly<ImageSelectFieldProps<T>>,
): ReactNode {
	const {
		allowRemove = false,
		captionName,
		defaultCaption = null,
		defaultCaptionMode = "inherit",
		defaultPrefix,
		initialAssets,
		isRequired = false,
		name = "imageKey",
		onChange,
		prefixes,
		selectedImage,
	} = props;

	const t = useExtracted();
	const [error, setError] = useState(false);
	const [caption, setCaption] = useState<{
		caption: JSONContent | null;
		captionMode: ImageCaptionMode;
	}>({ caption: defaultCaption, captionMode: defaultCaptionMode });

	function handleChange(image: SelectedImage | null) {
		onChange(image);
		setError(false);
	}

	const picker = (
		<MediaLibraryDialog
			defaultPrefix={defaultPrefix}
			initialAssets={initialAssets}
			onSelect={(key, url, asset) => {
				handleChange({ key, url, ...asset });
			}}
			prefixes={prefixes}
			triggerLabel={selectedImage != null ? t("Change image") : undefined}
		/>
	);

	return (
		<>
			{selectedImage != null ? (
				<SelectedImageCard
					footer={
						captionName != null ? (
							<ImageCaptionModeField
								assetCaption={selectedImage.caption}
								caption={caption.caption}
								captionMode={caption.captionMode}
								name={captionName}
								onChange={setCaption}
							/>
						) : null
					}
					image={selectedImage}
					onMetadataChange={handleChange}
				>
					{picker}

					{allowRemove ? (
						<Button
							intent="outline"
							onPress={() => {
								handleChange(null);
							}}
						>
							{t("Remove image")}
						</Button>
					) : null}
				</SelectedImageCard>
			) : (
				picker
			)}

			<input
				aria-hidden={true}
				className="sr-only"
				name={name}
				onChange={(event) => {
					event.currentTarget.setCustomValidity("");
				}}
				onInvalid={(event) => {
					event.preventDefault();
					setError(true);
				}}
				required={isRequired}
				tabIndex={-1}
				value={selectedImage?.key ?? ""}
			/>
			{error ? <div className={fieldErrorStyles()}>{t("Please select an image.")}</div> : null}
		</>
	);
}

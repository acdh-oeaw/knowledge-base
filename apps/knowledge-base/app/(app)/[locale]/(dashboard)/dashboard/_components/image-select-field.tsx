"use client";

import type { AssetPrefix } from "@dariah-eric/storage/config";
import { Button } from "@dariah-eric/ui/button";
import { fieldErrorStyles } from "@dariah-eric/ui/field";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";

import type { MediaLibraryAsset } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-asset";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";

interface SelectedImage {
	key: string;
	url: string;
}

interface ImageSelectFieldProps<T extends AssetPrefix> {
	allowRemove?: boolean;
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

	function handleChange(image: SelectedImage | null) {
		onChange(image);
		setError(false);
	}

	return (
		<>
			{selectedImage != null ? (
				<img
					alt={t("Selected image")}
					className="block-24 inline-auto max-inline-full rounded-lg object-contain"
					src={selectedImage.url}
				/>
			) : null}
			<MediaLibraryDialog
				defaultPrefix={defaultPrefix}
				initialAssets={initialAssets}
				onSelect={(key, url) => {
					handleChange({ key, url });
				}}
				prefixes={prefixes}
			/>
			{allowRemove && selectedImage != null ? (
				<Button
					intent="outline"
					onPress={() => {
						handleChange(null);
					}}
				>
					{t("Remove image")}
				</Button>
			) : null}
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

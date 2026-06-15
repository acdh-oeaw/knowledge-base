"use client";

import { DocumentIcon, PhotoIcon } from "@heroicons/react/24/outline";
import cn from "clsx/lite";
import { type ReactNode, useState } from "react";

interface AssetPreviewProps {
	alt: string;
	className?: string;
	fallbackClassName?: string;
	imageClassName?: string;
	kindLabelClassName?: string;
	mimeType?: string;
	src: string;
	storageKey?: string;
}

const knownAssetKinds = new Map<string, string>([
	["application/msword", "DOC"],
	["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX"],
	["application/pdf", "PDF"],
	["application/vnd.ms-excel", "XLS"],
	["application/vnd.ms-powerpoint", "PPT"],
	["application/vnd.oasis.opendocument.presentation", "ODP"],
	["application/vnd.oasis.opendocument.spreadsheet", "ODS"],
	["application/vnd.oasis.opendocument.text", "ODT"],
	["application/vnd.openxmlformats-officedocument.presentationml.presentation", "PPTX"],
	["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "XLSX"],
	["text/plain", "TXT"],
]);

function isImageMimeType(mimeType?: string): boolean {
	return mimeType?.startsWith("image/") ?? false;
}

function getFileExtension(storageKey?: string): string | null {
	const filename = storageKey?.split("/").pop();
	if (filename == null) {
		return null;
	}

	const ext = filename.split(".").pop();
	if (ext == null || ext === filename) {
		return null;
	}

	return ext.toUpperCase();
}

function getAssetKindLabel(mimeType?: string, storageKey?: string): string {
	return getFileExtension(storageKey) ?? knownAssetKinds.get(mimeType ?? "") ?? "FILE";
}

export function AssetPreview(props: Readonly<AssetPreviewProps>): ReactNode {
	const {
		alt,
		className,
		fallbackClassName,
		imageClassName,
		kindLabelClassName,
		mimeType,
		src,
		storageKey,
	} = props;

	const [hasImageError, setHasImageError] = useState(false);

	if (isImageMimeType(mimeType) && !hasImageError) {
		return (
			<img
				alt={alt}
				className={cn(className, imageClassName)}
				onError={() => {
					setHasImageError(true);
				}}
				src={src}
			/>
		);
	}

	const kindLabel = getAssetKindLabel(mimeType, storageKey);
	const FallbackIcon = mimeType?.startsWith("image/") === true ? PhotoIcon : DocumentIcon;

	return (
		<div
			aria-label={alt}
			className={cn(
				"flex items-center justify-center rounded-sm bg-muted text-muted-fg",
				className,
				fallbackClassName,
			)}
			role="img"
		>
			<div className="flex flex-col items-center gap-2">
				<FallbackIcon aria-hidden={true} className="block-8 inline-8 shrink-0" />
				<span
					className={cn(
						"rounded-full border border-border bg-bg px-2 py-0.5 font-medium text-[10px] tracking-wide",
						kindLabelClassName,
					)}
				>
					{kindLabel}
				</span>
			</div>
		</div>
	);
}

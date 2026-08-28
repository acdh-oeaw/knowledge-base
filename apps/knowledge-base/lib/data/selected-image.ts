import type { JSONContent } from "@tiptap/core";

import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { type ImageUrlOptions, images } from "@/lib/images";

/**
 * Columns an edit form needs about the asset behind its image field. The dashboard shows this
 * metadata next to the selection so authors can tell which asset they picked - and what it already
 * says - without opening the assets page.
 */
export const selectedImageColumns = {
	id: true,
	key: true,
	label: true,
	alt: true,
	caption: true,
	licenseId: true,
	mimeType: true,
	size: true,
	width: true,
	height: true,
} as const;

/** Companion to {@link selectedImageColumns}, for labelling the license in the same card. */
export const selectedImageWith = {
	license: {
		columns: {
			code: true,
			name: true,
		},
	},
} as const;

interface SelectedImageRow {
	id: string;
	key: string;
	label: string;
	alt: string | null;
	caption: JSONContent | null;
	licenseId: string | null;
	mimeType: string;
	size: number | null;
	width: number | null;
	height: number | null;
	license?: { code: string; name: string } | null;
}

export function toSelectedImage(
	asset: SelectedImageRow,
	imageUrlOptions: ImageUrlOptions,
): SelectedImage {
	const { url } = images.generateSignedImageUrl({ key: asset.key, options: imageUrlOptions });

	return {
		id: asset.id,
		key: asset.key,
		label: asset.label,
		alt: asset.alt,
		caption: asset.caption,
		license: asset.license ?? null,
		licenseId: asset.licenseId,
		mimeType: asset.mimeType,
		size: asset.size,
		width: asset.width,
		height: asset.height,
		url,
	};
}

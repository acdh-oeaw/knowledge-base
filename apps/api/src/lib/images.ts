import { images } from "@/services/images";

export interface ImageAsset {
	key: string;
	alt: string | null;
	caption: string | null;
	license: { name: string | null; url: string | null } | null;
}

export interface Image {
	url: string;
	alt: string | null;
	caption: string | null;
	license: { name: string; url: string } | null;
}

/**
 * Build an {@link ImageAsset} from a flat row whose license columns were selected as siblings.
 * Useful for query-builder selects, which don't support the nested `license` object that the
 * relational query API produces.
 */
interface FlatImageAsset {
	key: string;
	alt: string | null;
	caption: string | null;
	licenseName: string | null;
	licenseUrl: string | null;
}

export function toImageAsset(image: FlatImageAsset): ImageAsset;
export function toImageAsset(
	image: { key: string | null } & Omit<FlatImageAsset, "key">,
): ImageAsset | null;
export function toImageAsset(
	image: { key: string | null } & Omit<FlatImageAsset, "key">,
): ImageAsset | null {
	if (image.key == null) {
		return null;
	}

	return {
		key: image.key,
		alt: image.alt,
		caption: image.caption,
		license: { name: image.licenseName, url: image.licenseUrl },
	};
}

export function generateImageUrl(image: ImageAsset, width: number): Image;
export function generateImageUrl(image: ImageAsset | null | undefined, width: number): Image | null;
export function generateImageUrl(
	image: ImageAsset | null | undefined,
	width: number,
): Image | null {
	if (image == null) {
		return null;
	}

	const { url } = images.generateSignedImageUrl({ key: image.key, options: { width } });

	const license =
		image.license?.name != null && image.license.url != null
			? { name: image.license.name, url: image.license.url }
			: null;

	return { url, alt: image.alt, caption: image.caption, license };
}

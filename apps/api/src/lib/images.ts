import { type ImageCaptionMode, resolveImageCaption } from "@dariah-eric/database/image-captions";
import type { JSONContent } from "@tiptap/core";

import { getAssetImageUrl } from "@/lib/asset-download";
import { images } from "@/services/images";

/**
 * The columns and relation every relational query must select to build an {@link ImageAsset}.
 *
 * Shared rather than repeated so that a query cannot select a subset by accident. That failure is
 * silent and shaped exactly like the caption one {@link withResolvedCaption} warns about: a query
 * missing `width` still compiles and still returns a plausible image, but the null it reports means
 * "vector, no upper bound" to a consumer, which is precisely the wrong answer for a raster asset
 * and makes it request renditions the source cannot deliver.
 */
export const imageAssetColumns = {
	columns: {
		key: true,
		alt: true,
		caption: true,
		width: true,
		height: true,
	},
	with: {
		license: {
			columns: {
				name: true,
				url: true,
			},
		},
	},
} as const;

export interface ImageAsset {
	key: string;
	alt: string | null;
	caption: JSONContent | null;
	width: number | null;
	height: number | null;
	license: { name: string | null; url: string | null } | null;
}

export interface Image {
	/** The default rendition, at the width the endpoint chose for this placement. */
	url: string;
	/**
	 * Base url of the variant endpoint for this asset, for consumers that size their own images.
	 * Append `?w=` and optionally `&ar=` to get a rendition; see `GetAssetImage` for the supported
	 * values. Absolute and version-bearing, so the route shape stays this api's concern.
	 *
	 * Serves the source as stored when fetched bare, which is what a vector wants — see {@link width}
	 * — and what a consumer without a width to ask for can use directly.
	 */
	srcUrl: string;
	/**
	 * Pixel dimensions of the source, as imgproxy renders it. Null for vectors, which have no raster
	 * resolution and so no width above which a request stops gaining detail.
	 *
	 * A consumer building a `srcset` must not offer candidates wider than this: imgproxy does not
	 * enlarge, so those return the source size while advertising more, and the browser picks them.
	 */
	width: number | null;
	height: number | null;
	alt: string | null;
	caption: JSONContent | null;
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
	caption: JSONContent | null;
	width: number | null;
	height: number | null;
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
		width: image.width,
		height: image.height,
		license: { name: image.licenseName, url: image.licenseUrl },
	};
}

interface FeaturedImageCaption {
	imageCaption: JSONContent | null;
	imageCaptionMode: ImageCaptionMode;
}

/**
 * Applies an entity's caption choice to its featured image: the caption belongs to the asset and is
 * shared by every placement, so an entity either inherits it, replaces it for its own page, or
 * suppresses it. Consumers only ever see the resolved caption, exactly as for image content
 * blocks.
 *
 * **Every serializer of an image whose table carries `image_caption`/`image_caption_mode` must go
 * through here** — `news`, `events`, `funding_calls`, `impact_case_studies`, `opportunities`,
 * `spotlight_articles` and `persons`. A query that selects the asset's `caption` but not those two
 * columns compiles and returns a plausible-looking response that ignores the editor's choice, which
 * is how `/featured-entities` once served asset captions while `/news` served the right ones.
 * Tables without those columns (projects, pages, organisational units, logos) pass their image
 * straight to {@link generateImageUrl}.
 */
export function withResolvedCaption(image: ImageAsset, entity: FeaturedImageCaption): ImageAsset;
export function withResolvedCaption(
	image: ImageAsset | null | undefined,
	entity: FeaturedImageCaption,
): ImageAsset | null;
export function withResolvedCaption(
	image: ImageAsset | null | undefined,
	entity: FeaturedImageCaption,
): ImageAsset | null {
	if (image == null) {
		return null;
	}

	const { caption } = resolveImageCaption({
		assetCaption: image.caption,
		blockCaption: entity.imageCaption,
		captionMode: entity.imageCaptionMode,
	});

	return { ...image, caption };
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

	return {
		url,
		srcUrl: getAssetImageUrl(image.key),
		width: image.width,
		height: image.height,
		alt: image.alt,
		caption: image.caption,
		license,
	};
}

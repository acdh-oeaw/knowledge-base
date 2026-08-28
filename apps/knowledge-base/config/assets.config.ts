import type { ImageUrlOptions } from "@/lib/images";

export const imageMimeTypes = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
	"image/svg+xml",
] as const;

/** File types that may be stored in the `documents` asset collection. */
export const documentMimeTypes = [
	...imageMimeTypes,
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.oasis.opendocument.presentation",
	"application/vnd.oasis.opendocument.spreadsheet",
	"application/vnd.oasis.opendocument.text",
	"text/csv",
	"text/plain",
] as const;

export const mediaLibraryPageSize = 20;

/** Must be less than `serverActions.bodySizeLimit` in `next.config.ts`. */
export const imageSizeLimit = 20 * 1024 * 1024; /** 20 MB */

/**
 * Maximum image resolution (total pixels) we accept. Beyond this, imgproxy refuses to render the
 * source image and the asset would be broken.
 *
 * Must match the `IMGPROXY_MAX_SRC_RESOLUTION` setting (in megapixels) of the imgproxy deployment,
 * whose default is 50.
 *
 * @see {@link https://docs.imgproxy.net/configuration/options#IMGPROXY_MAX_SRC_RESOLUTION}
 */
export const imageMaxResolution = 50 * 1_000_000; /** 50 megapixels */

/**
 * The one rendition the dashboard requests for every image it shows: media library tiles, asset
 * cards, and content-block previews.
 *
 * Deliberately no `enlarge` — the rest of the codebase treats "imgproxy does not enlarge" as an
 * invariant, and `ContentBlocksView` leans on it to draw an image at its natural width. Upscaling
 * here made every source report 600px, so that guard could only ever cap at the column. Tiles that
 * want a filled box are `object-cover` in a fixed frame and fill it through CSS anyway.
 */
export const imageGridOptions: ImageUrlOptions = {
	gravity: { type: "no" },
	resizing_type: "fit",
	width: 600,
};

export const imageAssetWidth = {
	avatar: 400,
	featured: 1600,
	preview: 800,
};

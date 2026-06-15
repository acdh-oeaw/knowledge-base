import type { ImageUrlOptions } from "@/lib/images";

export const imageMimeTypes = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
	"image/svg+xml",
] as const;

export const mediaLibraryPageSize = 20;

/** Must be less than `serverActions.bodySizeLimit` in `next.config.ts`. */
export const imageSizeLimit = 6 * 1024 * 1024; /** 6 MB */

export const imageGridOptions: ImageUrlOptions = {
	enlarge: 1,
	gravity: { type: "no" },
	resizing_type: "fit",
	width: 600,
};

export const imageAssetWidth = {
	avatar: 400,
	featured: 1600,
	preview: 800,
};

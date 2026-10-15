import type { ImageUrlOptions } from "@dariah-eric/images";
import { getCropGravityPoint } from "@dariah-eric/images/crop";

import type { FocalPoint } from "@/lib/images";
import { type ImageVariantAspectRatio, imageVariantAspectRatios } from "~/config/api.config";

/**
 * The imgproxy processing options for one rendition request.
 *
 * Cropping is opt-in. Without a ratio the image is scaled to width and keeps its own shape, which
 * is what a letterboxed slot and a full-size link need; with one, imgproxy does the crop that the
 * consumer would otherwise be asking a browser to do with `object-cover` after downloading the
 * pixels it then throws away.
 *
 * No width at all means no processing options, so imgproxy serves the source as it is stored. That
 * is the only rendition a vector has: imgproxy skips processing for an svg source, so every rung on
 * the ladder returns the same bytes under a different url and a different cache entry. It is also
 * what makes the `srcUrl` this api hands out fetchable on its own, which a consumer needs wherever
 * it has no width to ask for — `next/image` with `unoptimized`, or a "view full size" link.
 *
 * A crop keeps the centre unless the asset has a focal point. That point is the one stored on the
 * asset, never one a caller sends: a caller-chosen point would multiply the renditions per asset by
 * every position it can name, which is exactly what the allowlists exist to prevent.
 *
 * The point is placed the way css `object-position` places it, which is how the website crops every
 * image it draws itself, so that a crop from here — an `og:image` — shows the same part of the
 * picture as the page does. imgproxy centres on its point instead, so it is handed the centre of
 * that frame, which takes the image's shape to work out. An asset whose shape was never measured
 * falls back to centring on the point itself.
 */
export function getImageOptions(params: {
	ar?: ImageVariantAspectRatio;
	focalPoint?: FocalPoint | null;
	imageAspectRatio?: number | null;
	width?: number;
}): ImageUrlOptions {
	const { ar, focalPoint, imageAspectRatio, width } = params;

	if (width == null) {
		return {};
	}

	if (ar == null) {
		return { width };
	}

	const cropAspectRatio = imageVariantAspectRatios[ar];

	return {
		width,
		height: Math.round(width / cropAspectRatio),
		resizing_type: "fill",
		gravity: getGravity({ cropAspectRatio, focalPoint, imageAspectRatio }),
	};
}

function getGravity(params: {
	cropAspectRatio: number;
	focalPoint: FocalPoint | null | undefined;
	imageAspectRatio: number | null | undefined;
}): NonNullable<ImageUrlOptions["gravity"]> {
	const { cropAspectRatio, focalPoint, imageAspectRatio } = params;

	if (focalPoint == null) {
		return { type: "ce" };
	}

	const point =
		imageAspectRatio != null && imageAspectRatio > 0
			? getCropGravityPoint({ cropAspectRatio, focalPoint, imageAspectRatio })
			: focalPoint;

	return { type: "fp", x: point.x, y: point.y };
}

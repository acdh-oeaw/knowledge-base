import { assetPrefixes } from "@dariah-eric/storage/config";
import * as v from "valibot";

import {
	imageVariantAspectRatios,
	imageVariantVersion,
	imageVariantWidths,
} from "~/config/api.config";

/**
 * Storage keys are exactly `prefix/name`, so the route takes the two segments separately rather
 * than one slash-bearing parameter. The prefix is constrained to the known set and the name to
 * key-safe characters, so the path cannot be used to probe the bucket for arbitrary object names.
 */
const KeyParamsSchema = v.object({
	prefix: v.picklist(assetPrefixes),
	name: v.pipe(v.string(), v.regex(/^[\w.-]+$/, "Must be a storage object name.")),
});

export const GetAssetDownload = {
	ParamsSchema: KeyParamsSchema,
};

/**
 * The rendition parameters are closed sets, which is what actually protects imgproxy here.
 *
 * The endpoint is unauthenticated by necessity — its urls end up in `src`/`srcset` attributes that
 * browsers fetch directly, and no header can be attached to those. Rate limiting shapes request
 * volume but cannot cap render cost, because the handler only signs and redirects; the bytes are
 * imgproxy's. Restricting width and aspect ratio to allowlists bounds the number of distinct
 * renditions per asset instead, so a caller hammering the endpoint gets cache hits rather than new
 * work once it has walked the grid.
 *
 * The width is optional, which adds exactly one rendition per asset — the source as stored. That
 * costs nothing the allowlists were guarding: the source's own resolution is capped at upload
 * (`imageMaxResolution`), and its bytes are already served unauthenticated by the sibling
 * `/download` route.
 */
export const GetAssetImage = {
	ParamsSchema: v.object({
		...KeyParamsSchema.entries,
		version: v.literal(imageVariantVersion),
	}),
	QuerySchema: v.pipe(
		v.object({
			w: v.optional(
				v.pipe(
					v.string(),
					v.toNumber(),
					v.picklist(imageVariantWidths as unknown as Array<number>),
					v.description(
						"Rendered width in pixels; must be one of the supported widths. Omit to serve the source as stored, unresized",
					),
				),
			),
			ar: v.optional(
				v.pipe(
					v.picklist(
						Object.keys(imageVariantAspectRatios) as Array<keyof typeof imageVariantAspectRatios>,
					),
					v.description(
						"Aspect ratio to crop to; omit to scale to width without cropping. Requires a width to crop against",
					),
				),
			),
		}),
		/**
		 * A crop needs a target height, and the only thing to derive one from is the width. Refused
		 * rather than ignored: a silently uncropped rendition is indistinguishable from a cropped one
		 * until it is on the page in the wrong shape.
		 */
		v.check(
			(query) => query.ar == null || query.w != null,
			"An aspect ratio needs a width to crop against.",
		),
	),
};

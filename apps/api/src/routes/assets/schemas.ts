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
			/**
			 * Part of the url, never of the rendition: the crop follows the point stored on the asset.
			 * The variant is cached as immutable, so without this a moved point would keep serving the
			 * old crop under the old url; with it, the consumer's url changes along with the point. Still
			 * validated, so the set of urls that reach the handler stays a closed one.
			 */
			fp: v.optional(
				v.pipe(
					v.string(),
					v.regex(
						/^(?:0(?:\.\d{1,2})?|1(?:\.0{1,2})?),(?:0(?:\.\d{1,2})?|1(?:\.0{1,2})?)$/,
						"Must be two fractions between 0 and 1, with at most two decimals, separated by a comma.",
					),
					v.description(
						"The image's `focalPoint` as `x,y`, to give a crop around a moved point a url of its own. The crop always follows the point stored for the asset; this value only keys the cache. Requires an aspect ratio",
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
		/** Refused for the same reason: without a crop there is nothing for the point to steer. */
		v.check(
			(query) => query.fp == null || query.ar != null,
			"A focal point needs an aspect ratio to crop to.",
		),
	),
};

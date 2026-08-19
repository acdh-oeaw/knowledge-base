import { Readable } from "node:stream";

import { assert } from "@acdh-oeaw/lib";
import type { ImageUrlOptions } from "@dariah-eric/images";
import { describeRoute } from "hono-openapi";
import { rateLimiter } from "hono-rate-limiter";

import { getContentDispositionHeader } from "@/lib/asset-download";
import { createRouter } from "@/lib/factory";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validator } from "@/lib/openapi/validator";
import { GetAssetDownload, GetAssetImage } from "@/routes/assets/schemas";
import { getAssetByKey } from "@/routes/assets/service";
import { images } from "@/services/images";
import { type ImageVariantAspectRatio, imageVariantAspectRatios } from "~/config/api.config";
import { assetConfig } from "~/config/rate-limiter.config";

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
 */
function getImageOptions(params: {
	ar?: ImageVariantAspectRatio;
	width?: number;
}): ImageUrlOptions {
	const { ar, width } = params;

	if (width == null) {
		return {};
	}

	if (ar == null) {
		return { width };
	}

	return {
		width,
		height: Math.round(width / imageVariantAspectRatios[ar]),
		resizing_type: "fill",
		gravity: { type: "ce" },
	};
}

/**
 * Serving an asset by its storage key, for the rich-text link targets that reference one (see
 * `link-targets.ts`). Images already have a public url through imgproxy; this is the equivalent for
 * everything else, and the only way a document linked from prose can be reached.
 *
 * Any asset is servable, matching the posture images already have: imgproxy renders any key, and
 * keys are unguessable uuidv7. Restricting to assets referenced from published content was
 * considered and rejected — it would make a link break the moment its page is unpublished, which is
 * surprising, and the reference scan is a substring search over `jsonb` (see
 * `asset-cleanup-service`), far too coarse to gate delivery on.
 */
export const router = createRouter()
	.use(rateLimiter(assetConfig))

	/** GET /api/assets/:prefix/:name/image/:version */
	.get(
		"/:prefix/:name/image/:version",
		describeRoute({
			tags: ["assets"],
			summary: "Redirect to a rendered image variant",
			description:
				"Sign an imgproxy rendition of an image asset and redirect to it, by storage key. Widths and aspect ratios are restricted to the supported sets. Omitting the width serves the source as stored, which is the only rendition a vector image has.",
			operationId: "getAssetImage",
			responses: {
				302: {
					description: "Redirect to the signed imgproxy url for the requested rendition",
				},
				...BAD_REQUEST,
			},
		}),
		validator("param", GetAssetImage.ParamsSchema),
		validator("query", GetAssetImage.QuerySchema),
		(c) => {
			const { prefix, name } = c.req.valid("param");
			const { w: width, ar } = c.req.valid("query");

			const { url } = images.generateSignedImageUrl({
				key: `${prefix}/${name}`,
				options: getImageOptions({ ar, width }),
			});

			/**
			 * A redirect rather than a proxied stream, so the bytes never traverse this process and the
			 * browser's `Accept` header reaches imgproxy directly — which is what lets it negotiate
			 * webp/avif. Cached permanently because storage keys are content-addressed: `uploadAsset`
			 * mints a fresh uuidv7 per upload and nothing rewrites an object in place, so a given key and
			 * rendition always denote the same pixels. The version segment is the escape hatch for the
			 * one thing that can invalidate them (see `imageVariantVersion`).
			 */
			c.header("Cache-Control", "public, max-age=31536000, immutable");

			return c.redirect(url, 302);
		},
	)

	/** GET /api/assets/:prefix/:name/download */
	.get(
		"/:prefix/:name/download",
		describeRoute({
			tags: ["assets"],
			summary: "Download asset file",
			description: "Stream the S3-stored file for an asset, by storage key",
			operationId: "getAssetDownload",
			responses: {
				200: {
					description: "Binary file stream",
					content: {
						"application/pdf": {},
						"application/octet-stream": {},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetAssetDownload.ParamsSchema),
		async (c) => {
			const { prefix, name } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const asset = await getAssetByKey(db, { key: `${prefix}/${name}` });

			if (asset == null) {
				return c.notFound();
			}

			const storage = c.get("storage");
			assert(storage, "Storage must be provided via middleware.");

			const nodeStream = (await storage.download(asset.key)).unwrap();
			const webStream = Readable.toWeb(nodeStream) as ReadableStream;

			return c.body(webStream, 200, {
				"Content-Disposition": getContentDispositionHeader(asset),
				"Content-Type": asset.mimeType,
			});
		},
	);

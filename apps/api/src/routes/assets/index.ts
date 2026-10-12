import { Readable } from "node:stream";

import { assert } from "@acdh-oeaw/lib";
import { rateLimiter } from "hono-rate-limiter";

import { getContentDispositionHeader } from "@/lib/asset-download";
import { createRouter } from "@/lib/factory";
import { describeRoute } from "@/lib/openapi/describe-route";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validator } from "@/lib/openapi/validator";
import { getImageOptions } from "@/routes/assets/image-options";
import { GetAssetDownload, GetAssetImage } from "@/routes/assets/schemas";
import { getAssetByKey, getAssetFocalPoint } from "@/routes/assets/service";
import { images } from "@/services/images";
import { assetConfig } from "~/config/rate-limiter.config";

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
			"x-cache-tags": [],
			responses: {
				302: {
					description: "Redirect to the signed imgproxy url for the requested rendition",
				},
				...BAD_REQUEST,
			},
		}),
		validator("param", GetAssetImage.ParamsSchema),
		validator("query", GetAssetImage.QuerySchema),
		async (c) => {
			const { prefix, name } = c.req.valid("param");
			const { w: width, ar } = c.req.valid("query");
			const key = `${prefix}/${name}`;

			/**
			 * Only a crop has a use for the point, so only a crop pays for the lookup — every `srcset`
			 * rung without a ratio still signs and redirects without touching the database. The `fp` the
			 * caller sent is deliberately not read: it is there to give a moved point a url of its own
			 * (see `GetAssetImage`), and rendering it would let any caller mint a crop per position.
			 */
			let focalPoint = null;

			if (ar != null) {
				const db = c.get("db");
				assert(db, "Database must be provided via middleware.");

				focalPoint = await getAssetFocalPoint(db, { key });
			}

			const { url } = images.generateSignedImageUrl({
				key,
				options: getImageOptions({ ar, focalPoint, width }),
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
			"x-cache-tags": ["assets"],
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

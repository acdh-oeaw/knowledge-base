import type { Readable } from "node:stream";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService, schema } from "@dariah-eric/database";
import { createStorageService } from "@dariah-eric/storage";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";

import { env } from "../config/image-assets/env.config";

/**
 * Re-encodes and clamps existing image assets to imgproxy's source-resolution limit, mirroring what
 * the upload UI now does for new images (see `prepareImageForUpload` in
 * `apps/knowledge-base/lib/data/assets.ts`). Images already migrated from WordPress could exceed
 * the limit, in which case imgproxy silently refuses to render them.
 *
 * Runs as a dry run by default; pass `--apply` to actually overwrite objects and update the
 * database.
 *
 * @example
 * 	pnpm run data:migrate:clamp-image-resolution -- --apply
 */

/**
 * Maximum image resolution (total pixels) imgproxy will render. Must match `imageMaxResolution` in
 * `apps/knowledge-base/config/assets.config.ts` and the `IMGPROXY_MAX_SRC_RESOLUTION` setting (in
 * megapixels) of the imgproxy deployment.
 */
const imageMaxResolution = 50 * 1_000_000;

/** Vector images have no raster resolution, so imgproxy's source-resolution limit does not apply. */
const rasterImageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		user: env.DATABASE_USER,
	},
	logger: false,
}).unwrap();

const storage = createStorageService({
	config: {
		accessKey: env.S3_ACCESS_KEY,
		bucketName: env.S3_BUCKET_NAME,
		endPoint: env.S3_HOST,
		port: env.S3_PORT,
		secretKey: env.S3_SECRET_KEY,
		useSSL: env.S3_PROTOCOL === "https",
	},
});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Array<Buffer> = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
	}
	return Buffer.concat(chunks);
}

function formatMegapixels(pixels: number): string {
	return `${(pixels / 1_000_000).toFixed(1)}MP`;
}

async function run(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info(
		apply
			? "Clamping image assets to the resolution limit (writing changes)..."
			: "Dry run — pass `--apply` to overwrite objects and update the database. No changes will be made.",
	);

	const assets = await db
		.select({
			id: schema.assets.id,
			key: schema.assets.key,
			filename: schema.assets.filename,
			mimeType: schema.assets.mimeType,
		})
		.from(schema.assets)
		.where(inArray(schema.assets.mimeType, rasterImageMimeTypes));

	let clamped = 0;
	let skipped = 0;
	let failed = 0;

	for (const asset of assets) {
		try {
			const original = await streamToBuffer((await storage.download(asset.key)).unwrap());
			const { height, width } = await sharp(original).metadata();
			const resolution = width * height;

			if (!Number.isFinite(resolution) || resolution <= imageMaxResolution) {
				skipped++;
				continue;
			}

			const scale = Math.sqrt(imageMaxResolution / resolution);
			const targetWidth = Math.floor(width * scale);
			const targetHeight = Math.floor(height * scale);
			const resized = await sharp(original)
				/** Bake EXIF orientation into the pixels before we strip metadata during re-encoding. */
				.rotate()
				.resize({ fit: "inside", height: targetHeight, width: targetWidth })
				.toBuffer();

			log.info(
				`${asset.key}: ${String(width)}×${String(height)} (${formatMegapixels(resolution)}, ${String(
					original.byteLength,
				)} bytes) → ${String(targetWidth)}×${String(targetHeight)} (${formatMegapixels(
					targetWidth * targetHeight,
				)}, ${String(resized.byteLength)} bytes)`,
			);

			if (apply) {
				(
					await storage.replace({
						input: resized,
						key: asset.key,
						metadata: { "content-type": asset.mimeType, name: asset.filename ?? asset.key },
						size: resized.byteLength,
					})
				).unwrap();

				await db
					.update(schema.assets)
					.set({ size: resized.byteLength })
					.where(eq(schema.assets.id, asset.id));
			}

			clamped++;
		} catch (error) {
			failed++;
			log.error(`Failed to process "${asset.key}": ${String(error)}`);
		}
	}

	log.info(
		`Done. ${String(clamped)} ${apply ? "clamped" : "would be clamped"}, ${String(
			skipped,
		)} within limit, ${String(failed)} failed (of ${String(assets.length)} raster image assets).`,
	);

	if (failed > 0) {
		process.exitCode = 1;
	}
}

await run();

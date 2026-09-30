import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, isNull, like } from "@dariah-eric/database/sql";
import { createStorageService } from "@dariah-eric/storage";
import {
	buffer,
	getAspectRatio,
	getSvgAspectRatio,
	toDisplayDimensions,
} from "@dariah-eric/storage/lib";

import { env } from "../config/env.config";

/** Backfills `assets.aspect_ratio` for images. Dry-run by default; pass `--apply` to persist. */

const vectorMimeType = "image/svg+xml";

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

async function download(key: string): Promise<Buffer> {
	const stream = (await storage.download(key)).unwrap();
	const chunks: Array<Buffer> = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
	}
	return Buffer.concat(chunks);
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");
	const assets = await db
		.select({
			id: schema.assets.id,
			key: schema.assets.key,
			mimeType: schema.assets.mimeType,
			width: schema.assets.width,
			height: schema.assets.height,
		})
		.from(schema.assets)
		.where(and(isNull(schema.assets.aspectRatio), like(schema.assets.mimeType, "image/%")))
		.orderBy(schema.assets.key);

	let measured = 0;
	for (const asset of assets) {
		let aspectRatio =
			asset.width != null && asset.height != null
				? getAspectRatio(asset.width, asset.height)
				: null;

		try {
			if (aspectRatio == null) {
				const image = await download(asset.key);
				if (asset.mimeType === vectorMimeType) {
					aspectRatio = getSvgAspectRatio(image);
				} else {
					const dimensions = toDisplayDimensions(await buffer.getMetadata(image));
					aspectRatio = getAspectRatio(dimensions.width, dimensions.height);
				}
			}
		} catch (error) {
			log.warn(`Cannot determine aspect ratio for \`${asset.key}\`: ${String(error)}`);
			continue;
		}

		if (aspectRatio == null) {
			log.warn(`No intrinsic aspect ratio found for \`${asset.key}\` (${asset.mimeType}).`);
			continue;
		}

		log.info(`  ${asset.key}: ${String(aspectRatio)}`);
		if (apply) {
			await db.update(schema.assets).set({ aspectRatio }).where(eq(schema.assets.id, asset.id));
		}
		measured += 1;
	}

	log.info(`${apply ? "Updated" : "Would update"} ${String(measured)} image aspect ratios.`);
}

await main();

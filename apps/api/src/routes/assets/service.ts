import * as schema from "@dariah-eric/database/schema";

import type { DownloadableAsset } from "@/lib/asset-download";
import { type FocalPoint, toFocalPoint } from "@/lib/images";
import type { Database, Transaction } from "@/middlewares/db";
import { eq } from "@/services/db/sql";

/** The asset stored under `key`, or `null` when no asset row claims it. */
export async function getAssetByKey(
	db: Database | Transaction,
	params: { key: string },
): Promise<DownloadableAsset | null> {
	const [asset] = await db
		.select({
			key: schema.assets.key,
			label: schema.assets.label,
			filename: schema.assets.filename,
			mimeType: schema.assets.mimeType,
		})
		.from(schema.assets)
		.where(eq(schema.assets.key, params.key))
		.limit(1);

	return asset ?? null;
}

/**
 * What the variant endpoint needs to crop the asset under `key`: its focal point, and its shape,
 * without which the point cannot be placed the way the website places it (see `getImageOptions`).
 * Both `null` when no asset row claims the key — imgproxy then answers for the missing object as it
 * would without a point.
 */
export async function getAssetCropSource(
	db: Database | Transaction,
	params: { key: string },
): Promise<{ aspectRatio: number | null; focalPoint: FocalPoint | null }> {
	const [asset] = await db
		.select({
			aspectRatio: schema.assets.aspectRatio,
			focalPointX: schema.assets.focalPointX,
			focalPointY: schema.assets.focalPointY,
		})
		.from(schema.assets)
		.where(eq(schema.assets.key, params.key))
		.limit(1);

	if (asset == null) {
		return { aspectRatio: null, focalPoint: null };
	}

	return { aspectRatio: asset.aspectRatio, focalPoint: toFocalPoint(asset) };
}

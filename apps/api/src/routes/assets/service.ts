import * as schema from "@dariah-eric/database/schema";

import type { DownloadableAsset } from "@/lib/asset-download";
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

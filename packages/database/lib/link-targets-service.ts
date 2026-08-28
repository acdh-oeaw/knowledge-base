import { inArray } from "drizzle-orm";

import type { Database, Transaction } from "./index";
import * as schema from "./schema";

/** The asset columns a link target needs to become a download: a url, a filename, and a size. */
export interface LinkTargetAsset {
	key: string;
	label: string;
	filename: string | null;
	mimeType: string;
	size: number | null;
}

/**
 * Loads the assets referenced by `asset`-targeted links, keyed by storage key.
 *
 * Deliberately returns rows rather than finished download urls: how an asset is _delivered_ (route,
 * base url, content disposition) is the API's concern, and building it here would drag transport
 * config into the database package. Callers map these onto `ResolvedAssetLinkTarget` and hand the
 * result to `annotateLinkTargets`.
 *
 * A key with no row (asset deleted since the link was authored) is simply absent from the map;
 * annotation leaves those links unresolved rather than inventing a url.
 */
export async function getLinkTargetAssets(
	db: Database | Transaction,
	keys: ReadonlySet<string>,
): Promise<Map<string, LinkTargetAsset>> {
	if (keys.size === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			key: schema.assets.key,
			label: schema.assets.label,
			filename: schema.assets.filename,
			mimeType: schema.assets.mimeType,
			size: schema.assets.size,
		})
		.from(schema.assets)
		.where(inArray(schema.assets.key, [...keys]));

	return new Map(rows.map((row) => [row.key, row]));
}

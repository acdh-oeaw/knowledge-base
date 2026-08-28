import {
	type DeleteUnusedAssetsResult,
	type UnusedAsset,
	deleteUnusedAssets as deleteUnusedAssetsShared,
	findUnusedAssets,
} from "@dariah-eric/database/asset-cleanup-service";

import { db } from "@/lib/db";
import { type ImageUrlOptions, images } from "@/lib/images";
import { storage as s3 } from "@/lib/storage";

export type { DeleteUnusedAssetsResult, UnusedAsset };

export interface UnusedAssetPreview extends UnusedAsset {
	/** Signed URL for a thumbnail, so the asset can be reviewed before deletion. */
	url: string;
}

export interface UnusedAssetsPreviewResult {
	assets: Array<UnusedAssetPreview>;
	totalSize: number;
}

interface GetUnusedAssetsParams {
	imageUrlOptions: ImageUrlOptions;
}

/**
 * Dry run: lists assets which are not referenced by any foreign key or embedded in any rich-text
 * field, so an administrator can review them before pruning. See {@link findUnusedAssets} for how
 * "unused" is determined (conservatively).
 */
export async function getUnusedAssets(
	params: GetUnusedAssetsParams,
): Promise<UnusedAssetsPreviewResult> {
	const { imageUrlOptions } = params;

	const { assets, totalSize } = await findUnusedAssets(db);

	const previews = assets.map((asset): UnusedAssetPreview => {
		const { url } = images.generateSignedImageUrl({ key: asset.key, options: imageUrlOptions });
		return { ...asset, url };
	});

	return { assets: previews, totalSize };
}

/**
 * Prunes the given assets from object storage and the database, delegating to the shared
 * {@link deleteUnusedAssetsShared} implementation (the same one the `@dariah-eric/maintenance` cli
 * uses) so the definition of "unused" and the delete/audit behaviour never diverge.
 */
export async function deleteUnusedAssets(
	ids: Array<string>,
	actorUserId: string | null,
): Promise<DeleteUnusedAssetsResult> {
	return deleteUnusedAssetsShared(db, ids, {
		actorUserId,
		deleteObject: async (key) => {
			(await s3.delete(key)).unwrap();
		},
	});
}

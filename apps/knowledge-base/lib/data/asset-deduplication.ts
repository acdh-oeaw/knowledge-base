import {
	type DuplicateAssetGroup,
	type MergeDuplicateAssetsResult,
	findDuplicateAssets,
	mergeDuplicateAssets as mergeDuplicateAssetsShared,
} from "@dariah-eric/database/asset-deduplication-service";

import { db } from "@/lib/db";
import { type ImageUrlOptions, images } from "@/lib/images";

export type { MergeDuplicateAssetsResult } from "@dariah-eric/database/asset-deduplication-service";

export interface DuplicateAssetPreviewGroup extends DuplicateAssetGroup {
	assets: Array<DuplicateAssetGroup["assets"][number] & { url: string }>;
}

export async function getDuplicateAssetGroups(params: {
	imageUrlOptions: ImageUrlOptions;
	label?: string;
}): Promise<{ groups: Array<DuplicateAssetPreviewGroup>; unhashedImages: number }> {
	const { groups, unhashedImages } = await findDuplicateAssets(db, { label: params.label });
	return {
		groups: groups.map((group) => {
			return {
				...group,
				assets: group.assets.map((asset) => {
					return {
						...asset,
						url: images.generateSignedImageUrl({
							key: asset.key,
							options: params.imageUrlOptions,
						}).url,
					};
				}),
			};
		}),
		unhashedImages,
	};
}

export async function mergeDuplicateAssets(
	canonicalId: string,
	staleIds: Array<string>,
): Promise<MergeDuplicateAssetsResult> {
	return mergeDuplicateAssetsShared(db, canonicalId, staleIds);
}

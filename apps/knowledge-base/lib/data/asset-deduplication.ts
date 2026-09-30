import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import {
	type AssetFingerprint,
	type DuplicateAssetGroup,
	type MergeDuplicateAssetsResult,
	findDuplicateAssets,
	mergeDuplicateAssets as mergeDuplicateAssetsShared,
} from "@dariah-eric/database/asset-deduplication-service";
import sharp from "sharp";

import { db } from "@/lib/db";
import { type ImageUrlOptions, images } from "@/lib/images";
import { storage } from "@/lib/storage";

export type { MergeDuplicateAssetsResult } from "@dariah-eric/database/asset-deduplication-service";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Array<Buffer> = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
	}
	return Buffer.concat(chunks);
}

async function fingerprintAsset(asset: { key: string }): Promise<AssetFingerprint | null> {
	try {
		const stream = (await storage.download(asset.key)).unwrap();
		const buffer = await streamToBuffer(stream);
		const metadata = await sharp(buffer).metadata();
		return {
			sha256: createHash("sha256").update(buffer).digest("hex"),
			width: typeof metadata.width === "number" ? metadata.width : null,
			height: typeof metadata.height === "number" ? metadata.height : null,
		};
	} catch {
		return null;
	}
}

export interface DuplicateAssetPreviewGroup extends DuplicateAssetGroup {
	assets: Array<DuplicateAssetGroup["assets"][number] & { url: string }>;
}

export async function getDuplicateAssetGroups(params: {
	imageUrlOptions: ImageUrlOptions;
	label?: string;
}): Promise<Array<DuplicateAssetPreviewGroup>> {
	const groups = await findDuplicateAssets(db, fingerprintAsset, { label: params.label });
	return groups.map((group) => {
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
	});
}

export async function mergeDuplicateAssets(
	canonicalId: string,
	staleIds: Array<string>,
): Promise<MergeDuplicateAssetsResult> {
	return mergeDuplicateAssetsShared(db, canonicalId, staleIds, fingerprintAsset);
}

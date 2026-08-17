/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

import { isNonEmptyString } from "@acdh-oeaw/lib";
import { relationsFilterToSQL } from "@dariah-eric/database/relations";
import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { eq } from "@/lib/db/sql";
import { type ImageUrlOptions, images } from "@/lib/images";
import { type AssetPrefix, assetPrefixes, storage as s3 } from "@/lib/storage";

export { assetPrefixes };
export type { AssetPrefix };

interface GetAssetsParams {
	imageUrlOptions: ImageUrlOptions;
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getAssets(params: GetAssetsParams) {
	const { imageUrlOptions, limit = 10, offset = 0 } = params;

	const [assets, total] = await Promise.all([
		db.query.assets.findMany({
			columns: {
				key: true,
			},
			limit,
			offset,
			orderBy: {
				updatedAt: "desc",
			},
		}),
		db.$count(schema.assets),
	]);

	const urls = assets.map((asset) => {
		const { url } = images.generateSignedImageUrl({
			key: asset.key,
			options: imageUrlOptions,
		});

		return url;
	});

	return {
		urls,
		total,
	};
}

interface GetMediaLibraryAssetsParams {
	imageUrlOptions: ImageUrlOptions;
	/** @default 20 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	prefix?: AssetPrefix;
	q?: string;
}

export async function getMediaLibraryAssets(params: GetMediaLibraryAssetsParams) {
	const { imageUrlOptions, limit = 20, offset = 0, prefix, q } = params;

	const prefixFilter = prefix != null ? { key: { like: `${prefix}/%` } } : undefined;
	const searchFilter = isNonEmptyString(q)
		? { RAW: unaccentIlike(schema.assets.label, `%${q}%`) }
		: undefined;

	const filter =
		prefixFilter != null || searchFilter != null ? { ...prefixFilter, ...searchFilter } : undefined;

	const sqlFilter = filter != null ? relationsFilterToSQL(schema.assets, filter) : undefined;

	const [assets, total] = await Promise.all([
		db.query.assets.findMany({
			columns: {
				key: true,
				label: true,
				mimeType: true,
			},
			limit,
			offset,
			orderBy: {
				updatedAt: "desc",
			},
			where: filter,
		}),
		db.$count(schema.assets, sqlFilter),
	]);

	const items = assets.map((asset) => {
		const { url } = images.generateSignedImageUrl({
			key: asset.key,
			options: imageUrlOptions,
		});

		return { key: asset.key, label: asset.label, mimeType: asset.mimeType, url };
	});

	return { items, total };
}

interface UploadAssetParams {
	file: File;
	licenseId?: schema.AssetInput["licenseId"];
	prefix: AssetPrefix;
	label?: string;
	caption?: string;
	alt?: string;
}

export async function uploadAsset(params: UploadAssetParams) {
	const { file, licenseId, prefix, label, alt, caption } = params;

	const input = Readable.fromWeb(file.stream() as ReadableStream);
	const size = file.size;
	const metadata = { "content-type": file.type, name: file.name };

	const { key } = (await s3.upload({ input, prefix, metadata, size })).unwrap();

	await db.insert(schema.assets).values({
		key,
		licenseId,
		mimeType: metadata["content-type"],
		filename: file.name,
		size,
		label: label ?? file.name,
		alt,
		caption,
	});

	return {
		key,
	};
}

interface UpdateAssetMetadataParams {
	id: string;
	label: string;
	alt?: string | null;
	caption?: string | null;
	licenseId?: schema.AssetInput["licenseId"] | null;
}

export async function updateAssetMetadata(params: UpdateAssetMetadataParams) {
	const { id, label, alt, caption, licenseId } = params;

	await db
		.update(schema.assets)
		.set({
			label,
			alt,
			caption,
			licenseId,
		})
		.where(eq(schema.assets.id, id));
}

interface GetAssetsForDashboardParams {
	imageUrlOptions: ImageUrlOptions;
	/** @default 24 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	prefix?: AssetPrefix;
	q?: string;
}

export async function getAssetsForDashboard(params: GetAssetsForDashboardParams) {
	const { imageUrlOptions, limit = 24, offset = 0, prefix, q } = params;

	const prefixFilter = prefix != null ? { key: { like: `${prefix}/%` } } : undefined;
	const searchFilter = isNonEmptyString(q)
		? { RAW: unaccentIlike(schema.assets.label, `%${q}%`) }
		: undefined;

	const filter =
		prefixFilter != null || searchFilter != null ? { ...prefixFilter, ...searchFilter } : undefined;

	const sqlFilter = filter != null ? relationsFilterToSQL(schema.assets, filter) : undefined;

	const [assets, total] = await Promise.all([
		db.query.assets.findMany({
			columns: {
				id: true,
				key: true,
				label: true,
				alt: true,
				caption: true,
				licenseId: true,
				mimeType: true,
				size: true,
			},
			limit,
			offset,
			orderBy: {
				updatedAt: "desc",
			},
			where: filter,
		}),
		db.$count(schema.assets, sqlFilter),
	]);

	const items = assets.map((asset) => {
		const { url } = images.generateSignedImageUrl({
			key: asset.key,
			options: imageUrlOptions,
		});

		return {
			id: asset.id,
			key: asset.key,
			label: asset.label,
			alt: asset.alt,
			caption: asset.caption,
			licenseId: asset.licenseId,
			mimeType: asset.mimeType,
			size: asset.size,
			url,
		};
	});

	return { items, total };
}

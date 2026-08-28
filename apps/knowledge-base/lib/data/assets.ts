/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { type Dimensions, toDisplayDimensions } from "@dariah-eric/storage/lib";
import sharp from "sharp";

import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { imageMaxResolution } from "@/config/assets.config";
import {
	selectedImageColumns,
	selectedImageWith,
	toSelectedImage,
} from "@/lib/data/selected-image";
import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { and, count, desc, eq, like } from "@/lib/db/sql";
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

/** Looks up the storage key and download metadata for a single asset, or `null` if it is gone. */
export async function getAssetForDownload(
	id: string,
): Promise<{ key: string; filename: string | null; mimeType: string } | null> {
	const [asset] = await db
		.select({
			key: schema.assets.key,
			filename: schema.assets.filename,
			mimeType: schema.assets.mimeType,
		})
		.from(schema.assets)
		.where(eq(schema.assets.id, id));

	return asset ?? null;
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

	const prefixFilter = prefix != null ? like(schema.assets.key, `${prefix}/%`) : undefined;
	const searchFilter = matchesAllTerms(q, schema.assets.label);
	const where = and(prefixFilter, searchFilter);

	const [assets, aggregate] = await Promise.all([
		db
			.select({
				id: schema.assets.id,
				key: schema.assets.key,
				label: schema.assets.label,
				alt: schema.assets.alt,
				caption: schema.assets.caption,
				licenseId: schema.assets.licenseId,
				mimeType: schema.assets.mimeType,
				size: schema.assets.size,
				width: schema.assets.width,
				height: schema.assets.height,
			})
			.from(schema.assets)
			.where(where)
			.orderBy(desc(schema.assets.updatedAt))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.assets).where(where),
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
			width: asset.width,
			height: asset.height,
			url,
		};
	});

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

interface GetAssetByKeyParams {
	imageUrlOptions: ImageUrlOptions;
	key: string;
}

/**
 * Looks up one asset by its storage key, in the shape the dashboard's asset cards render. Editors
 * reach for this where a placement stores only the key - richtext image and media_text blocks keep
 * the key in the document, not a copy of the asset's metadata, so the card reads the asset itself
 * and never shows a stale label or caption.
 */
export async function getAssetByKey(params: GetAssetByKeyParams): Promise<SelectedImage | null> {
	const { imageUrlOptions, key } = params;

	const asset = await db.query.assets.findFirst({
		where: { key },
		columns: selectedImageColumns,
		with: selectedImageWith,
	});

	return asset != null ? toSelectedImage(asset, imageUrlOptions) : null;
}

/** Vector images have no raster resolution, so imgproxy's source-resolution limit does not apply. */
const vectorMimeType = "image/svg+xml";

/**
 * Ensures the uploaded image stays within imgproxy's source-resolution limit (see
 * {@link imageMaxResolution}). Images above the limit are downscaled with sharp — imgproxy only
 * ever serves much smaller derived variants, so the extra pixels carry no deliverable value and
 * would only break rendering. Images within the limit keep their original bytes untouched.
 *
 * Also reports the dimensions the image will be _displayed_ at, which `assets` records so consumers
 * can size a responsive `srcset` against the source's real resolution. Null when there is nothing
 * meaningful to record: vectors have no raster resolution, and sharp cannot measure every file it
 * accepts.
 */
async function prepareImageForUpload(
	file: File,
): Promise<{ input: Readable | Buffer; size: number; dimensions: Dimensions | null }> {
	if (file.type === vectorMimeType) {
		return {
			input: Readable.fromWeb(file.stream() as ReadableStream),
			size: file.size,
			dimensions: null,
		};
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const { height, orientation, width } = await sharp(buffer).metadata();
	const resolution = width * height;

	/**
	 * `Number.isFinite` guards against images sharp cannot measure (guarding against `NaN`
	 * dimensions).
	 */
	if (!Number.isFinite(resolution)) {
		return { input: buffer, size: buffer.byteLength, dimensions: null };
	}

	if (resolution <= imageMaxResolution) {
		return {
			input: buffer,
			size: buffer.byteLength,
			dimensions: toDisplayDimensions({ width, height, orientation }),
		};
	}

	const scale = Math.sqrt(imageMaxResolution / resolution);
	const resized = await sharp(buffer)
		/** Bake EXIF orientation into the pixels before we strip metadata during re-encoding. */
		.rotate()
		.resize({ fit: "inside", height: Math.floor(height * scale), width: Math.floor(width * scale) })
		.toBuffer();

	/**
	 * Measured rather than computed from `scale`: `.rotate()` has baked in the orientation by now,
	 * and `fit: "inside"` rounds to preserve the aspect ratio, so the buffer is the only thing that
	 * knows what it actually ended up as.
	 */
	const resizedMetadata = await sharp(resized).metadata();

	return {
		input: resized,
		size: resized.byteLength,
		dimensions: { width: resizedMetadata.width, height: resizedMetadata.height },
	};
}

interface UploadAssetParams {
	file: File;
	licenseId?: schema.AssetInput["licenseId"];
	prefix: AssetPrefix;
	label?: string;
	caption?: schema.AssetInput["caption"];
	alt?: string;
}

export async function uploadAsset(params: UploadAssetParams) {
	const { file, licenseId, prefix, label, alt, caption } = params;

	const { input, size, dimensions } = file.type.startsWith("image/")
		? await prepareImageForUpload(file)
		: {
				input: Readable.fromWeb(file.stream() as ReadableStream),
				size: file.size,
				dimensions: null,
			};
	const metadata = { "content-type": file.type, name: file.name };

	const { key } = (await s3.upload({ input, prefix, metadata, size })).unwrap();

	const [asset] = await db
		.insert(schema.assets)
		.values({
			key,
			licenseId,
			mimeType: metadata["content-type"],
			filename: file.name,
			size,
			width: dimensions?.width,
			height: dimensions?.height,
			label: label ?? file.name,
			alt,
			caption,
		})
		.returning({ id: schema.assets.id });
	assert(asset);

	return {
		id: asset.id,
		key,
	};
}

interface UpdateAssetMetadataParams {
	id: string;
	label: string;
	alt?: string | null;
	caption?: schema.AssetInput["caption"];
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

	const prefixFilter = prefix != null ? like(schema.assets.key, `${prefix}/%`) : undefined;
	const searchFilter = matchesAllTerms(q, schema.assets.label);
	const where = and(prefixFilter, searchFilter);

	const [assets, aggregate] = await Promise.all([
		db
			.select({
				id: schema.assets.id,
				key: schema.assets.key,
				label: schema.assets.label,
				alt: schema.assets.alt,
				caption: schema.assets.caption,
				licenseId: schema.assets.licenseId,
				mimeType: schema.assets.mimeType,
				size: schema.assets.size,
				width: schema.assets.width,
				height: schema.assets.height,
			})
			.from(schema.assets)
			.where(where)
			.orderBy(desc(schema.assets.updatedAt))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.assets).where(where),
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
			width: asset.width,
			height: asset.height,
			url,
		};
	});

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

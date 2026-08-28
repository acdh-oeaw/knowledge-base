import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type UnusedAsset,
	deleteUnusedAssets,
	findUnusedAssets,
} from "@dariah-eric/database/asset-cleanup-service";
import { createStorageService } from "@dariah-eric/storage";

import { env } from "../config/env.config";

/**
 * Lists assets that are not referenced anywhere (no foreign key and not embedded in any rich-text
 * field) so they can be pruned. Dry run by default; pass `--apply` to delete the rows and their
 * storage objects, and `--backup` to download each object to the local cache before deleting it.
 *
 * Detection and deletion are the exact same shared implementation the admin dashboard's Maintenance
 * page uses (`@dariah-eric/database/asset-cleanup-service`), so the two never diverge.
 *
 * @example
 * 	pnpm run data:clean:unused-assets
 * 	pnpm run data:clean:unused-assets -- --apply
 * 	pnpm run data:clean:unused-assets -- --apply --backup
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "unused-assets.tsv");
const backupFolderPath = path.join(cacheFolderPath, "unused-assets");

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

function toTsvCell(value: number | string | null): string {
	if (value == null) {
		return "";
	}
	return String(value).replaceAll("\t", " ").replaceAll(/\r?\n/g, " ");
}

async function writeReport(assets: Array<UnusedAsset>): Promise<void> {
	const columns = ["id", "key", "label", "mime_type", "size"] as const;
	const rows = assets.map((asset) =>
		[asset.id, asset.key, asset.label, asset.mimeType, asset.size]
			.map((value) => toTsvCell(value))
			.join("\t"),
	);

	await fs.mkdir(cacheFolderPath, { recursive: true });
	await fs.writeFile(
		reportFilePath,
		`${columns.join("\t")}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`,
		{ encoding: "utf-8" },
	);
}

async function backupAsset(asset: UnusedAsset): Promise<void> {
	const filePath = path.resolve(backupFolderPath, asset.key);
	const relativeFilePath = path.relative(backupFolderPath, filePath);

	if (relativeFilePath.startsWith("..") || path.isAbsolute(relativeFilePath)) {
		throw new Error(`Cannot back up asset with unsafe key: "${asset.key}"`);
	}

	await fs.mkdir(path.dirname(filePath), { recursive: true });

	const temporaryFilePath = `${filePath}.tmp-${String(process.pid)}`;
	try {
		const input = (await storage.download(asset.key)).unwrap();
		await pipeline(input, createWriteStream(temporaryFilePath));
		await fs.rename(temporaryFilePath, filePath);
	} catch (error) {
		await fs.rm(temporaryFilePath, { force: true });
		throw error;
	}
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");
	const backup = process.argv.includes("--backup");

	if (backup && !apply) {
		throw new Error("`--backup` requires `--apply`.");
	}

	log.info(
		apply
			? `Finding and removing unused assets${backup ? ` (backing up to ${backupFolderPath})` : ""}...`
			: "Finding unused assets (dry run; pass `--apply` to remove them)...",
	);

	const { assets, totalSize } = await findUnusedAssets(db);

	await writeReport(assets);

	log.success(
		`Found ${String(assets.length)} unused asset(s), ${String(totalSize)} bytes. Report: ${reportFilePath}`,
	);

	if (!apply) {
		return;
	}

	const result = await deleteUnusedAssets(
		db,
		assets.map((asset) => asset.id),
		{
			deleteObject: async (key) => {
				(await storage.delete(key)).unwrap();
			},
			onBeforeDelete: backup ? backupAsset : undefined,
		},
	);

	log.info(
		`Done. Removed ${String(result.deletedCount)} asset(s), reclaimed ${String(result.reclaimedSize)} bytes; ${String(result.failedIds.length)} failed, ${String(result.skippedIds.length)} skipped.`,
	);

	if (result.failedIds.length > 0) {
		process.exitCode = 1;
	}
}

try {
	await main();
} catch (error) {
	log.error(error);
	process.exitCode = 1;
} finally {
	await db.$client.end().catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	});
}

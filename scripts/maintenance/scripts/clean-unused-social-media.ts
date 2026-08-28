import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type UnusedSocialMedia,
	deleteUnusedSocialMedia,
	findUnusedSocialMedia,
} from "@dariah-eric/database/social-media-cleanup-service";

import { env } from "../config/env.config";

/**
 * Lists social-media entries that are not referenced by any project, organisational unit, service,
 * or report. Dry run by default; pass `--apply` to delete them.
 *
 * Detection and deletion are the exact same shared implementation the admin dashboard's Maintenance
 * page uses (`@dariah-eric/database/social-media-cleanup-service`), so the two never diverge.
 *
 * @example
 * 	pnpm run data:clean:unused-social-media
 * 	pnpm run data:clean:unused-social-media -- --apply
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "unused-social-media.tsv");

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

function toTsvCell(value: string): string {
	return value.replaceAll("\t", " ").replaceAll(/\r?\n/g, " ");
}

async function writeReport(items: Array<UnusedSocialMedia>): Promise<void> {
	const columns = ["id", "type", "name", "url"] as const;
	const rows = items.map((item) =>
		[item.id, item.type, item.name, item.url].map((value) => toTsvCell(value)).join("\t"),
	);

	await fs.mkdir(cacheFolderPath, { recursive: true });
	await fs.writeFile(
		reportFilePath,
		`${columns.join("\t")}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`,
		{ encoding: "utf-8" },
	);
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info(
		apply
			? "Finding and removing unused social-media entries..."
			: "Finding unused social-media entries (dry run; pass `--apply` to remove them)...",
	);

	const { items, total } = await findUnusedSocialMedia(db);
	await writeReport(items);

	log.success(
		`Found ${String(total)} unused social-media entry/entries. Report: ${reportFilePath}`,
	);

	if (!apply || total === 0) {
		return;
	}

	const result = await deleteUnusedSocialMedia(
		db,
		items.map((item) => item.id),
	);

	log.info(
		`Removed ${String(result.deletedCount)} entry/entries; ${String(result.skippedIds.length)} skipped (no longer unused).`,
	);
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

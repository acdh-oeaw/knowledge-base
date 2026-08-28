import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type EmptyContentBlock,
	deleteEmptyContentBlocks,
	findEmptyContentBlocks,
} from "@dariah-eric/database/content-block-cleanup-service";

import { env } from "../config/env.config";

/**
 * Removes semantically empty `rich_text` content blocks (empty paragraphs, stray hard breaks,
 * whitespace). Accordion items are intentionally ignored. Dry run by default; pass `--apply` to
 * delete them.
 *
 * Detection and deletion are the exact same shared implementation the admin dashboard's Maintenance
 * page uses (`@dariah-eric/database/content-block-cleanup-service`), so the two never diverge.
 *
 * @example
 * 	pnpm run data:clean:empty-content-blocks
 * 	pnpm run data:clean:empty-content-blocks -- --apply
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "empty-content-blocks.tsv");

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

function toTsvCell(value: number | string | null): string {
	if (value == null) {
		return "";
	}
	return String(value).replaceAll("\t", " ").replaceAll(/\r?\n/g, " ");
}

async function writeReport(blocks: Array<EmptyContentBlock>): Promise<void> {
	const columns = [
		"entity_type",
		"entity_id",
		"title",
		"status",
		"field",
		"position",
		"content_block_id",
	] as const;
	const rows = blocks.map((block) =>
		[
			block.entityType,
			block.entityId,
			(block.entityLabel ?? block.entitySlug).replaceAll(/\s+/g, " ").trim(),
			block.status,
			block.fieldName,
			block.position,
			block.contentBlockId,
		]
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

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info(
		apply ? "Removing empty content blocks..." : "Finding empty content blocks (dry run)...",
	);

	const { blocks, total } = await findEmptyContentBlocks(db);
	await writeReport(blocks);

	const affectedEntities = new Set(blocks.map((block) => block.entityId)).size;

	log.success(
		`Found ${String(total)} empty rich_text block(s) across ${String(affectedEntities)} entity/entities. Report: ${reportFilePath}`,
	);

	if (!apply || total === 0) {
		return;
	}

	const result = await deleteEmptyContentBlocks(
		db,
		blocks.map((block) => block.contentBlockId),
	);

	log.info(
		`Removed ${String(result.deletedCount)} block(s); ${String(result.skippedIds.length)} skipped (no longer empty).`,
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

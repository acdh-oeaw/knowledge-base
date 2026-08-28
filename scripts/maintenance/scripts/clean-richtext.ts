import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type RichTextCleanupBlock,
	cleanRichText,
	findRichTextNeedingCleanup,
} from "@dariah-eric/database/richtext-cleanup-service";

import { env } from "../config/env.config";

/**
 * Normalises rich-text content (`rich_text` blocks and `accordion` items): drops empty spacer
 * paragraphs, stray `<br>`/whitespace and `&nbsp;`, strips imported HTML attributes and bold marks
 * on headings. Dry run by default; pass `--apply` to rewrite them.
 *
 * Detection and rewriting are the exact same shared implementation the admin dashboard's
 * Maintenance page uses (`@dariah-eric/database/richtext-cleanup-service`), so the two never
 * diverge.
 *
 * @example
 * 	pnpm run data:clean:richtext
 * 	pnpm run data:clean:richtext -- --apply
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "richtext-cleanup.tsv");

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

async function writeReport(blocks: Array<RichTextCleanupBlock>): Promise<void> {
	const columns = [
		"entity_type",
		"entity_id",
		"title",
		"status",
		"field",
		"block_type",
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
			block.blockType,
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
		apply ? "Normalising rich-text content..." : "Finding rich-text to normalise (dry run)...",
	);

	const { blocks, total } = await findRichTextNeedingCleanup(db);
	await writeReport(blocks);

	const affectedEntities = new Set(blocks.map((block) => block.entityId)).size;

	log.success(
		`Found ${String(total)} content block(s) to normalise across ${String(affectedEntities)} entity/entities. Report: ${reportFilePath}`,
	);

	if (!apply || total === 0) {
		return;
	}

	const result = await cleanRichText(
		db,
		blocks.map((block) => block.contentBlockId),
	);

	log.info(
		`Normalised ${String(result.cleanedCount)} block(s); ${String(result.skippedIds.length)} skipped (no longer changed).`,
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

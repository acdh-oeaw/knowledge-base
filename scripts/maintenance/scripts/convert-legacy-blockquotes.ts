import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { eq, sql } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";
import { convertLegacyBlockquotes } from "../lib/legacy-blockquotes";

/**
 * Converts WordPress-era `blockquote`s whose attribution was typed in as prose into `quoteBlock`
 * nodes with a structured byline (#958). See `lib/legacy-blockquotes` for the two shapes that are
 * recognised; every other blockquote is left as it is and reported.
 *
 * Dry run by default, writing a TSV report to `.cache/legacy-blockquotes.tsv`; pass `--apply` to
 * rewrite the blocks. Every version is converted, draft and published alike (see
 * `lib/entity-versions` for why), and each block is converted again at write time, so a block
 * edited since the report is converted as it is now. Re-running is a no-op.
 *
 * @example
 * 	pnpm run data:convert:legacy-blockquotes
 * 	pnpm run data:convert:legacy-blockquotes -- --apply
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "legacy-blockquotes.tsv");

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

/** `rich_text` blocks holding a blockquote, with the entity and version they belong to. */
async function findBlocks() {
	return db
		.select({
			blockId: schema.richTextContentBlocks.id,
			content: schema.richTextContentBlocks.content,
			entityType: schema.entityTypes.type,
			// Slugs belong to a locale's version here; a version without one is listed by its id.
			slug: sql<string>`COALESCE(${schema.slugs.value}, ${schema.entityVersions.id}::text)`,
			status: schema.entityStatus.type,
		})
		.from(schema.richTextContentBlocks)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.id, schema.richTextContentBlocks.id))
		.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.fields.entityVersionId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.leftJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.where(sql`${schema.richTextContentBlocks.content}::text LIKE '%"blockquote"%'`)
		.orderBy(schema.entityTypes.type, schema.slugs.value, schema.entityStatus.type);
}

function toTsvCell(value: string): string {
	return value.replaceAll("\t", " ").replaceAll(/\r?\n/g, " / ");
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info(apply ? "Converting legacy blockquotes..." : "Finding legacy blockquotes (dry run)...");

	const blocks = await findBlocks();

	const columns = [
		"entity_type",
		"slug",
		"status",
		"content_block_id",
		"action",
		"pattern_or_reason",
		"author",
		"description",
		"quote",
	];
	const rows: Array<Array<string>> = [];
	const changed: Array<string> = [];
	let conversionCount = 0;
	let skipCount = 0;

	for (const block of blocks) {
		const result = convertLegacyBlockquotes(block.content);
		const location = [block.entityType, block.slug, block.status, block.blockId];

		for (const conversion of result.conversions) {
			rows.push([
				...location,
				"convert",
				conversion.pattern,
				conversion.author,
				conversion.description,
				conversion.quote,
			]);
		}
		for (const skip of result.skipped) {
			rows.push([...location, "skip", skip.reason, "", "", skip.quote]);
		}

		conversionCount += result.conversions.length;
		skipCount += result.skipped.length;
		if (result.conversions.length > 0) {
			changed.push(block.blockId);
		}
	}

	await fs.mkdir(cacheFolderPath, { recursive: true });
	await fs.writeFile(
		reportFilePath,
		`${columns.join("\t")}\n${rows.map((row) => row.map((cell) => toTsvCell(cell)).join("\t")).join("\n")}${rows.length > 0 ? "\n" : ""}`,
		{ encoding: "utf-8" },
	);

	log.success(
		`Found ${String(conversionCount)} convertible blockquote(s) in ${String(changed.length)} block(s), and ${String(skipCount)} left as they are. Report: ${reportFilePath}`,
	);

	if (!apply || changed.length === 0) {
		return;
	}

	let written = 0;

	await db.transaction(async (tx) => {
		for (const blockId of changed) {
			// Converted again from the row as it is now, not from the report: an author may have edited
			// the block in between, and a block converted since converts to itself.
			const [row] = await tx
				.select({ content: schema.richTextContentBlocks.content })
				.from(schema.richTextContentBlocks)
				.where(eq(schema.richTextContentBlocks.id, blockId))
				.for("update");

			if (row == null) {
				continue;
			}

			const result = convertLegacyBlockquotes(row.content);
			if (result.conversions.length === 0) {
				continue;
			}

			await tx
				.update(schema.richTextContentBlocks)
				.set({ content: result.content, updatedAt: new Date() })
				.where(eq(schema.richTextContentBlocks.id, blockId));
			written++;
		}
	});

	log.success(`Converted blockquotes in ${String(written)} block(s).`);
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

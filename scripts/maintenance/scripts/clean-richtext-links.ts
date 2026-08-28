import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type RichTextLinkCleanupFinding,
	cleanRichTextLinks,
	findRichTextLinksNeedingCleanup,
} from "@dariah-eric/database/richtext-link-cleanup-service";

import { env } from "../config/env.config";

/**
 * Finds legacy WordPress links in rich-text content and rewrites deterministic matches to canonical
 * website routes. Dry run by default; pass `--apply` to rewrite only findings marked `rewrite`.
 * Findings marked `review` are reported but never changed automatically.
 *
 * @example
 * 	pnpm run data:clean:richtext-links
 * 	pnpm run data:clean:richtext-links -- --apply
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "richtext-link-cleanup.tsv");
const rewriteReportFilePath = path.join(cacheFolderPath, "richtext-link-rewrites.tsv");
const reviewReportFilePath = path.join(cacheFolderPath, "richtext-link-review.tsv");

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

async function writeReport(
	filePath: string,
	findings: Array<RichTextLinkCleanupFinding>,
): Promise<void> {
	const columns = [
		"entity_type",
		"entity_id",
		"title",
		"status",
		"field",
		"block_type",
		"position",
		"content_block_id",
		"action",
		"reason",
		"location",
		"old_href",
		"new_href",
	] as const;
	const rows = findings.map((finding) =>
		[
			finding.entityType,
			finding.entityId,
			(finding.entityLabel ?? finding.entitySlug).replaceAll(/\s+/g, " ").trim(),
			finding.status,
			finding.fieldName,
			finding.blockType,
			finding.position,
			finding.contentBlockId,
			finding.action,
			finding.reason,
			finding.location,
			finding.originalHref,
			finding.replacementHref,
		]
			.map((value) => toTsvCell(value))
			.join("\t"),
	);

	await fs.mkdir(cacheFolderPath, { recursive: true });
	await fs.writeFile(
		filePath,
		`${columns.join("\t")}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`,
		{ encoding: "utf-8" },
	);
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info(
		apply
			? "Rewriting deterministic legacy rich-text links..."
			: "Finding legacy rich-text links (dry run)...",
	);

	const result = await findRichTextLinksNeedingCleanup(db);
	await writeReport(reportFilePath, result.findings);
	await writeReport(
		rewriteReportFilePath,
		result.findings.filter((finding) => finding.action === "rewrite"),
	);
	await writeReport(
		reviewReportFilePath,
		result.findings.filter((finding) => finding.action === "review"),
	);

	const affectedEntities = new Set(result.findings.map((finding) => finding.entityId)).size;
	const rewriteBlockIds = [
		...new Set(
			result.findings
				.filter((finding) => finding.action === "rewrite")
				.map((finding) => finding.contentBlockId),
		),
	];

	log.success(
		`Found ${String(result.total)} rich-text link finding(s) across ${String(
			affectedEntities,
		)} entity/entities: ${String(result.rewriteTotal)} rewrite(s), ${String(
			result.reviewTotal,
		)} review item(s). Reports: ${reportFilePath}, ${rewriteReportFilePath}, ${reviewReportFilePath}`,
	);

	if (!apply || rewriteBlockIds.length === 0) {
		return;
	}

	const cleanup = await cleanRichTextLinks(db, rewriteBlockIds);

	log.info(
		`Rewrote ${String(cleanup.rewriteTotal)} link(s) in ${String(
			cleanup.cleanedCount,
		)} block(s); ${String(cleanup.skippedIds.length)} skipped (no longer changed).`,
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

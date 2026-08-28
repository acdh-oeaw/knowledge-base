import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type HeadingHierarchyFinding,
	checkHeadingHierarchy,
} from "@dariah-eric/database/integrity-service";

import { env } from "../config/env.config";

/**
 * Checks that the headings in rich-text content form a proper outline: every field opens at a
 * level-2 heading (the page title is the only level-1), levels are not skipped on the way down (a
 * level-2 may be followed by a level-3, but not straight by a level-4), and no heading falls
 * outside the editor's level-2 to level-4 range.
 *
 * The check logic lives in `@dariah-eric/database/integrity-service`, shared with the admin
 * dashboard's maintenance page. Read-only; findings are printed and written to a tsv report. Exits
 * with a non-zero exit code when findings exist, so the script can run in ci or a cron job.
 *
 * @example
 * 	pnpm run data:audit:heading-hierarchy
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "heading-hierarchy-findings.tsv");

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

async function writeReport(findings: Array<HeadingHierarchyFinding>): Promise<void> {
	const columns = [
		"kind",
		"entity_type",
		"entity_slug",
		"entity_label",
		"field_name",
		"status",
		"block_type",
		"content_block_id",
		"level",
		"previous_level",
		"heading_text",
		"detail",
	] as const;
	const rows = findings.map((finding) =>
		[
			finding.kind,
			finding.entityType,
			finding.entitySlug,
			finding.entityLabel ?? finding.entitySlug,
			finding.fieldName,
			finding.status,
			finding.blockType,
			finding.contentBlockId,
			String(finding.level),
			finding.previousLevel != null ? String(finding.previousLevel) : "",
			finding.headingText,
			finding.detail,
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
	log.info("Checking rich-text heading hierarchy...");

	const { findings, errors } = await checkHeadingHierarchy(db);

	for (const error of errors) {
		log.error(error);
	}

	for (const finding of findings) {
		log.warn(`[${finding.kind}] ${finding.entityLabel ?? finding.entitySlug}: ${finding.detail}`);
	}

	await writeReport(findings);

	if (findings.length === 0 && errors.length === 0) {
		log.success("No heading-hierarchy integrity issues found.");
		return;
	}

	log.warn(
		`Found ${String(findings.length)} heading-hierarchy issue(s), ${String(errors.length)} error(s). Report: ${reportFilePath}`,
	);
	process.exitCode = 1;
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

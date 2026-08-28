import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type MutuallyExclusiveUnitRelationFinding,
	checkMutuallyExclusiveUnitRelations,
	mutuallyExclusiveUnitRelationRules,
} from "@dariah-eric/database/integrity-service";

import { env } from "../config/env.config";

/**
 * Checks pairs of unit-to-unit relations which must never be recorded on the same unit for the same
 * period: either because one already implies the other (a national coordinating institution is by
 * definition a partner institution of DARIAH-EU, so the partner relation is redundant), or because
 * the two statuses contradict each other (an institution is either a cooperating partner or a full
 * partner/coordinating/representative institution, never both). Flags units whose relations overlap
 * in time; separate periods (a former partner institution that later became a coordinating
 * institution) are valid history.
 *
 * The rules and check logic live in `@dariah-eric/database/integrity-service`, shared with the
 * admin dashboard's maintenance page. Read-only; findings are printed and written to a tsv report.
 * Exits with a non-zero exit code when findings exist, so the script can run in ci or a cron job.
 *
 * @example
 * 	pnpm run data:audit:mutually-exclusive-relations
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "mutually-exclusive-relations-findings.tsv");

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

function formatOverlaps(finding: MutuallyExclusiveUnitRelationFinding): string {
	return finding.overlaps
		.map((overlap) => `${overlap.start.slice(0, 10)} – ${overlap.end?.slice(0, 10) ?? "ongoing"}`)
		.join("; ");
}

async function writeReport(findings: Array<MutuallyExclusiveUnitRelationFinding>): Promise<void> {
	const columns = [
		"rule",
		"kind",
		"unit_document_id",
		"unit_slug",
		"unit_label",
		"unit_type",
		"relation_a",
		"relation_b",
		"overlapping_periods",
		"detail",
	] as const;
	const rows = findings.map((finding) =>
		[
			finding.rule,
			finding.kind,
			finding.unitDocumentId,
			finding.unitSlug,
			finding.unitLabel,
			finding.unitType,
			finding.aLabel,
			finding.bLabel,
			formatOverlaps(finding),
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
	log.info(
		`Checking ${String(mutuallyExclusiveUnitRelationRules.length)} mutually-exclusive-relation rule(s)...`,
	);

	const { findings, errors } = await checkMutuallyExclusiveUnitRelations(db);

	for (const error of errors) {
		log.error(error);
	}

	for (const finding of findings) {
		log.warn(
			`[${finding.rule}] ${finding.unitLabel}: ${finding.detail} (${formatOverlaps(finding)})`,
		);
	}

	await writeReport(findings);

	if (findings.length === 0 && errors.length === 0) {
		log.success("No mutually-exclusive-relation integrity issues found.");
		return;
	}

	log.warn(
		`Found ${String(findings.length)} mutually-exclusive-relation issue(s), ${String(errors.length)} rule error(s). Report: ${reportFilePath}`,
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

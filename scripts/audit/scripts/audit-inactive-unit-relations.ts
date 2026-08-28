import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type InactiveUnitRelationFinding,
	checkInactiveUnitRelations,
	inactiveUnitRelationRules,
} from "@dariah-eric/database/integrity-service";

import { env } from "../config/env.config";

/**
 * Checks organisational units that are no longer active but still have open person relations, e.g.
 * a working group whose `is_part_of` relation to an ERIC has ended, but whose chair/vice-chair/
 * member/contact relations have no end date. Flags each still-open person relation.
 *
 * The rules and check logic live in `@dariah-eric/database/integrity-service`, shared with the
 * admin dashboard's maintenance page. Read-only; findings are printed and written to a tsv report.
 * Exits with a non-zero exit code when findings exist, so the script can run in ci or a cron job.
 *
 * @example
 * 	pnpm run data:audit:inactive-unit-relations
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "inactive-unit-relations-findings.tsv");

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

async function writeReport(findings: Array<InactiveUnitRelationFinding>): Promise<void> {
	const columns = [
		"rule",
		"unit_document_id",
		"unit_slug",
		"unit_label",
		"unit_type",
		"unit_end",
		"person_document_id",
		"person_slug",
		"person_label",
		"role_type",
		"person_relation_start",
		"person_relation_end",
		"detail",
	] as const;
	const rows = findings.map((finding) =>
		[
			finding.rule,
			finding.unitDocumentId,
			finding.unitSlug,
			finding.unitLabel,
			finding.unitType,
			finding.unitEnd,
			finding.personDocumentId,
			finding.personSlug,
			finding.personLabel,
			finding.roleType,
			finding.personRelationStart,
			finding.personRelationEnd ?? "",
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
		`Checking ${String(inactiveUnitRelationRules.length)} inactive-unit-relation rule(s)...`,
	);

	const { findings, errors } = await checkInactiveUnitRelations(db);

	for (const error of errors) {
		log.error(error);
	}

	for (const finding of findings) {
		log.warn(`[${finding.rule}] ${finding.personLabel} @ ${finding.unitLabel}: ${finding.detail}`);
	}

	await writeReport(findings);

	if (findings.length === 0 && errors.length === 0) {
		log.success("No inactive-unit-relation integrity issues found.");
		return;
	}

	log.warn(
		`Found ${String(findings.length)} inactive-unit-relation issue(s), ${String(errors.length)} rule error(s). Report: ${reportFilePath}`,
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

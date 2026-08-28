import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type PairedRelationFinding,
	type RelationSide,
	checkPairedRelations,
	pairedRelationRules,
} from "@dariah-eric/database/integrity-service";

import { env } from "../config/env.config";

/**
 * Checks pairs of person-to-organisational-unit relations which must always be entered together
 * because they record the same fact from two angles, e.g. a person who is a country's national
 * representative (or deputy) must also be a member of the General Assembly for the same period.
 * Neither side is derived from the other, so each rule is checked in both directions; flags persons
 * where only one side was entered, or where the durations of the two sides don't match.
 *
 * The rules and check logic live in `@dariah-eric/database/integrity-service`, shared with the
 * admin dashboard's maintenance page. Read-only; findings are printed and written to a tsv report.
 * Exits with a non-zero exit code when findings exist, so the script can run in ci or a cron job.
 *
 * @example
 * 	pnpm run data:audit:paired-relations
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "paired-relations-findings.tsv");

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

function formatSide(side: RelationSide): string {
	const intervals = side.intervals
		.map((interval) => `${interval.start} – ${interval.end ?? "ongoing"}`)
		.join("; ");
	return `${side.label}: [${intervals || "—"}]`;
}

function toTsvCell(value: string): string {
	return value.replaceAll("\t", " ").replaceAll(/\r?\n/g, " ");
}

async function writeReport(findings: Array<PairedRelationFinding>): Promise<void> {
	const columns = [
		"rule",
		"kind",
		"person_document_id",
		"person_slug",
		"person_label",
		"detail",
		"periods",
	] as const;
	const rows = findings.map((finding) =>
		[
			finding.rule,
			finding.kind,
			finding.personDocumentId,
			finding.personSlug,
			finding.personLabel,
			finding.detail,
			finding.sides.map((side) => formatSide(side)).join(" | "),
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
	log.info(`Checking ${String(pairedRelationRules.length)} paired-relation rule(s)...`);

	const { findings, errors } = await checkPairedRelations(db);

	for (const error of errors) {
		log.error(error);
	}

	for (const finding of findings) {
		log.warn(
			`[${finding.rule}] [${finding.kind}] ${finding.personLabel}: ${finding.detail}` +
				` ${finding.sides.map((side) => formatSide(side)).join(" ")}`,
		);
	}

	await writeReport(findings);

	if (findings.length === 0 && errors.length === 0) {
		log.success("No paired-relation integrity issues found.");
		return;
	}

	log.warn(
		`Found ${String(findings.length)} paired-relation issue(s), ${String(errors.length)} rule error(s). Report: ${reportFilePath}`,
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

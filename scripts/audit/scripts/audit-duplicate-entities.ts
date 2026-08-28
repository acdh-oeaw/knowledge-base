import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type DuplicateCandidateFinding,
	checkDuplicateEntities,
	defaultMinimumDuplicateScore,
} from "@dariah-eric/database/integrity-service";

import { env } from "../config/env.config";

/**
 * Lists persons, organisational units and projects which look like they were entered twice — the
 * same person with two email addresses, an institution imported once by a migration and once by
 * hand, two projects whose names differ by a typo.
 *
 * Unlike the other audit scripts this one reports _candidates_, not violations: every finding is a
 * heuristic guess and needs a human to confirm it before the two documents are merged. Findings are
 * scored by how many signals (shared orcid/ror, shared email, shared link, identical or similar
 * name, shared acronym) point at the same pair; `--min-score` trades recall against noise.
 *
 * The signals and scoring live in `@dariah-eric/database/integrity-service`, shared with the admin
 * dashboard. Read-only; findings are printed and written to a tsv report. Exits with a non-zero
 * exit code when findings exist, so the script can run in ci or a cron job.
 *
 * @example
 * 	pnpm run data:audit:duplicate-entities
 * 	pnpm run data:audit:duplicate-entities -- --min-score 1
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "duplicate-entities-findings.tsv");

/** The score a pair must reach to be reported; `--min-score` trades recall against noise. */
function getMinimumScore(): number {
	const { values } = parseArgs({ options: { "min-score": { type: "string" } } });
	const value = values["min-score"];

	if (value == null) {
		return defaultMinimumDuplicateScore;
	}

	const minimumScore = Number(value);

	if (Number.isNaN(minimumScore)) {
		throw new Error(`Invalid --min-score: "${value}" is not a number.`);
	}

	return minimumScore;
}

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

async function writeReport(findings: Array<DuplicateCandidateFinding>): Promise<void> {
	const columns = [
		"entity_type",
		"score",
		"signals",
		"a_document_id",
		"a_slug",
		"a_name",
		"a_subtype",
		"b_document_id",
		"b_slug",
		"b_name",
		"b_subtype",
		"detail",
	] as const;
	const rows = findings.map((finding) =>
		[
			finding.type,
			finding.score.toFixed(2),
			finding.signals.map((signal) => signal.kind).join(","),
			finding.a.documentId,
			finding.a.slug,
			finding.a.name,
			finding.a.subtype ?? "",
			finding.b.documentId,
			finding.b.slug,
			finding.b.name,
			finding.b.subtype ?? "",
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
	const minimumScore = getMinimumScore();

	log.info(
		`Looking for duplicate persons, organisational units and projects (min score ${String(minimumScore)})...`,
	);

	const { findings, errors } = await checkDuplicateEntities(db, minimumScore);

	for (const error of errors) {
		log.error(error);
	}

	for (const finding of findings) {
		log.warn(
			`[${finding.type}] "${finding.a.name}" (${finding.a.slug}) and "${finding.b.name}" ` +
				`(${finding.b.slug}) may be duplicates — score ${finding.score.toFixed(2)}: ${finding.detail}`,
		);
	}

	await writeReport(findings);

	if (errors.length > 0) {
		process.exitCode = 1;
	}

	if (findings.length === 0) {
		log.success("No duplicate candidates found.");
		return;
	}

	const counts = new Map<string, number>();

	for (const finding of findings) {
		counts.set(finding.type, (counts.get(finding.type) ?? 0) + 1);
	}

	const summary = [...counts].map(([type, count]) => `${String(count)} ${type}`).join(", ");

	log.warn(
		`Found ${String(findings.length)} duplicate candidate pair(s) (${summary}). ` +
			`Each needs review before merging. Report: ${reportFilePath}`,
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

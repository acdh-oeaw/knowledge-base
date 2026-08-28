import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import { type WebAddressFinding, checkWebAddresses } from "@dariah-eric/database/integrity-service";

import { env } from "../config/env.config";

/**
 * Checks that stored web addresses are well-formed: every URL-bearing column (event and opportunity
 * websites, document/policy links, license URLs, social-media links, person social media, embed
 * blocks, and working-group report events) should hold a valid `https` URL — a plain `http` URL is
 * flagged as insecure, and a value with no scheme or one that does not parse is flagged as invalid.
 * A social-media entry may instead be an email address.
 *
 * The check logic lives in `@dariah-eric/database/integrity-service`, shared with the admin
 * dashboard's maintenance page. Read-only; findings are printed and written to a tsv report. Exits
 * with a non-zero exit code when findings exist, so the script can run in ci or a cron job.
 *
 * @example
 * 	pnpm run data:audit:web-addresses
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "web-address-findings.tsv");

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

async function writeReport(findings: Array<WebAddressFinding>): Promise<void> {
	const columns = [
		"kind",
		"source",
		"source_label",
		"record_label",
		"entity_type",
		"entity_slug",
		"status",
		"social_media_id",
		"working_group_report_id",
		"value",
		"detail",
	] as const;
	const rows = findings.map((finding) =>
		[
			finding.kind,
			finding.source,
			finding.sourceLabel,
			finding.recordLabel,
			finding.entityType ?? "",
			finding.entitySlug ?? "",
			finding.status ?? "",
			finding.socialMediaId ?? "",
			finding.workingGroupReportId ?? "",
			finding.value,
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
	log.info("Checking web addresses...");

	const { findings, errors } = await checkWebAddresses(db);

	for (const error of errors) {
		log.error(error);
	}

	for (const finding of findings) {
		log.warn(
			`[${finding.kind}] ${finding.sourceLabel} · ${finding.recordLabel}: ${finding.detail}`,
		);
	}

	await writeReport(findings);

	if (findings.length === 0 && errors.length === 0) {
		log.success("No web-address integrity issues found.");
		return;
	}

	log.warn(
		`Found ${String(findings.length)} web-address issue(s), ${String(errors.length)} error(s). Report: ${reportFilePath}`,
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

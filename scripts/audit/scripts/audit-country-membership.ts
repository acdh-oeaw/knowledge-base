import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type CountryMembershipFinding,
	checkCountryMembership,
	countryMembershipRules,
} from "@dariah-eric/database/integrity-service";

import { env } from "../config/env.config";

/**
 * Checks that an institution's status with DARIAH-EU matches the country it is located in: a
 * partner, national coordinating, or national representative institution must sit in a country
 * which is a member or observer of DARIAH-EU for the whole period it holds that status, while a
 * cooperating partner must sit in one which is neither.
 *
 * The rules and check logic live in `@dariah-eric/database/integrity-service`, shared with the
 * admin dashboard's maintenance page. Read-only; findings are printed and written to a tsv report.
 * Exits with a non-zero exit code when findings exist, so the script can run in ci or a cron job.
 *
 * @example
 * 	pnpm run data:audit:country-membership
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "country-membership-findings.tsv");

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

function formatPeriods(finding: CountryMembershipFinding): string {
	return finding.periods
		.map((period) => `${period.start.slice(0, 10)} – ${period.end?.slice(0, 10) ?? "ongoing"}`)
		.join("; ");
}

async function writeReport(findings: Array<CountryMembershipFinding>): Promise<void> {
	const columns = [
		"rule",
		"kind",
		"unit_document_id",
		"unit_slug",
		"unit_label",
		"unit_type",
		"country_document_id",
		"country_slug",
		"country_label",
		"institution_status",
		"country_status",
		"affected_periods",
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
			finding.countryDocumentId,
			finding.countrySlug,
			finding.countryLabel,
			finding.triggerLabel,
			finding.countryRelationLabel,
			formatPeriods(finding),
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
	log.info(`Checking ${String(countryMembershipRules.length)} country-membership rule(s)...`);

	const { findings, errors } = await checkCountryMembership(db);

	for (const error of errors) {
		log.error(error);
	}

	for (const finding of findings) {
		log.warn(
			`[${finding.rule}] ${finding.unitLabel}: ${finding.detail} (${formatPeriods(finding)})`,
		);
	}

	await writeReport(findings);

	if (findings.length === 0 && errors.length === 0) {
		log.success("No country-membership integrity issues found.");
		return;
	}

	log.warn(
		`Found ${String(findings.length)} country-membership issue(s), ${String(errors.length)} rule error(s). Report: ${reportFilePath}`,
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

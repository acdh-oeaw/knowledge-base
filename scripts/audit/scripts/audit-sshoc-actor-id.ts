import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import {
	type DuplicateSshocMarketplaceActorIdFinding,
	checkDuplicateSshocMarketplaceActorIds,
} from "@dariah-eric/database/integrity-service";

import { env } from "../config/env.config";

/**
 * Lists SSHOC marketplace actor ids claimed by more than one organisational unit document. The
 * actor id maps a unit onto a single marketplace actor and the sshoc services ingest keys
 * owner/provider service relations off it, so a duplicate makes that mapping ambiguous and
 * mis-attributes relations. It is a manually entered admin field, so a collision means two
 * documents were given the same id by hand — the admin forms now reject this, and this audit
 * catches any that predate the guard.
 *
 * The check lives in `@dariah-eric/database/integrity-service`, shared with the admin dashboard.
 * Read-only; findings are printed and written to a tsv report. Exits with a non-zero exit code when
 * findings exist, so the script can run in ci or a cron job.
 *
 * @example
 * 	pnpm run data:audit:sshoc-actor-id
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "sshoc-actor-id-findings.tsv");

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

async function writeReport(
	findings: Array<DuplicateSshocMarketplaceActorIdFinding>,
): Promise<void> {
	const columns = [
		"sshoc_marketplace_actor_id",
		"unit_count",
		"unit_document_id",
		"unit_slug",
		"unit_label",
		"unit_type",
	] as const;
	// One row per claiming unit, so the report is sortable/greppable per document.
	const rows = findings.flatMap((finding) =>
		finding.units.map((unit) =>
			[
				String(finding.sshocMarketplaceActorId),
				String(finding.units.length),
				unit.documentId,
				unit.slug,
				unit.label ?? "",
				unit.type,
			]
				.map((value) => toTsvCell(value))
				.join("\t"),
		),
	);

	await fs.mkdir(cacheFolderPath, { recursive: true });
	await fs.writeFile(
		reportFilePath,
		`${columns.join("\t")}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`,
		{ encoding: "utf-8" },
	);
}

async function main(): Promise<void> {
	log.info("Checking for SSHOC marketplace actor ids claimed by more than one unit...");

	const { findings, errors } = await checkDuplicateSshocMarketplaceActorIds(db);

	for (const error of errors) {
		log.error(error);
	}

	for (const finding of findings) {
		const units = finding.units
			.map((unit) => `"${unit.label ?? unit.slug}" (${unit.slug})`)
			.join(", ");
		log.warn(
			`Actor id ${String(finding.sshocMarketplaceActorId)} is claimed by ` +
				`${String(finding.units.length)} units: ${units}`,
		);
	}

	await writeReport(findings);

	if (findings.length === 0 && errors.length === 0) {
		log.success("No duplicate SSHOC marketplace actor ids found.");
		return;
	}

	log.warn(
		`Found ${String(findings.length)} duplicated actor id(s), ${String(errors.length)} error(s). ` +
			`Report: ${reportFilePath}`,
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

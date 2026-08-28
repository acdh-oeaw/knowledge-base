import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { eq } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";
import { canonicalOrcidUrl, canonicalRorUrl } from "../lib/matching";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Normalises `persons.orcid` and `organisational_units.ror` to canonical urls
 * (`https://orcid.org/…`, `https://ror.org/…`). Both fields accept freetext, so an editor may enter
 * a bare id or a url; the details pages already render either form, and this rewrites the stored
 * value so the data is uniform. Dry run by default; pass `--apply` to write.
 *
 * A value that holds no recognisable id is left untouched and listed in the report as
 * `unrecognised` for a human to look at — the script never guesses. Values are matched per version
 * row, so a document's draft and published copies are both corrected.
 *
 * @example
 * 	pnpm run data:normalise:identifier-urls
 * 	pnpm run data:normalise:identifier-urls -- --apply
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "identifier-urls.tsv");

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

type Action = "normalise" | "unrecognised";

interface Finding {
	entityType: "organisational_unit" | "person";
	id: string;
	label: string;
	field: "orcid" | "ror";
	action: Action;
	currentValue: string;
	normalisedValue: string;
}

/**
 * Classifies one stored value. Returns `null` when nothing needs doing: the field is empty, or it
 * is already the canonical url. Otherwise it is either rewritten (`normalise`) or flagged for
 * review (`unrecognised`).
 */
function classify(
	current: string | null,
	canonicalise: (value: string | null | undefined) => string | null,
): { action: Action; normalisedValue: string } | null {
	if (current == null || current.trim().length === 0) {
		return null;
	}

	const canonical = canonicalise(current);

	if (canonical == null) {
		return { action: "unrecognised", normalisedValue: "" };
	}

	if (canonical === current) {
		return null;
	}

	return { action: "normalise", normalisedValue: canonical };
}

async function collectFindings(): Promise<Array<Finding>> {
	const findings: Array<Finding> = [];

	const persons = await db
		.select({ id: schema.persons.id, name: schema.persons.name, orcid: schema.persons.orcid })
		.from(schema.persons);

	for (const person of persons) {
		const outcome = classify(person.orcid, canonicalOrcidUrl);
		if (outcome != null) {
			findings.push({
				entityType: "person",
				id: person.id,
				label: person.name,
				field: "orcid",
				action: outcome.action,
				currentValue: person.orcid ?? "",
				normalisedValue: outcome.normalisedValue,
			});
		}
	}

	const units = await db
		.select({
			id: schema.organisationalUnits.id,
			name: schema.organisationalUnits.name,
			ror: schema.organisationalUnits.ror,
		})
		.from(schema.organisationalUnits);

	for (const unit of units) {
		const outcome = classify(unit.ror, canonicalRorUrl);
		if (outcome != null) {
			findings.push({
				entityType: "organisational_unit",
				id: unit.id,
				label: unit.name,
				field: "ror",
				action: outcome.action,
				currentValue: unit.ror ?? "",
				normalisedValue: outcome.normalisedValue,
			});
		}
	}

	return findings;
}

async function writeReport(findings: Array<Finding>): Promise<void> {
	const columns = [
		"entity_type",
		"entity_id",
		"label",
		"field",
		"action",
		"current_value",
		"normalised_value",
	] as const;

	const rows = findings.map((finding) => [
		finding.entityType,
		finding.id,
		finding.label,
		finding.field,
		finding.action,
		finding.currentValue,
		finding.normalisedValue,
	]);

	await writeTsvReport(reportFilePath, columns, rows);
}

async function applyNormalisations(findings: Array<Finding>): Promise<number> {
	let applied = 0;

	await db.transaction(async (tx) => {
		for (const finding of findings) {
			if (finding.action !== "normalise") {
				continue;
			}

			if (finding.field === "orcid") {
				await tx
					.update(schema.persons)
					.set({ orcid: finding.normalisedValue })
					.where(eq(schema.persons.id, finding.id));
			} else {
				await tx
					.update(schema.organisationalUnits)
					.set({ ror: finding.normalisedValue })
					.where(eq(schema.organisationalUnits.id, finding.id));
			}

			applied += 1;
		}
	});

	return applied;
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info(
		apply
			? "Normalising ORCID and ROR values to canonical urls..."
			: "Finding ORCID and ROR values to normalise (dry run)...",
	);

	const findings = await collectFindings();
	await writeReport(findings);

	const toNormalise = findings.filter((finding) => finding.action === "normalise");
	const unrecognised = findings.filter((finding) => finding.action === "unrecognised");

	log.success(
		`${String(toNormalise.length)} value(s) to normalise, ${String(unrecognised.length)} unrecognised. Report: ${reportFilePath}`,
	);

	if (!apply || toNormalise.length === 0) {
		return;
	}

	const applied = await applyNormalisations(toNormalise);

	log.info(`Normalised ${String(applied)} value(s).`);
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

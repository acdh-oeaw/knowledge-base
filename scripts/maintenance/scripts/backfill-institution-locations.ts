import * as path from "node:path";

import { assert, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, isNotNull, ne } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";
import { canonicalCountry } from "../lib/matching";
import { createRorClient, getRorLocation } from "../lib/ror";
import { readTsvReport, writeTsvReport } from "../lib/tsv-report";

/**
 * Proposes `is_located_in` relations for institutions that already carry a ROR, by reading the
 * country off that ROR record. Dry run by default; `--apply` writes the confident matches,
 * `--from-file` writes a reviewed report.
 *
 * Only institutions with a ROR and no `is_located_in` relation at all are candidates: a ROR is a
 * globally unique identifier, so its primary location is authoritative for the institution it
 * names, unlike the affiliation-matcher guesses `backfill-institution-rors` has to gate on name and
 * country. An institution with some location history but none current is left alone — whether that
 * gap is intentional is a judgement call, not something this script should paper over.
 *
 * @example
 * 	pnpm run data:backfill:institution-locations
 * 	pnpm run data:backfill:institution-locations -- --limit=50
 * 	pnpm run data:backfill:institution-locations -- --apply
 * 	pnpm run data:backfill:institution-locations -- --apply --from-file=.cache/institution-locations.tsv
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "institution-locations.tsv");

/** Same ROR rate-limit reasoning as `backfill-institution-rors`. */
const defaultDelayMs = 250;

/**
 * `resolved` means ROR's primary location's country matches one of our `country` units once
 * reconciled through the same alias table the ROR backfill uses. `unmapped` is for review only: ROR
 * named a country, but not one we can currently identify — an omission in `countryAliases`, or a
 * country DARIAH does not carry as a unit.
 */
type MatchConfidence = "resolved" | "unmapped";

interface CandidateUnit {
	documentId: string;
	name: string;
	acronym: string | null;
	ror: string;
}

interface CandidateCountry {
	documentId: string;
	name: string;
}

interface ProposedLocation {
	unit: CandidateUnit;
	countryDocumentId: string | null;
	countryName: string | null;
	rorCountry: string | null;
	rorCity: string | null;
	confidence: MatchConfidence;
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

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/** Document ids of units that already have some `is_located_in` relation, current or past. */
async function findLocatedUnitDocumentIds(): Promise<Set<string>> {
	const rows = await db
		.selectDistinct({ documentId: schema.organisationalUnitsRelations.unitDocumentId })
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitsRelations.status, schema.organisationalUnitStatus.id),
		)
		.where(eq(schema.organisationalUnitStatus.status, "is_located_in"));

	return new Set(rows.map((row) => row.documentId));
}

/** Published institutions with a ROR and no location relation yet, keyed by document id. */
async function findCandidateUnits(): Promise<Array<CandidateUnit>> {
	const located = await findLocatedUnitDocumentIds();

	const units = await db
		.selectDistinct({
			documentId: schema.entityVersions.entityId,
			name: schema.organisationalUnits.name,
			acronym: schema.organisationalUnits.acronym,
			ror: schema.organisationalUnits.ror,
		})
		.from(schema.organisationalUnits)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.where(
			and(
				isNotNull(schema.organisationalUnits.ror),
				ne(schema.organisationalUnits.ror, ""),
				eq(schema.entityStatus.type, "published"),
				eq(schema.organisationalUnitTypes.type, "institution"),
			),
		);

	return units
		.filter((unit) => unit.ror != null && !located.has(unit.documentId))
		.map((unit) => {
			return { ...unit, ror: unit.ror! };
		});
}

/** Published `country` units, the only type `is_located_in` may point an institution at. */
async function findCountries(): Promise<Array<CandidateCountry>> {
	return db
		.selectDistinct({
			documentId: schema.entityVersions.entityId,
			name: schema.organisationalUnits.name,
		})
		.from(schema.organisationalUnits)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.where(
			and(
				eq(schema.entityStatus.type, "published"),
				eq(schema.organisationalUnitTypes.type, "country"),
			),
		);
}

async function proposeLocations(
	units: Array<CandidateUnit>,
	countries: Array<CandidateCountry>,
	delayMs: number,
): Promise<{ matches: Array<ProposedLocation>; unmatched: Array<CandidateUnit> }> {
	assert(env.ROR_API_BASE_URL, "Missing environment variable: `ROR_API_BASE_URL`.");

	const ror = createRorClient({ baseUrl: env.ROR_API_BASE_URL });
	const countriesByCanonicalName = new Map(
		countries.map((country) => [canonicalCountry(country.name), country] as const),
	);

	const matches: Array<ProposedLocation> = [];
	const unmatched: Array<CandidateUnit> = [];

	for (const [index, unit] of units.entries()) {
		if (index > 0) {
			await delay(delayMs);
		}

		if (index > 0 && index % 100 === 0) {
			log.info(`… ${String(index)}/${String(units.length)}`);
		}

		const organization = await ror.getOrganization(unit.ror);
		const location = organization == null ? null : getRorLocation(organization);

		if (location?.country == null) {
			unmatched.push(unit);
			continue;
		}

		const country = countriesByCanonicalName.get(canonicalCountry(location.country));

		matches.push({
			unit,
			countryDocumentId: country?.documentId ?? null,
			countryName: country?.name ?? null,
			rorCountry: location.country,
			rorCity: location.city,
			confidence: country != null ? "resolved" : "unmapped",
		});
	}

	return { matches, unmatched };
}

function selectAutoAppliable(matches: Array<ProposedLocation>): Array<ProposedLocation> {
	return matches.filter((match) => match.confidence === "resolved");
}

/**
 * Creates the `is_located_in` relation for each proposal. The start date is unknown — ROR reports
 * only where an institution currently sits, not since when — so, like the WordPress and UNR
 * migrations before it, this uses 1900-01-01 as the "since always" placeholder rather than
 * asserting a start date it does not have.
 */
async function applyMatches(matches: Array<ProposedLocation>): Promise<number> {
	const locatedInStatusId = await db
		.select({ id: schema.organisationalUnitStatus.id })
		.from(schema.organisationalUnitStatus)
		.where(eq(schema.organisationalUnitStatus.status, "is_located_in"))
		.then((rows) => rows[0]!.id);

	const placeholderStart = new Date(Date.UTC(1900, 0, 1));

	let applied = 0;

	for (const match of matches) {
		if (match.countryDocumentId == null) {
			continue;
		}

		const countryDocumentId = match.countryDocumentId;

		await db.transaction(async (tx) => {
			/** Re-checked in the transaction, so a location added since the report is not duplicated. */
			const taken = await tx
				.select({ id: schema.organisationalUnitsRelations.id })
				.from(schema.organisationalUnitsRelations)
				.where(
					and(
						eq(schema.organisationalUnitsRelations.unitDocumentId, match.unit.documentId),
						eq(schema.organisationalUnitsRelations.status, locatedInStatusId),
					),
				)
				.limit(1);

			if (taken.length > 0) {
				log.warn(`Skipping ${match.unit.name}: already has a location.`);
				return;
			}

			await tx.insert(schema.organisationalUnitsRelations).values({
				unitDocumentId: match.unit.documentId,
				relatedUnitDocumentId: countryDocumentId,
				status: locatedInStatusId,
				duration: { start: placeholderStart },
			});

			applied += 1;
		});
	}

	return applied;
}

const reportColumns = [
	"confidence",
	"unit_document_id",
	"unit_name",
	"unit_acronym",
	"unit_ror",
	"ror_country",
	"ror_city",
	"country_document_id",
	"country_name",
] as const;

async function writeReport(
	matches: Array<ProposedLocation>,
	unmatched: Array<CandidateUnit>,
): Promise<void> {
	const order: Record<MatchConfidence, number> = { resolved: 0, unmapped: 1 };

	const rows = [
		...matches
			.toSorted((a, b) => order[a.confidence] - order[b.confidence])
			.map((match) => [
				match.confidence,
				match.unit.documentId,
				match.unit.name,
				match.unit.acronym ?? "",
				match.unit.ror,
				match.rorCountry ?? "",
				match.rorCity ?? "",
				match.countryDocumentId ?? "",
				match.countryName ?? "",
			]),
		...unmatched.map((unit) => [
			"none",
			unit.documentId,
			unit.name,
			unit.acronym ?? "",
			unit.ror,
			"",
			"",
			"",
			"",
		]),
	];

	await writeTsvReport(reportFilePath, reportColumns, rows);
}

/**
 * Reads back a reviewed report. Only `unit_document_id` and `country_document_id` are used, so a
 * reviewer fixes a pairing by correcting the country and rejects one by clearing it.
 */
async function readReviewedMatches(
	filePath: string,
	units: Array<CandidateUnit>,
	countries: Array<CandidateCountry>,
): Promise<Array<ProposedLocation>> {
	const records = await readTsvReport(filePath, ["unit_document_id"]);
	const unitsByDocumentId = new Map(units.map((unit) => [unit.documentId, unit]));
	const countriesByDocumentId = new Map(countries.map((country) => [country.documentId, country]));

	return records.flatMap((record) => {
		const unit = unitsByDocumentId.get(record.unit_document_id ?? "");
		const country = countriesByDocumentId.get(record.country_document_id ?? "");

		if (country == null) {
			return [];
		}

		/**
		 * A row whose unit is no longer a candidate is skipped rather than force-applied: it means the
		 * location was filled in, or the unit unpublished, since the report was written.
		 */
		if (unit == null) {
			log.warn(`Skipping reviewed row for \`${record.unit_document_id ?? ""}\`: not a candidate.`);
			return [];
		}

		return [
			{
				unit,
				countryDocumentId: country.documentId,
				countryName: country.name,
				rorCountry: record.ror_country ?? null,
				rorCity: record.ror_city ?? null,
				confidence: "resolved" as const,
			},
		];
	});
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");
	const fromFile = process.argv
		.find((argument) => argument.startsWith("--from-file="))
		?.slice("--from-file=".length);
	const limit = Number(
		process.argv.find((argument) => argument.startsWith("--limit="))?.slice("--limit=".length),
	);
	const delayMs =
		Number(
			process.argv
				.find((argument) => argument.startsWith("--delay-ms="))
				?.slice("--delay-ms=".length),
		) || defaultDelayMs;

	const [units, countries] = await Promise.all([findCandidateUnits(), findCountries()]);

	if (fromFile != null) {
		const reviewed = await readReviewedMatches(fromFile, units, countries);

		if (!apply) {
			log.info(`${String(reviewed.length)} reviewed matches. Pass \`--apply\` to write them.`);
			return;
		}

		const applied = await applyMatches(reviewed);
		log.success(`Assigned ${String(applied)} locations from \`${fromFile}\`.`);
		return;
	}

	const selected = Number.isInteger(limit) && limit > 0 ? units.slice(0, limit) : units;

	log.info(
		`${String(selected.length)} institutions with a ROR but no location (of ${String(units.length)}), ${String(delayMs)}ms between requests.`,
	);

	const { matches, unmatched } = await proposeLocations(selected, countries, delayMs);

	await writeReport(matches, unmatched);

	const autoAppliable = selectAutoAppliable(matches);

	const counts = new Map<MatchConfidence, number>();
	for (const match of matches) {
		counts.set(match.confidence, (counts.get(match.confidence) ?? 0) + 1);
	}

	log.info(
		[
			`resolved: ${String(counts.get("resolved") ?? 0)}`,
			`unmapped: ${String(counts.get("unmapped") ?? 0)}`,
			`none: ${String(unmatched.length)}`,
		].join(", "),
	);
	log.info(`Report written to \`${reportFilePath}\`.`);

	if (!apply) {
		log.info(
			`${String(autoAppliable.length)} matches would be applied. Pass \`--apply\` to write them, or review the report and re-run with \`--apply --from-file=${reportFilePath}\`.`,
		);
		return;
	}

	const applied = await applyMatches(autoAppliable);
	log.success(`Assigned ${String(applied)} locations.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());

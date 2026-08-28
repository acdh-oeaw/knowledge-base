import * as path from "node:path";

import { assert, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { alias, and, eq, inArray, isNull, ne, or } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";
import { canonicalCountry, normalise, toRorId, toRorUrl } from "../lib/matching";
import { createRorClient, getRorDisplayName, getRorLocation, getRorNames } from "../lib/ror";
import { readTsvReport, writeTsvReport } from "../lib/tsv-report";

/**
 * Proposes `organisational_units.ror` values for institutions from ROR's affiliation matcher. Dry
 * run by default; `--apply` writes the confident matches, `--from-file` writes a reviewed report.
 *
 * Institutions only. National consortia, countries, working groups and governance bodies are
 * deliberately out of scope: they are consortia, projects and administrative bodies rather than
 * research organisations, so ROR mostly does not list them — of the 25 national consortia, exactly
 * one resolves, which is faster to enter by hand than to script.
 *
 * @example
 * 	pnpm run data:backfill:institution-rors
 * 	pnpm run data:backfill:institution-rors -- --limit=50
 * 	pnpm run data:backfill:institution-rors -- --apply
 * 	pnpm run data:backfill:institution-rors -- --apply --from-file=.cache/institution-rors.tsv
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "institution-rors.tsv");

/**
 * ROR asks for roughly 2000 requests per 5 minutes. This stays comfortably under that on its own,
 * and the client retries a 429 with an exponential backoff if a shared address is already close to
 * the limit.
 */
const defaultDelayMs = 250;

/**
 * `exact` means ROR's chosen record carries a name or alias identical to ours once normalised, and
 * sits in the country we have the institution located in. Everything else is for a human.
 *
 * The two gates catch different failures, and only together do they cover both:
 *
 * - The **name** gate catches a _parent_ organisation standing in for a specific unit. Measured
 *   against the 47 institutions that already had a ROR, the matcher alone chose correctly 34 times,
 *   wrongly twice and declined 11; both errors were of this kind ("NOVA University of Lisbon" →
 *   University of Lisbon). They come back tagged exactly like correct answers (`SINGLE SEARCH`,
 *   score 1), and share a country with the right answer, so only the name separates them.
 * - The **country** gate catches a generic local name colliding with a real alias elsewhere. Our
 *   "National and University Library" (Croatia) matches an English alias of Strasbourg's BNU
 *   exactly, and ROR offers no competing exact match to flag the ambiguity — but the countries
 *   disagree.
 */
type MatchConfidence = "exact" | "country_mismatch" | "loose";

interface CandidateUnit {
	documentId: string;
	name: string;
	acronym: string | null;
	/** From the `is_located_in` relation; absent for ~15% of institutions. */
	country: string | null;
}

interface ProposedMatch {
	unit: CandidateUnit;
	rorId: string;
	rorName: string | null;
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

/** Published institutions without a ROR yet, keyed by document id so all versions can be updated. */
async function findCandidateUnits(): Promise<Array<CandidateUnit>> {
	const units = await db
		.selectDistinct({
			documentId: schema.entityVersions.entityId,
			name: schema.organisationalUnits.name,
			acronym: schema.organisationalUnits.acronym,
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
				or(isNull(schema.organisationalUnits.ror), eq(schema.organisationalUnits.ror, "")),
				eq(schema.entityStatus.type, "published"),
				eq(schema.organisationalUnitTypes.type, "institution"),
			),
		);

	const countries = await findCountriesByUnit();

	return units.map((unit) => {
		return { ...unit, country: countries.get(unit.documentId) ?? null };
	});
}

/**
 * The country each institution is located in, via `is_located_in`. Document-level, so it is read
 * off whichever version is published — the same relation the public institution pages show.
 */
async function findCountriesByUnit(): Promise<Map<string, string>> {
	const relatedUnits = alias(schema.organisationalUnits, "related_units");
	const relatedVersions = alias(schema.entityVersions, "related_versions");
	const relatedStatus = alias(schema.entityStatus, "related_status");

	const rows = await db
		.selectDistinct({
			documentId: schema.organisationalUnitsRelations.unitDocumentId,
			country: relatedUnits.name,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitsRelations.status, schema.organisationalUnitStatus.id),
		)
		.innerJoin(
			relatedVersions,
			eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, relatedVersions.entityId),
		)
		.innerJoin(relatedStatus, eq(relatedVersions.statusId, relatedStatus.id))
		.innerJoin(relatedUnits, eq(relatedUnits.id, relatedVersions.id))
		.where(
			and(
				eq(schema.organisationalUnitStatus.status, "is_located_in"),
				eq(relatedStatus.type, "published"),
			),
		);

	return new Map(rows.map((row) => [row.documentId, row.country] as const));
}

/** RORs already in use, so a proposal cannot point two units at the same organisation. */
async function findAssignedRorIds(): Promise<Set<string>> {
	const rows = await db
		.selectDistinct({ ror: schema.organisationalUnits.ror })
		.from(schema.organisationalUnits)
		.where(ne(schema.organisationalUnits.ror, ""));

	return new Set(rows.flatMap((row) => (toRorId(row.ror) == null ? [] : [toRorId(row.ror)!])));
}

async function proposeMatches(
	units: Array<CandidateUnit>,
	delayMs: number,
): Promise<{ matches: Array<ProposedMatch>; unmatched: Array<CandidateUnit> }> {
	assert(env.ROR_API_BASE_URL, "Missing environment variable: `ROR_API_BASE_URL`.");

	const ror = createRorClient({ baseUrl: env.ROR_API_BASE_URL });

	const matches: Array<ProposedMatch> = [];
	const unmatched: Array<CandidateUnit> = [];

	for (const [index, unit] of units.entries()) {
		if (index > 0) {
			await delay(delayMs);
		}

		if (index > 0 && index % 100 === 0) {
			log.info(`… ${String(index)}/${String(units.length)}`);
		}

		const match = await ror.matchAffiliation(unit.name);
		const rorId = toRorId(match?.organization.id);

		if (match == null || rorId == null) {
			unmatched.push(unit);
			continue;
		}

		const names = getRorNames(match.organization).map((name) => normalise(name));
		const location = getRorLocation(match.organization);

		const unitCountry = canonicalCountry(unit.country);
		const rorCountry = canonicalCountry(location.country);
		/** Unknown on either side is not evidence of a mismatch, so the name gate decides alone. */
		const countriesDisagree =
			unitCountry != null && rorCountry != null && unitCountry !== rorCountry;

		matches.push({
			unit,
			rorId,
			rorName: getRorDisplayName(match.organization),
			rorCountry: location.country,
			rorCity: location.city,
			confidence: !names.includes(normalise(unit.name))
				? "loose"
				: countriesDisagree
					? "country_mismatch"
					: "exact",
		});
	}

	return { matches, unmatched };
}

/**
 * Drops proposals a reviewer has to look at, plus any ROR claimed by more than one unit — two units
 * sharing an identifier means one of them is a duplicate record, which is a judgement call.
 */
function selectAutoAppliable(
	matches: Array<ProposedMatch>,
	assignedRorIds: Set<string>,
): Array<ProposedMatch> {
	const appliable = matches.filter(
		(match) => match.confidence === "exact" && !assignedRorIds.has(match.rorId),
	);

	const counts = new Map<string, number>();
	for (const match of appliable) {
		counts.set(match.rorId, (counts.get(match.rorId) ?? 0) + 1);
	}

	return appliable.filter((match) => counts.get(match.rorId) === 1);
}

/**
 * Writes the ROR onto every version of the unit, draft and published alike — same reasoning as the
 * actor-id backfill: an external identifier stranded on a draft helps nobody, and a draft/published
 * split on one is noise for the next editor. Never overwrites a value that is already there.
 */
async function applyMatches(matches: Array<ProposedMatch>): Promise<number> {
	let applied = 0;

	for (const match of matches) {
		await db.transaction(async (tx) => {
			/** Re-checked in the transaction, so a ROR assigned since the report is not duplicated. */
			const taken = await tx
				.select({ id: schema.organisationalUnits.id })
				.from(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.ror, toRorUrl(match.rorId)))
				.limit(1);

			if (taken.length > 0) {
				log.warn(`Skipping ${match.unit.name}: ROR ${match.rorId} is already assigned.`);
				return;
			}

			const versionIds = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, match.unit.documentId))
				.then((rows) => rows.map((row) => row.id));

			if (versionIds.length === 0) {
				return;
			}

			const updated = await tx
				.update(schema.organisationalUnits)
				.set({ ror: toRorUrl(match.rorId) })
				.where(
					and(
						inArray(schema.organisationalUnits.id, versionIds),
						or(isNull(schema.organisationalUnits.ror), eq(schema.organisationalUnits.ror, "")),
					),
				)
				.returning({ id: schema.organisationalUnits.id });

			if (updated.length > 0) {
				applied += 1;
			}
		});
	}

	return applied;
}

const reportColumns = [
	"confidence",
	"unit_document_id",
	"unit_name",
	"unit_acronym",
	"unit_country",
	"ror_id",
	"ror_name",
	"ror_country",
	"ror_city",
	"ror_url",
] as const;

async function writeReport(
	matches: Array<ProposedMatch>,
	unmatched: Array<CandidateUnit>,
): Promise<void> {
	const order: Record<MatchConfidence, number> = { exact: 0, country_mismatch: 1, loose: 2 };

	const rows = [
		...matches
			.toSorted((a, b) => order[a.confidence] - order[b.confidence])
			.map((match) => [
				match.confidence,
				match.unit.documentId,
				match.unit.name,
				match.unit.acronym ?? "",
				match.unit.country ?? "",
				match.rorId,
				match.rorName ?? "",
				match.rorCountry ?? "",
				match.rorCity ?? "",
				toRorUrl(match.rorId),
			]),
		...unmatched.map((unit) => [
			"none",
			unit.documentId,
			unit.name,
			unit.acronym ?? "",
			unit.country ?? "",
			"",
			"",
			"",
			"",
			"",
		]),
	];

	await writeTsvReport(reportFilePath, reportColumns, rows);
}

/**
 * Reads back a reviewed report. Only `unit_document_id` and `ror_id` are used, so a reviewer fixes
 * a pairing by correcting the id and rejects one by clearing it. A `ror_url` is accepted in its
 * place for rows filled in by hand from a browser.
 */
async function readReviewedMatches(
	filePath: string,
	units: Array<CandidateUnit>,
): Promise<Array<ProposedMatch>> {
	const records = await readTsvReport(filePath, ["unit_document_id"]);
	const unitsByDocumentId = new Map(units.map((unit) => [unit.documentId, unit]));

	return records.flatMap((record) => {
		const rorId = toRorId(record.ror_id) ?? toRorId(record.ror_url);
		const unit = unitsByDocumentId.get(record.unit_document_id ?? "");

		if (rorId == null) {
			return [];
		}

		/**
		 * A row whose unit is no longer a candidate is skipped rather than force-applied: it means the
		 * ROR was filled in, or the unit unpublished, since the report was written.
		 */
		if (unit == null) {
			log.warn(`Skipping reviewed row for \`${record.unit_document_id ?? ""}\`: not a candidate.`);
			return [];
		}

		return [
			{
				unit,
				rorId,
				rorName: record.ror_name ?? null,
				rorCountry: record.ror_country ?? null,
				rorCity: record.ror_city ?? null,
				confidence: "exact" as const,
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

	const units = await findCandidateUnits();

	if (fromFile != null) {
		const reviewed = await readReviewedMatches(fromFile, units);

		if (!apply) {
			log.info(`${String(reviewed.length)} reviewed matches. Pass \`--apply\` to write them.`);
			return;
		}

		const applied = await applyMatches(reviewed);
		log.success(`Assigned ${String(applied)} RORs from \`${fromFile}\`.`);
		return;
	}

	const selected = Number.isInteger(limit) && limit > 0 ? units.slice(0, limit) : units;

	log.info(
		`${String(selected.length)} institutions without a ROR (of ${String(units.length)}), ${String(delayMs)}ms between requests.`,
	);

	const { matches, unmatched } = await proposeMatches(selected, delayMs);
	const assignedRorIds = await findAssignedRorIds();

	await writeReport(matches, unmatched);

	const autoAppliable = selectAutoAppliable(matches, assignedRorIds);

	const counts = new Map<MatchConfidence, number>();
	for (const match of matches) {
		counts.set(match.confidence, (counts.get(match.confidence) ?? 0) + 1);
	}

	log.info(
		[
			`exact: ${String(counts.get("exact") ?? 0)}`,
			`country mismatch: ${String(counts.get("country_mismatch") ?? 0)}`,
			`loose: ${String(counts.get("loose") ?? 0)}`,
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
	log.success(`Assigned ${String(applied)} RORs.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());

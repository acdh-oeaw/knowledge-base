import * as path from "node:path";

import { assert, log } from "@acdh-oeaw/lib";
import { type ActorDto, createSshocClient, isSoftware } from "@dariah-eric/client-sshoc";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, inArray, isNull } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";
import { normalise, similarity, toRorId } from "../lib/matching";
import { readTsvReport, writeTsvReport } from "../lib/tsv-report";

/**
 * Proposes `organisational_units.sshoc_marketplace_actor_id` values for institutions, by matching
 * marketplace actors against local units. Dry run by default; `--apply` writes the unambiguous
 * matches, `--from-file` writes a reviewed report.
 *
 * Only actors that the SSHOC service ingest actually cares about are considered: contributors in
 * the `reviewer` or `provider` role on a non-software "DARIAH Resource" tool-or-service — the same
 * fetch, the same software filter and the same two roles as `@dariah-eric/sshoc-services`. An actor
 * outside that set can never produce a service relation, so an id for it would be dead weight.
 * Actors already resolvable to some published unit are skipped, which makes this the exact inverse
 * of that ingest's `unmappedActors` report.
 *
 * @example
 * 	pnpm run data:backfill:sshoc-actor-ids
 * 	pnpm run data:backfill:sshoc-actor-ids -- --scope=all
 * 	pnpm run data:backfill:sshoc-actor-ids -- --apply
 * 	pnpm run data:backfill:sshoc-actor-ids -- --apply --from-file=.cache/sshoc-actor-ids.tsv
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "sshoc-actor-ids.tsv");

/**
 * Confidence in a proposed pairing. Only `ror` and `name` are ever written without human review: a
 * ROR is a globally unique identifier for the institution, and a full normalised name equal on both
 * sides leaves little room for a different organisation. `acronym` and `fuzzy` are reported for
 * review only — acronyms collide across countries ("CNR", "SUB"), and a token overlap of even 0.8
 * routinely pairs a university with one of its own institutes.
 */
type MatchConfidence = "ror" | "name" | "acronym" | "fuzzy";

const autoAppliableConfidences = new Set<MatchConfidence>(["ror", "name"]);

/** Below this, a token overlap is noise rather than a lead worth a reviewer's time. */
const fuzzyThreshold = 0.5;

interface CandidateActor {
	id: number;
	name: string;
	ror: string | null;
	website: string | null;
	roles: Array<string>;
	serviceCount: number;
}

interface CandidateUnit {
	documentId: string;
	name: string;
	acronym: string | null;
	ror: string | null;
	isPartner: boolean;
}

interface ProposedMatch {
	actor: CandidateActor;
	unit: CandidateUnit;
	confidence: MatchConfidence;
	score: number;
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

function getActorRor(actor: ActorDto): string | null {
	const externalId = actor.externalIds.find(
		(externalId) => externalId.identifierService.code === "ROR",
	);

	return toRorId(externalId?.identifier ?? null);
}

/**
 * Distinct `reviewer`/`provider` actors across the services the SSHOC ingest sees, minus those an
 * existing id already resolves. Mirrors `ingestSshocServices` — if the two ever disagree on the
 * fetch or the software filter, this script proposes ids the ingest would not use.
 */
async function findCandidateActors(): Promise<Array<CandidateActor>> {
	assert(
		env.SSHOC_MARKETPLACE_API_BASE_URL,
		"Missing environment variable: `SSHOC_MARKETPLACE_API_BASE_URL`.",
	);

	const sshoc = createSshocClient({
		config: { baseUrl: env.SSHOC_MARKETPLACE_API_BASE_URL },
	});

	const items = await sshoc.items
		.searchAll({
			"f.keyword": ["DARIAH Resource"],
			categories: ["tool-or-service"],
			order: ["label"],
		})
		.then((result) => result.unwrap());

	const actors = new Map<number, CandidateActor & { roleSet: Set<string> }>();

	for (const item of items) {
		if (isSoftware(item)) {
			continue;
		}

		for (const contributor of item.contributors) {
			if (contributor.role.code !== "reviewer" && contributor.role.code !== "provider") {
				continue;
			}

			const existing = actors.get(contributor.actor.id);

			if (existing != null) {
				existing.roleSet.add(contributor.role.code);
				existing.serviceCount += 1;
				continue;
			}

			actors.set(contributor.actor.id, {
				id: contributor.actor.id,
				name: contributor.actor.name,
				ror: getActorRor(contributor.actor),
				website: contributor.actor.website ?? null,
				roles: [],
				roleSet: new Set([contributor.role.code]),
				serviceCount: 1,
			});
		}
	}

	const assignedActorIds = await db
		.selectDistinct({ actorId: schema.organisationalUnits.sshocMarketplaceActorId })
		.from(schema.organisationalUnits)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.where(eq(schema.entityStatus.type, "published"))
		.then((rows) => new Set(rows.flatMap((row) => (row.actorId == null ? [] : [row.actorId]))));

	return [...actors.values()]
		.filter((actor) => !assignedActorIds.has(actor.id))
		.map((actor) => {
			const { roleSet, ...rest } = actor;
			return { ...rest, roles: [...roleSet].toSorted() };
		});
}

/**
 * Published institution units without an id yet. Keyed by document id, because that is what the
 * service relations reference and what identifies a unit across its versions.
 */
async function findCandidateUnits(scope: "partner" | "all"): Promise<Array<CandidateUnit>> {
	const rows = await db
		.select({
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
				isNull(schema.organisationalUnits.sshocMarketplaceActorId),
				eq(schema.entityStatus.type, "published"),
				eq(schema.organisationalUnitTypes.type, "institution"),
			),
		);

	const partnerDocumentIds = await db
		.selectDistinct({ documentId: schema.organisationalUnitsRelations.unitDocumentId })
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitsRelations.status, schema.organisationalUnitStatus.id),
		)
		.where(eq(schema.organisationalUnitStatus.status, "is_partner_institution_of"))
		.then((relations) => new Set(relations.map((relation) => relation.documentId)));

	return rows
		.map((row) => {
			return { ...row, isPartner: partnerDocumentIds.has(row.documentId) };
		})
		.filter((unit) => scope === "all" || unit.isPartner);
}

/**
 * At most one proposal per actor, best confidence first. A key claimed by two different units is
 * dropped rather than guessed at — an ambiguous ROR or name is a data problem to fix by hand, and
 * silently picking either one would write the wrong id half the time.
 */
function proposeMatches(
	actors: Array<CandidateActor>,
	units: Array<CandidateUnit>,
): Array<ProposedMatch> {
	const indexBy = (toKeys: (unit: CandidateUnit) => Array<string | null>) => {
		const index = new Map<string, CandidateUnit | null>();

		for (const unit of units) {
			for (const key of toKeys(unit)) {
				if (key == null || key.length === 0) {
					continue;
				}

				index.set(key, index.has(key) ? null : unit);
			}
		}

		return index;
	};

	const unitsByRor = indexBy((unit) => [toRorId(unit.ror)]);
	const unitsByName = indexBy((unit) => [normalise(unit.name)]);
	const unitsByAcronym = indexBy((unit) => [unit.acronym == null ? null : normalise(unit.acronym)]);

	const matches: Array<ProposedMatch> = [];

	for (const actor of actors) {
		const byRor = actor.ror == null ? undefined : unitsByRor.get(actor.ror);

		if (byRor != null) {
			matches.push({ actor, unit: byRor, confidence: "ror", score: 1 });
			continue;
		}

		const byName = unitsByName.get(normalise(actor.name));

		if (byName != null) {
			matches.push({ actor, unit: byName, confidence: "name", score: 1 });
			continue;
		}

		const byAcronym = unitsByAcronym.get(normalise(actor.name));

		if (byAcronym != null) {
			matches.push({ actor, unit: byAcronym, confidence: "acronym", score: 1 });
			continue;
		}

		let best: CandidateUnit | null = null;
		let bestScore = 0;

		for (const unit of units) {
			const score = Math.max(
				similarity(actor.name, unit.name),
				unit.acronym == null ? 0 : similarity(actor.name, unit.acronym),
			);

			if (score > bestScore) {
				bestScore = score;
				best = unit;
			}
		}

		if (best != null && bestScore >= fuzzyThreshold) {
			matches.push({ actor, unit: best, confidence: "fuzzy", score: bestScore });
		}
	}

	return matches;
}

/**
 * Drops anything a reviewer has to look at, plus proposals that would put the same id on two units.
 * The ingest keys units by actor id in a plain `Map`, so a duplicate would silently shadow one of
 * them rather than fail loudly.
 */
function selectAutoAppliable(matches: Array<ProposedMatch>): Array<ProposedMatch> {
	const appliable = matches.filter((match) => autoAppliableConfidences.has(match.confidence));

	const unitCounts = new Map<string, number>();
	for (const match of appliable) {
		unitCounts.set(match.unit.documentId, (unitCounts.get(match.unit.documentId) ?? 0) + 1);
	}

	return appliable.filter((match) => unitCounts.get(match.unit.documentId) === 1);
}

/**
 * Writes the id onto every version of the unit, draft and published alike.
 *
 * The admin form writes the draft only, which is right for editorial fields — they are reviewed
 * before going live. This one is an external identifier with no editorial content: leaving it on
 * the draft would mean the ingest (which reads published versions) keeps ignoring the actor until
 * someone publishes each unit, and a draft/published split on a pure identifier is noise for the
 * next editor to reconcile.
 */
async function applyMatches(matches: Array<ProposedMatch>): Promise<number> {
	let applied = 0;

	for (const match of matches) {
		await db.transaction(async (tx) => {
			/**
			 * Re-checked inside the transaction, so a unit or actor that was assigned since the report
			 * was computed is left alone instead of overwritten.
			 */
			const taken = await tx
				.select({ id: schema.organisationalUnits.id })
				.from(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.sshocMarketplaceActorId, match.actor.id))
				.limit(1);

			if (taken.length > 0) {
				log.warn(
					`Skipping actor ${String(match.actor.id)} (${match.actor.name}): id already assigned.`,
				);
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
				.set({ sshocMarketplaceActorId: match.actor.id })
				.where(
					and(
						inArray(schema.organisationalUnits.id, versionIds),
						isNull(schema.organisationalUnits.sshocMarketplaceActorId),
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
	"score",
	"actor_id",
	"actor_name",
	"actor_roles",
	"service_count",
	"actor_ror",
	"actor_website",
	"unit_document_id",
	"unit_name",
	"unit_acronym",
	"unit_ror",
	"unit_is_partner",
] as const;

async function writeReport(
	matches: Array<ProposedMatch>,
	unmatched: Array<CandidateActor>,
): Promise<void> {
	const order: Record<MatchConfidence, number> = { ror: 0, name: 1, acronym: 2, fuzzy: 3 };

	const rows = [
		...matches
			.toSorted(
				(a, b) =>
					order[a.confidence] - order[b.confidence] || b.actor.serviceCount - a.actor.serviceCount,
			)
			.map((match) => [
				match.confidence,
				match.score.toFixed(2),
				String(match.actor.id),
				match.actor.name,
				match.actor.roles.join("/"),
				String(match.actor.serviceCount),
				match.actor.ror ?? "",
				match.actor.website ?? "",
				match.unit.documentId,
				match.unit.name,
				match.unit.acronym ?? "",
				match.unit.ror ?? "",
				String(match.unit.isPartner),
			]),
		...unmatched
			.toSorted((a, b) => b.serviceCount - a.serviceCount)
			.map((actor) => [
				"none",
				"0.00",
				String(actor.id),
				actor.name,
				actor.roles.join("/"),
				String(actor.serviceCount),
				actor.ror ?? "",
				actor.website ?? "",
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
 * Reads back a report a human has edited. Only `actor_id` and `unit_document_id` are read, so
 * reviewers can fix a wrong pairing by editing the unit column, and reject one by clearing it.
 */
async function readReviewedMatches(
	filePath: string,
	actors: Array<CandidateActor>,
	units: Array<CandidateUnit>,
): Promise<Array<ProposedMatch>> {
	const records = await readTsvReport(filePath, ["actor_id", "unit_document_id"]);

	const actorsById = new Map(actors.map((actor) => [actor.id, actor]));
	const unitsByDocumentId = new Map(units.map((unit) => [unit.documentId, unit]));

	return records.flatMap((record) => {
		const actorId = Number(record.actor_id);
		const documentId = record.unit_document_id ?? "";

		if (!Number.isInteger(actorId) || documentId.length === 0) {
			return [];
		}

		const actor = actorsById.get(actorId);
		const unit = unitsByDocumentId.get(documentId);

		/**
		 * A row naming an actor or unit that is no longer a candidate is skipped, not force-applied: it
		 * means the id was assigned, or the unit published/deleted, since the report was written.
		 */
		if (actor == null || unit == null) {
			log.warn(`Skipping reviewed row for actor ${String(actorId)}: no longer a candidate.`);
			return [];
		}

		return [{ actor, unit, confidence: "name" as const, score: 1 }];
	});
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");
	const scope = process.argv.includes("--scope=all") ? "all" : "partner";
	const fromFile = process.argv
		.find((argument) => argument.startsWith("--from-file="))
		?.slice("--from-file=".length);

	const [actors, units] = await Promise.all([findCandidateActors(), findCandidateUnits(scope)]);

	log.info(
		`${String(actors.length)} unmapped marketplace actors, ${String(units.length)} candidate institutions (scope: ${scope}).`,
	);

	if (fromFile != null) {
		const reviewed = await readReviewedMatches(fromFile, actors, units);

		if (!apply) {
			log.info(`${String(reviewed.length)} reviewed matches. Pass \`--apply\` to write them.`);
			return;
		}

		const applied = await applyMatches(reviewed);
		log.success(`Assigned ${String(applied)} actor ids from \`${fromFile}\`.`);
		return;
	}

	const matches = proposeMatches(actors, units);
	const matchedActorIds = new Set(matches.map((match) => match.actor.id));
	const unmatched = actors.filter((actor) => !matchedActorIds.has(actor.id));

	await writeReport(matches, unmatched);

	const counts = new Map<MatchConfidence, number>();
	for (const match of matches) {
		counts.set(match.confidence, (counts.get(match.confidence) ?? 0) + 1);
	}

	const autoAppliable = selectAutoAppliable(matches);

	log.info(
		[
			`ror: ${String(counts.get("ror") ?? 0)}`,
			`name: ${String(counts.get("name") ?? 0)}`,
			`acronym: ${String(counts.get("acronym") ?? 0)}`,
			`fuzzy: ${String(counts.get("fuzzy") ?? 0)}`,
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
	log.success(`Assigned ${String(applied)} actor ids.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());

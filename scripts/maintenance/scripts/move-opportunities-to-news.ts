import { parseArgs } from "node:util";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import { type SQL, sql } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";

/**
 * One-off script moving opportunity documents back to news items, by slug. This is the inverse of
 * `move-job-opportunity-news-to-opportunities.ts`, for undoing an accidental move.
 *
 * Pass one or more opportunity slugs as positional arguments.
 *
 * Dry run by default; pass `--apply` to mutate the database.
 *
 * The move keeps document ids, version ids, slugs, content blocks, images, summaries and
 * timestamps. The news publication date is taken from the start of the opportunity duration; the
 * opportunity-only fields (source, website, duration end) are dropped.
 *
 * @example
 * 	pnpm run data:move:opportunities-to-news -- some-slug
 * 	pnpm run data:move:opportunities-to-news -- some-slug another-slug --apply
 */

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

interface Candidate {
	documentId: string;
	slug: string;
	versionId: string;
	status: string;
	title: string;
	publicationDate: string | null;
}

interface SlugConflict {
	documentId: string;
	slug: string;
	conflictingDocumentId: string;
}

/**
 * The opportunity documents to move: exactly those with the given slugs.
 *
 * A document is selected as a whole, so all of its versions move together.
 */
function targetDocuments(slugs: Array<string>): SQL {
	return sql`
		SELECT DISTINCT "ev"."entity_id" AS "document_id"
		FROM "opportunities" AS "o"
		JOIN "entity_versions" AS "ev" ON "ev"."id" = "o"."id"
		JOIN "entities" AS "e" ON "e"."id" = "ev"."entity_id"
		JOIN "entity_types" AS "et" ON "et"."id" = "e"."type_id"
		WHERE "et"."type" = 'opportunities'
			AND "e"."slug" IN ${slugs}
	`;
}

async function findCandidates(slugs: Array<string>): Promise<Array<Candidate>> {
	const result = await db.execute<{
		document_id: string;
		slug: string;
		version_id: string;
		status: string;
		title: string;
		publication_date: string | null;
	}>(sql`
		WITH "target_documents" AS (
			${targetDocuments(slugs)}
		)
		SELECT
			"e"."id"::text AS "document_id",
			"e"."slug",
			"ev"."id"::text AS "version_id",
			"es"."type" AS "status",
			"o"."title",
			lower("o"."duration")::text AS "publication_date"
		FROM "target_documents" AS "td"
		JOIN "entities" AS "e" ON "e"."id" = "td"."document_id"
		JOIN "entity_versions" AS "ev" ON "ev"."entity_id" = "e"."id"
		JOIN "entity_status" AS "es" ON "es"."id" = "ev"."status_id"
		JOIN "opportunities" AS "o" ON "o"."id" = "ev"."id"
		ORDER BY "e"."slug", "es"."type", "ev"."id"
	`);

	return result.rows.map((row) => {
		return {
			documentId: row.document_id,
			slug: row.slug,
			versionId: row.version_id,
			status: row.status,
			title: row.title,
			publicationDate: row.publication_date,
		};
	});
}

async function findSlugConflicts(slugs: Array<string>): Promise<Array<SlugConflict>> {
	const result = await db.execute<{
		document_id: string;
		slug: string;
		conflicting_document_id: string;
	}>(sql`
		WITH "target_documents" AS (
			${targetDocuments(slugs)}
		)
		SELECT
			"target"."id"::text AS "document_id",
			"target"."slug",
			"conflict"."id"::text AS "conflicting_document_id"
		FROM "target_documents" AS "td"
		JOIN "entities" AS "target" ON "target"."id" = "td"."document_id"
		JOIN "entity_types" AS "news_type" ON "news_type"."type" = 'news'
		JOIN "entities" AS "conflict"
			ON "conflict"."type_id" = "news_type"."id"
			AND "conflict"."slug" = "target"."slug"
			AND "conflict"."id" <> "target"."id"
		ORDER BY "target"."slug"
	`);

	return result.rows.map((row) => {
		return {
			documentId: row.document_id,
			slug: row.slug,
			conflictingDocumentId: row.conflicting_document_id,
		};
	});
}

async function assertRequiredLookupsExist(): Promise<void> {
	const result = await db.execute<{
		news_type_exists: boolean;
		opportunity_type_exists: boolean;
		news_content_field_exists: boolean;
		opportunity_content_field_exists: boolean;
	}>(sql`
		SELECT
			EXISTS (SELECT 1 FROM "entity_types" WHERE "type" = 'news') AS "news_type_exists",
			EXISTS (SELECT 1 FROM "entity_types" WHERE "type" = 'opportunities') AS "opportunity_type_exists",
			EXISTS (
				SELECT 1
				FROM "entity_types_fields_names" AS "fn"
				JOIN "entity_types" AS "et" ON "et"."id" = "fn"."entity_type_id"
				WHERE "et"."type" = 'news' AND "fn"."field_name" = 'content'
			) AS "news_content_field_exists",
			EXISTS (
				SELECT 1
				FROM "entity_types_fields_names" AS "fn"
				JOIN "entity_types" AS "et" ON "et"."id" = "fn"."entity_type_id"
				WHERE "et"."type" = 'opportunities' AND "fn"."field_name" = 'content'
			) AS "opportunity_content_field_exists"
	`);

	const row = result.rows[0];
	if (row == null) {
		throw new Error("Could not verify required lookup data.");
	}

	const lookups: Array<[name: string, exists: boolean]> = [
		["entity_types.news", row.news_type_exists],
		["entity_types.opportunities", row.opportunity_type_exists],
		["entity_types_fields_names.news.content", row.news_content_field_exists],
		["entity_types_fields_names.opportunities.content", row.opportunity_content_field_exists],
	];

	const missing = lookups.filter(([, exists]) => !exists).map(([name]) => name);

	if (missing.length > 0) {
		throw new Error(`Missing required lookup row(s): ${missing.join(", ")}`);
	}
}

async function moveCandidates(slugs: Array<string>): Promise<{
	movedVersions: number;
	movedDocuments: number;
	updatedFields: number;
}> {
	const result = await db.transaction(async (tx) => {
		const moved = await tx.execute<{
			moved_versions: string;
			moved_documents: string;
			updated_fields: string;
		}>(sql`
			WITH "target_documents" AS (
				${targetDocuments(slugs)}
			),
			"target_opportunities" AS (
				SELECT
					"o".*,
					"ev"."entity_id" AS "document_id"
				FROM "opportunities" AS "o"
				JOIN "entity_versions" AS "ev" ON "ev"."id" = "o"."id"
				JOIN "target_documents" AS "td" ON "td"."document_id" = "ev"."entity_id"
			),
			"inserted_news" AS (
				INSERT INTO "news" (
					"id",
					"title",
					"summary",
					"publication_date",
					"image_id",
					"image_caption",
					"image_caption_mode",
					"created_at",
					"updated_at"
				)
				SELECT
					"target_opportunities"."id",
					"target_opportunities"."title",
					"target_opportunities"."summary",
					lower("target_opportunities"."duration"),
					"target_opportunities"."image_id",
					"target_opportunities"."image_caption",
					"target_opportunities"."image_caption_mode",
					"target_opportunities"."created_at",
					"target_opportunities"."updated_at"
				FROM "target_opportunities"
				ON CONFLICT ("id") DO NOTHING
				RETURNING "id"
			),
			"moved_opportunity_versions" AS (
				SELECT
					"target_opportunities"."id",
					"target_opportunities"."document_id"
				FROM "target_opportunities"
				WHERE EXISTS (
						SELECT 1
						FROM "inserted_news"
						WHERE "inserted_news"."id" = "target_opportunities"."id"
					)
					OR EXISTS (
						SELECT 1
						FROM "news" AS "existing_news"
						WHERE "existing_news"."id" = "target_opportunities"."id"
					)
			),
			"complete_documents" AS (
				SELECT "target_documents"."document_id"
				FROM "target_documents"
				WHERE NOT EXISTS (
					SELECT 1
					FROM "target_opportunities"
					WHERE "target_opportunities"."document_id" = "target_documents"."document_id"
						AND NOT EXISTS (
							SELECT 1
							FROM "moved_opportunity_versions"
							WHERE "moved_opportunity_versions"."id" = "target_opportunities"."id"
						)
				)
			),
			"deleted_opportunities" AS (
				DELETE FROM "opportunities" AS "o"
				USING "moved_opportunity_versions"
				WHERE "o"."id" = "moved_opportunity_versions"."id"
				RETURNING "o"."id"
			),
			"updated_entities" AS (
				UPDATE "entities" AS "e"
				SET
					"type_id" = "news_type"."id",
					"updated_at" = NOW()
				FROM
					"complete_documents",
					"entity_types" AS "news_type"
				WHERE "e"."id" = "complete_documents"."document_id"
					AND "news_type"."type" = 'news'
					AND "e"."type_id" <> "news_type"."id"
				RETURNING "e"."id"
			),
			"field_mapping" AS (
				SELECT
					"news_content_field"."id" AS "news_content_field_id",
					"opportunity_content_field"."id" AS "opportunity_content_field_id"
				FROM "entity_types" AS "news_type"
				JOIN "entity_types_fields_names" AS "news_content_field"
					ON "news_content_field"."entity_type_id" = "news_type"."id"
					AND "news_content_field"."field_name" = 'content'
				JOIN "entity_types" AS "opportunity_type"
					ON "opportunity_type"."type" = 'opportunities'
				JOIN "entity_types_fields_names" AS "opportunity_content_field"
					ON "opportunity_content_field"."entity_type_id" = "opportunity_type"."id"
					AND "opportunity_content_field"."field_name" = 'content'
				WHERE "news_type"."type" = 'news'
			),
			"updated_fields" AS (
				UPDATE "fields" AS "f"
				SET "field_name_id" = "field_mapping"."news_content_field_id"
				FROM
					"complete_documents",
					"entity_versions" AS "ev",
					"field_mapping"
				WHERE "ev"."entity_id" = "complete_documents"."document_id"
					AND "f"."entity_version_id" = "ev"."id"
					AND "f"."field_name_id" = "field_mapping"."opportunity_content_field_id"
					AND NOT EXISTS (
						SELECT 1
						FROM "fields" AS "existing"
						WHERE "existing"."entity_version_id" = "f"."entity_version_id"
							AND "existing"."field_name_id" = "field_mapping"."news_content_field_id"
					)
				RETURNING "f"."id"
			)
			SELECT
				(SELECT count(*) FROM "deleted_opportunities")::text AS "moved_versions",
				(SELECT count(*) FROM "updated_entities")::text AS "moved_documents",
				(SELECT count(*) FROM "updated_fields")::text AS "updated_fields"
		`);

		const row = moved.rows[0];

		return {
			movedVersions: Number(row?.moved_versions ?? 0),
			movedDocuments: Number(row?.moved_documents ?? 0),
			updatedFields: Number(row?.updated_fields ?? 0),
		};
	});

	return result;
}

function formatCandidate(candidate: Candidate): string {
	return [
		candidate.slug,
		candidate.status,
		candidate.versionId,
		candidate.publicationDate ?? "<no duration start>",
		candidate.title,
	].join(" | ");
}

async function main(): Promise<void> {
	/**
	 * `pnpm run <script> -- --apply` forwards the `--` separator to the script, which `parseArgs`
	 * would otherwise read as "everything after this is a positional argument".
	 */
	const args = process.argv.slice(2);
	const { positionals: slugs, values } = parseArgs({
		allowPositionals: true,
		args: args[0] === "--" ? args.slice(1) : args,
		options: {
			apply: { type: "boolean", default: false },
		},
	});
	const apply = values.apply;

	if (slugs.length === 0) {
		throw new Error("Pass at least one opportunity slug to move back to news.");
	}

	await assertRequiredLookupsExist();

	const candidates = await findCandidates(slugs);
	const documentCount = new Set(candidates.map((candidate) => candidate.documentId)).size;

	const subject = `${String(slugs.length)} requested opportunity item(s)`;

	log.info(apply ? `Moving ${subject} back to news...` : `Finding ${subject} (dry run)...`);
	log.info(
		`Found ${String(candidates.length)} version(s) across ${String(documentCount)} document(s).`,
	);

	for (const candidate of candidates) {
		log.info(formatCandidate(candidate));
	}

	const foundSlugs = new Set(candidates.map((candidate) => candidate.slug));
	for (const slug of slugs) {
		if (!foundSlugs.has(slug)) {
			log.warn(`No opportunity document found with slug "${slug}".`);
		}
	}

	if (candidates.length === 0) {
		return;
	}

	/** `news.publication_date` is `NOT NULL`, so an unbounded duration start has nothing to map to. */
	const withoutPublicationDate = candidates.filter(
		(candidate) => candidate.publicationDate == null,
	);
	if (withoutPublicationDate.length > 0) {
		for (const candidate of withoutPublicationDate) {
			log.error(
				`Opportunity version ${candidate.versionId} (${candidate.slug}) has no duration start, so it has no publication date.`,
			);
		}
		throw new Error("Refusing to move opportunities without a duration start.");
	}

	const conflicts = await findSlugConflicts(slugs);
	if (conflicts.length > 0) {
		for (const conflict of conflicts) {
			log.error(
				`Slug conflict: opportunity document ${conflict.documentId} (${conflict.slug}) conflicts with news document ${conflict.conflictingDocumentId}.`,
			);
		}
		throw new Error("Refusing to move opportunities because slug conflicts exist.");
	}

	if (!apply) {
		log.info("Dry run only. Re-run with `--apply` to move these items.");
		return;
	}

	const result = await moveCandidates(slugs);

	log.success(
		`Moved ${String(result.movedVersions)} version(s) across ${String(result.movedDocuments)} document(s) from opportunities to news; remapped ${String(result.updatedFields)} content field(s).`,
	);
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

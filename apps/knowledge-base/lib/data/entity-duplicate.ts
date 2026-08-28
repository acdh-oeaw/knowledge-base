import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import {
	cloneVersionContent,
	createDraftDocumentWithSlug,
	getDocumentVersions,
} from "@/lib/data/entity-lifecycle";
import {
	type AdaptedEntityType,
	getLifecycleAdapter,
	hasLifecycleAdapter,
} from "@/lib/data/lifecycle-adapters";
import type { Transaction } from "@/lib/db";
import { and, eq, ne, sql } from "@/lib/db/sql";
import { getRequestedSlug } from "@/lib/entity-slug-input";

interface DuplicableEntity {
	id: string;
	typeId: string;
	slug: string;
	type: AdaptedEntityType;
}

export interface DuplicateEntityResult {
	sourceId: string;
	cloneId: string;
	type: AdaptedEntityType;
	/** The clone's slug: the caller's, or a derived `<source-slug>-copy`. */
	slug: string;
}

async function loadDuplicableEntity(
	tx: Transaction,
	documentId: string,
): Promise<DuplicableEntity> {
	const row = await tx
		.select({
			id: schema.entities.id,
			typeId: schema.entities.typeId,
			slug: schema.slugs.value,
			type: schema.entityTypes.type,
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.slugs,
			sql`${schema.slugs.entityVersionId} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(eq(schema.entities.id, documentId))
		.then((rows) => rows[0]);

	assert(row, `Entity "${documentId}" not found.`);
	assert(
		hasLifecycleAdapter(row.type),
		`Entity type "${row.type}" cannot be duplicated (no lifecycle adapter).`,
	);

	return { id: row.id, typeId: row.typeId, slug: row.slug, type: row.type };
}

// ---------------------------------------------------------------------------
// Copying document-level relations
// ---------------------------------------------------------------------------

type RelationPayload<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

/**
 * Strip the row identity from a relation row, leaving the copyable payload. Callers read rows with
 * `.select()` (no argument), so a column added to a relation table later is carried onto the clone
 * automatically — the same guard `subtypePayload` applies to subtype rows.
 *
 * `id` is re-generated per row, and the clone's relations are genuinely new, so they take fresh
 * timestamps rather than the source's. Everything else — above all `duration` — is copied verbatim:
 * a clone of a working group that ended in 2019 keeps the 2019 end date until an admin retimes it.
 */
function relationPayload<T extends object>(row: T): RelationPayload<T> {
	const {
		id: _id,
		createdAt: _createdAt,
		updatedAt: _updatedAt,
		...rest
	} = row as T & Partial<Record<"id" | "createdAt" | "updatedAt", unknown>>;

	return rest;
}

/**
 * Copy the relations that link two entity documents, on both endpoints: the clone should be related
 * to whatever the source is related to, and related _from_ whatever points at the source.
 *
 * Rows where the source sits on both endpoints are skipped — a degenerate self-relation has no
 * sensible copy (clone→source and source→clone are both wrong), and `mergeEntities` treats it as
 * degenerate too.
 */
async function copyEntitiesToEntities(
	tx: Transaction,
	source: string,
	clone: string,
): Promise<void> {
	const outgoing = await tx
		.select()
		.from(schema.entitiesToEntities)
		.where(
			and(
				eq(schema.entitiesToEntities.entityId, source),
				ne(schema.entitiesToEntities.relatedEntityId, source),
			),
		);

	if (outgoing.length > 0) {
		await tx.insert(schema.entitiesToEntities).values(
			outgoing.map((row) => {
				return { ...relationPayload(row), entityId: clone };
			}),
		);
	}

	const incoming = await tx
		.select()
		.from(schema.entitiesToEntities)
		.where(
			and(
				eq(schema.entitiesToEntities.relatedEntityId, source),
				ne(schema.entitiesToEntities.entityId, source),
			),
		);

	if (incoming.length > 0) {
		await tx.insert(schema.entitiesToEntities).values(
			incoming.map((row) => {
				return { ...relationPayload(row), relatedEntityId: clone };
			}),
		);
	}
}

async function copyEntitiesToResources(
	tx: Transaction,
	source: string,
	clone: string,
): Promise<void> {
	const rows = await tx
		.select()
		.from(schema.entitiesToResources)
		.where(eq(schema.entitiesToResources.entityId, source));

	if (rows.length > 0) {
		await tx.insert(schema.entitiesToResources).values(
			rows.map((row) => {
				return { ...relationPayload(row), entityId: clone };
			}),
		);
	}
}

async function copyOrganisationalUnitsRelations(
	tx: Transaction,
	source: string,
	clone: string,
): Promise<void> {
	const outgoing = await tx
		.select()
		.from(schema.organisationalUnitsRelations)
		.where(
			and(
				eq(schema.organisationalUnitsRelations.unitDocumentId, source),
				ne(schema.organisationalUnitsRelations.relatedUnitDocumentId, source),
			),
		);

	if (outgoing.length > 0) {
		await tx.insert(schema.organisationalUnitsRelations).values(
			outgoing.map((row) => {
				return { ...relationPayload(row), unitDocumentId: clone };
			}),
		);
	}

	const incoming = await tx
		.select()
		.from(schema.organisationalUnitsRelations)
		.where(
			and(
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, source),
				ne(schema.organisationalUnitsRelations.unitDocumentId, source),
			),
		);

	if (incoming.length > 0) {
		await tx.insert(schema.organisationalUnitsRelations).values(
			incoming.map((row) => {
				return { ...relationPayload(row), relatedUnitDocumentId: clone };
			}),
		);
	}
}

/**
 * Copy person↔org relations on whichever endpoint the source sits (a document is either a person or
 * an org unit, so only one branch ever matches).
 *
 * The rows' reporting children — `country_report_contributions` and `working_group_report_chairs`,
 * both keyed by the relation row id — are deliberately NOT copied: a duplicate must not appear in
 * any report. The clone therefore gets fresh relation rows with no report references hanging off
 * them.
 */
async function copyPersonsToOrganisationalUnits(
	tx: Transaction,
	source: string,
	clone: string,
): Promise<void> {
	const byPerson = await tx
		.select()
		.from(schema.personsToOrganisationalUnits)
		.where(eq(schema.personsToOrganisationalUnits.personDocumentId, source));

	if (byPerson.length > 0) {
		await tx.insert(schema.personsToOrganisationalUnits).values(
			byPerson.map((row) => {
				return { ...relationPayload(row), personDocumentId: clone };
			}),
		);
	}

	const byOrg = await tx
		.select()
		.from(schema.personsToOrganisationalUnits)
		.where(eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, source));

	if (byOrg.length > 0) {
		await tx.insert(schema.personsToOrganisationalUnits).values(
			byOrg.map((row) => {
				return { ...relationPayload(row), organisationalUnitDocumentId: clone };
			}),
		);
	}
}

async function copyProjectsToOrganisationalUnits(
	tx: Transaction,
	source: string,
	clone: string,
): Promise<void> {
	const byProject = await tx
		.select()
		.from(schema.projectsToOrganisationalUnits)
		.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, source));

	if (byProject.length > 0) {
		await tx.insert(schema.projectsToOrganisationalUnits).values(
			byProject.map((row) => {
				return { ...relationPayload(row), projectDocumentId: clone };
			}),
		);
	}

	const byUnit = await tx
		.select()
		.from(schema.projectsToOrganisationalUnits)
		.where(eq(schema.projectsToOrganisationalUnits.unitDocumentId, source));

	if (byUnit.length > 0) {
		await tx.insert(schema.projectsToOrganisationalUnits).values(
			byUnit.map((row) => {
				return { ...relationPayload(row), unitDocumentId: clone };
			}),
		);
	}
}

async function copyArticleContributors(
	tx: Transaction,
	source: string,
	clone: string,
): Promise<void> {
	const impactCaseStudiesByArticle = await tx
		.select()
		.from(schema.impactCaseStudiesToPersons)
		.where(eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, source));

	if (impactCaseStudiesByArticle.length > 0) {
		await tx.insert(schema.impactCaseStudiesToPersons).values(
			impactCaseStudiesByArticle.map((row) => {
				return { ...relationPayload(row), impactCaseStudyDocumentId: clone };
			}),
		);
	}

	const impactCaseStudiesByPerson = await tx
		.select()
		.from(schema.impactCaseStudiesToPersons)
		.where(eq(schema.impactCaseStudiesToPersons.personDocumentId, source));

	if (impactCaseStudiesByPerson.length > 0) {
		await tx.insert(schema.impactCaseStudiesToPersons).values(
			impactCaseStudiesByPerson.map((row) => {
				return { ...relationPayload(row), personDocumentId: clone };
			}),
		);
	}

	const spotlightArticlesByArticle = await tx
		.select()
		.from(schema.spotlightArticlesToPersons)
		.where(eq(schema.spotlightArticlesToPersons.spotlightArticleDocumentId, source));

	if (spotlightArticlesByArticle.length > 0) {
		await tx.insert(schema.spotlightArticlesToPersons).values(
			spotlightArticlesByArticle.map((row) => {
				return { ...relationPayload(row), spotlightArticleDocumentId: clone };
			}),
		);
	}

	const spotlightArticlesByPerson = await tx
		.select()
		.from(schema.spotlightArticlesToPersons)
		.where(eq(schema.spotlightArticlesToPersons.personDocumentId, source));

	if (spotlightArticlesByPerson.length > 0) {
		await tx.insert(schema.spotlightArticlesToPersons).values(
			spotlightArticlesByPerson.map((row) => {
				return { ...relationPayload(row), personDocumentId: clone };
			}),
		);
	}
}

/** Services are not entity documents, so only the org-unit endpoint can reference the source. */
async function copyServicesToOrganisationalUnits(
	tx: Transaction,
	source: string,
	clone: string,
): Promise<void> {
	const rows = await tx
		.select()
		.from(schema.servicesToOrganisationalUnits)
		.where(eq(schema.servicesToOrganisationalUnits.organisationalUnitDocumentId, source));

	if (rows.length > 0) {
		await tx.insert(schema.servicesToOrganisationalUnits).values(
			rows.map((row) => {
				return { ...relationPayload(row), organisationalUnitDocumentId: clone };
			}),
		);
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Duplicate an entity document into a new draft: copy its version payload (subtype row, fields,
 * content blocks, and — for org units — social media, all of which the lifecycle helpers carry)
 * plus every document-level relation, under a fresh document id.
 *
 * `rawSlug` names the clone; omit it to derive a provisional `<source-slug>-copy`. It is normalised
 * with the same slugifier used at creation time, and per-type uniqueness is left to the
 * `entities_type_id_slug_unique` constraint — a conflict surfaces as the friendly "entity slug
 * already exists" message via `getUserFacingDatabaseError`, rather than being silently renamed.
 * Naming it up front matters because slugs are otherwise fixed at creation: the entity forms do not
 * expose them, and the maintenance slug editor only resolves published documents.
 *
 * The clone is created as a **draft only**, cloned from the source's published version (falling
 * back to its draft when it has never been published). It is therefore absent from the website and
 * the search index until an admin renames it and publishes it deliberately — which matters, because
 * a clone starts life carrying the source's title.
 *
 * Reporting is deliberately untouched: no table in `reporting.ts` is written, so the clone appears
 * in no country or working-group report, contributes no euro amounts, and holds no campaign
 * thresholds. The two intended uses — splitting an "Institution A and Institution B" import
 * artefact in two, and succeeding a wound-up working group with a fresh entity — both want
 * reporting history to stay attached to the original alone. `users` and `navigation_items` are
 * skipped for the same reason: an account maps to one person, and the clone must not silently
 * appear in site navigation.
 *
 * Relations are copied verbatim, durations included, so a clone of a group that ended in 2019 looks
 * exactly as inactive as its source until an admin retimes it.
 *
 * Runs inside the caller's transaction. Nothing needs re-indexing afterwards: a draft-only document
 * has no website presence to sync.
 */
export async function duplicateEntity(
	tx: Transaction,
	sourceId: string,
	rawSlug?: string,
): Promise<DuplicateEntityResult> {
	const source = await loadDuplicableEntity(tx, sourceId);

	const { draftId, publishedId } = await getDocumentVersions(tx, sourceId);
	// Prefer the published version: it is the canonical public state, and an in-flight draft may hold
	// half-finished edits the admin does not want propagated into the copy.
	const sourceVersionId = publishedId ?? draftId;
	assert(sourceVersionId != null, `Entity "${sourceId}" has no version to duplicate.`);

	// Same rule as the entity forms: a slug the admin typed is inserted verbatim and errors on
	// collision, an omitted one derives `<source-slug>-copy` and deduplicates to `-copy-2`, `-copy-3`.
	// `slugify` is idempotent, so deriving from the already-slug `<source-slug>-copy` reproduces the
	// old `createCopySlug` output without a second, race-prone existence probe.
	const {
		documentId: cloneId,
		versionId: cloneVersionId,
		slug,
	} = await createDraftDocumentWithSlug(tx, source.typeId, {
		requestedSlug: getRequestedSlug(rawSlug),
		title: `${source.slug}-copy`,
	});

	await cloneVersionContent(tx, sourceVersionId, cloneVersionId);
	await getLifecycleAdapter(source.type).cloneSubtype(tx, sourceVersionId, cloneVersionId);

	await copyEntitiesToEntities(tx, sourceId, cloneId);
	await copyEntitiesToResources(tx, sourceId, cloneId);
	await copyOrganisationalUnitsRelations(tx, sourceId, cloneId);
	await copyPersonsToOrganisationalUnits(tx, sourceId, cloneId);
	await copyProjectsToOrganisationalUnits(tx, sourceId, cloneId);
	await copyArticleContributors(tx, sourceId, cloneId);
	await copyServicesToOrganisationalUnits(tx, sourceId, cloneId);

	return { sourceId, cloneId, type: source.type, slug };
}

import * as schema from "@dariah-eric/database/schema";

import { relationOptionsPageSize } from "@/lib/constants/relations";
import { type Database, type Transaction, db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { eq, inArray, or, sql } from "@/lib/db/sql";
import { getEntityTypeLabel, getEntityTypeTokensMatchingLabel } from "@/lib/entity-type-label";

/** `document_lifecycle.state`: whether the document is published, and whether a draft is pending. */
export type MaintenanceEntityState = "draft" | "published" | "published_with_changes";

export interface MaintenanceEntityOptionItem {
	id: string;
	/** Display label: the current version's title/name, falling back to the slug. */
	name: string;
	/** Human-readable type label (e.g. "Event", "Working group"). */
	description?: string;
	entityType?: string;
	unitType?: string | null;
	slug?: string;
	/** Lets the picker mark never-published documents, whose name may only be a slug. */
	state: MaintenanceEntityState;
}

interface GetMaintenanceEntityOptionsParams {
	limit?: number;
	offset?: number;
	q?: string;
}

/**
 * The document's current version: published if there is one, otherwise the draft. Resolving the
 * label through this (rather than the denormalized `entities.label`, which is null until a document
 * is first published — see the `add_entity_label` migration) is what lets never-published documents
 * be found by name.
 */
const currentVersionId = sql`COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`;

/**
 * Title/name of the current version, across every entity subtype — the same COALESCE the audit log
 * and the drafts list use. Null when the current version has no subtype row yet, in which case
 * callers fall back to the slug for display.
 */
const currentLabel = sql<string | null>`COALESCE(
	${schema.news.title},
	${schema.events.title},
	${schema.pages.title},
	${schema.opportunities.title},
	${schema.fundingCalls.title},
	${schema.impactCaseStudies.title},
	${schema.spotlightArticles.title},
	${schema.documentsPolicies.title},
	${schema.documentationPages.title},
	${schema.internalPages.title},
	${schema.persons.name},
	${schema.projects.name},
	${schema.organisationalUnits.name}
)`;

/**
 * Acronym of the current version, for the two subtypes that have one. Searched alongside
 * {@link currentLabel} rather than folded into it: the label is what the picker displays, and
 * documents are looked up by acronym far more often than they should be shown by it.
 * `entities.label` does carry the acronym, but is null for never-published documents — which are
 * exactly the ones this query exists to surface.
 */
const currentAcronym = sql<string | null>`COALESCE(
	${schema.projects.acronym},
	${schema.organisationalUnits.acronym}
)`;

/**
 * Entity options for the admin maintenance tools, including never-published drafts.
 *
 * Deliberately separate from `getEntityRelationOptions`: that query powers the relation pickers,
 * where `publishedEntityVersionWhere()` is correct — an unpublished document must not become the
 * target of a relation. The maintenance tools are not choosing a relation target, they are choosing
 * a maintenance subject, and excluding drafts there is actively harmful: slugs are fixed at
 * creation and editable nowhere else, so a draft with a wrong slug could only be corrected by
 * publishing the bad URL first. Renaming a draft is also the _safe_ case — it has no public URL yet
 * to break.
 *
 * One row per document (the `document_lifecycle` view is already per-document), so unlike the
 * relation-options query this needs no DISTINCT.
 */
export async function getMaintenanceEntityOptions(
	params: GetMaintenanceEntityOptionsParams = {},
	executor: Database | Transaction = db,
): Promise<{ items: Array<MaintenanceEntityOptionItem>; total: number }> {
	const { limit = relationOptionsPageSize, offset = 0, q } = params;
	const query = q?.trim();

	// Mirrors `getEntityRelationOptions`: every query term must match the slug, the resolved label or
	// the acronym (AND across terms, OR across the three), with the whole query also reverse-mapped to
	// type labels so "working group" or "event" resolves to the matching type tokens.
	const { entityTypes: matchedEntityTypes, unitTypes: matchedUnitTypes } =
		getEntityTypeTokensMatchingLabel(query ?? "");
	const allTermsMatchSlugOrLabel = matchesAllTerms(
		query,
		schema.slugs.value,
		currentLabel,
		currentAcronym,
	);
	const matchesType = or(
		matchedEntityTypes.length > 0
			? inArray(
					schema.entityTypes.type,
					matchedEntityTypes as Array<typeof schema.entityTypes.$inferSelect.type>,
				)
			: undefined,
		matchedUnitTypes.length > 0
			? inArray(
					schema.organisationalUnitTypes.type,
					matchedUnitTypes as Array<typeof schema.organisationalUnitTypes.$inferSelect.type>,
				)
			: undefined,
	);
	const where =
		query != null && query !== "" ? or(allTermsMatchSlugOrLabel, matchesType) : undefined;

	const [rows, aggregate] = await Promise.all([
		executor
			.select({
				id: schema.entities.id,
				slug: schema.slugs.value,
				label: currentLabel,
				entityType: schema.entityTypes.type,
				unitType: schema.organisationalUnitTypes.type,
				state: schema.documentLifecycle.state,
			})
			.from(schema.documentLifecycle)
			.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
			.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.documentLifecycle.typeId))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, currentVersionId))
			.leftJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, currentVersionId))
			.leftJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.leftJoin(schema.news, eq(schema.news.id, currentVersionId))
			.leftJoin(schema.events, eq(schema.events.id, currentVersionId))
			.leftJoin(schema.pages, eq(schema.pages.id, currentVersionId))
			.leftJoin(schema.opportunities, eq(schema.opportunities.id, currentVersionId))
			.leftJoin(schema.fundingCalls, eq(schema.fundingCalls.id, currentVersionId))
			.leftJoin(schema.impactCaseStudies, eq(schema.impactCaseStudies.id, currentVersionId))
			.leftJoin(schema.spotlightArticles, eq(schema.spotlightArticles.id, currentVersionId))
			.leftJoin(schema.documentsPolicies, eq(schema.documentsPolicies.id, currentVersionId))
			.leftJoin(schema.documentationPages, eq(schema.documentationPages.id, currentVersionId))
			.leftJoin(schema.internalPages, eq(schema.internalPages.id, currentVersionId))
			.leftJoin(schema.persons, eq(schema.persons.id, currentVersionId))
			.leftJoin(schema.projects, eq(schema.projects.id, currentVersionId))
			.where(where)
			.orderBy(schema.slugs.value)
			.limit(limit)
			.offset(offset),
		executor
			.select({ total: sql<number>`COUNT(*)` })
			.from(schema.documentLifecycle)
			.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
			.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.documentLifecycle.typeId))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, currentVersionId))
			.leftJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, currentVersionId))
			.leftJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.leftJoin(schema.news, eq(schema.news.id, currentVersionId))
			.leftJoin(schema.events, eq(schema.events.id, currentVersionId))
			.leftJoin(schema.pages, eq(schema.pages.id, currentVersionId))
			.leftJoin(schema.opportunities, eq(schema.opportunities.id, currentVersionId))
			.leftJoin(schema.fundingCalls, eq(schema.fundingCalls.id, currentVersionId))
			.leftJoin(schema.impactCaseStudies, eq(schema.impactCaseStudies.id, currentVersionId))
			.leftJoin(schema.spotlightArticles, eq(schema.spotlightArticles.id, currentVersionId))
			.leftJoin(schema.documentsPolicies, eq(schema.documentsPolicies.id, currentVersionId))
			.leftJoin(schema.documentationPages, eq(schema.documentationPages.id, currentVersionId))
			.leftJoin(schema.internalPages, eq(schema.internalPages.id, currentVersionId))
			.leftJoin(schema.persons, eq(schema.persons.id, currentVersionId))
			.leftJoin(schema.projects, eq(schema.projects.id, currentVersionId))
			.where(where),
	]);

	return {
		items: rows.map((row) => {
			return {
				id: row.id,
				name: row.label ?? row.slug,
				description: getEntityTypeLabel({ entityType: row.entityType, unitType: row.unitType }),
				entityType: row.entityType,
				unitType: row.unitType,
				slug: row.slug,
				state: row.state,
			};
		}),
		total: aggregate.at(0)?.total ?? 0,
	};
}

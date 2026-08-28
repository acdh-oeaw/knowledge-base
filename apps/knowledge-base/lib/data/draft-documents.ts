import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";
import { desc, eq, inArray, sql } from "@/lib/db/sql";

export interface DraftDocument {
	documentId: string;
	/** Entity type (`entity_types.type`), e.g. `persons`, `organisational_units`, `news`. */
	entityType: string;
	/** Organisational-unit subtype (`country`, `working_group`, …) when `entityType` is a unit. */
	unitType: string | null;
	slug: string;
	/** Display name/title resolved from the draft version's subtype row; `null` if none. */
	label: string | null;
	/**
	 * `draft` = new, never-published document; `published_with_changes` = edits over a published
	 * version.
	 */
	state: "draft" | "published_with_changes";
	draftUpdatedAt: Date | null;
}

/**
 * Every document with unpublished changes awaiting admin review: brand-new drafts (`state =
 * 'draft'`) and drafts layered on a published version (`state = 'published_with_changes'`). One row
 * per document, with a display label resolved from the draft version across all entity subtypes
 * (same COALESCE the audit log uses), ordered most-recently-edited first. Admin-only; the page
 * gates access.
 */
export async function getDraftDocuments(): Promise<Array<DraftDocument>> {
	// The draft version exists for both surfaced states, so resolve names/types from it.
	const draftVersionId = schema.documentLifecycle.draftId;

	const rows = await db
		.select({
			documentId: schema.documentLifecycle.documentId,
			entityType: schema.entityTypes.type,
			unitType: schema.organisationalUnitTypes.type,
			slug: schema.slugs.value,
			label: sql<
				string | null
			>`COALESCE(${schema.news.title}, ${schema.events.title}, ${schema.pages.title}, ${schema.opportunities.title}, ${schema.fundingCalls.title}, ${schema.impactCaseStudies.title}, ${schema.spotlightArticles.title}, ${schema.documentsPolicies.title}, ${schema.documentationPages.title}, ${schema.internalPages.title}, ${schema.persons.name}, ${schema.projects.name}, ${schema.organisationalUnits.name})`,
			state: schema.documentLifecycle.state,
			draftUpdatedAt: schema.documentLifecycle.draftUpdatedAt,
		})
		.from(schema.documentLifecycle)
		.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.documentLifecycle.typeId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, draftVersionId))
		.leftJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, draftVersionId))
		.leftJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.leftJoin(schema.news, eq(schema.news.id, draftVersionId))
		.leftJoin(schema.events, eq(schema.events.id, draftVersionId))
		.leftJoin(schema.pages, eq(schema.pages.id, draftVersionId))
		.leftJoin(schema.opportunities, eq(schema.opportunities.id, draftVersionId))
		.leftJoin(schema.fundingCalls, eq(schema.fundingCalls.id, draftVersionId))
		.leftJoin(schema.impactCaseStudies, eq(schema.impactCaseStudies.id, draftVersionId))
		.leftJoin(schema.spotlightArticles, eq(schema.spotlightArticles.id, draftVersionId))
		.leftJoin(schema.documentsPolicies, eq(schema.documentsPolicies.id, draftVersionId))
		.leftJoin(schema.documentationPages, eq(schema.documentationPages.id, draftVersionId))
		.leftJoin(schema.internalPages, eq(schema.internalPages.id, draftVersionId))
		.leftJoin(schema.persons, eq(schema.persons.id, draftVersionId))
		.leftJoin(schema.projects, eq(schema.projects.id, draftVersionId))
		.where(inArray(schema.documentLifecycle.state, ["draft", "published_with_changes"]))
		.orderBy(desc(schema.documentLifecycle.draftUpdatedAt));

	return rows.map((row) => {
		return {
			documentId: row.documentId,
			entityType: row.entityType,
			unitType: row.unitType,
			slug: row.slug,
			label: row.label,
			state: row.state as DraftDocument["state"],
			draftUpdatedAt: row.draftUpdatedAt,
		};
	});
}

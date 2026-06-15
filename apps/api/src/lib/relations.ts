import * as schema from "@acdh-knowledge-base/database/schema";

import type { PublicRelatedEntityType } from "@/lib/schemas";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, eq, notInArray, sql } from "@/services/db/sql";
import { search } from "@/services/search";

export interface RelatedEntity {
	id: string;
	slug: string;
	entityType: PublicRelatedEntityType;
	label: string | null;
}

/**
 * Resolve a (published/draft) entity version id to its owning document id (`entities.id`). Returns
 * the input unchanged when it is already a document id (no matching version row). Use this to
 * resolve a known version id once in JS rather than embedding a `(SELECT entity_id FROM
 * entity_versions …)` scalar subquery in a filter.
 */
export async function resolveDocumentId(db: Database | Transaction, id: string): Promise<string> {
	const entityVersion = await db.query.entityVersions.findFirst({
		where: { id },
		columns: { entityId: true },
	});

	return entityVersion?.entityId ?? id;
}

export async function getRelatedEntities(
	db: Database | Transaction,
	entityId: string,
): Promise<Array<RelatedEntity>> {
	const documentId = await resolveDocumentId(db, entityId);
	const publishedEntityVersions = alias(schema.entityVersions, "published_entity_versions");
	const publishedEntityStatus = alias(schema.entityStatus, "published_entity_status");

	return db
		.select({
			id: schema.entities.id,
			slug: schema.entities.slug,
			entityType: sql<RelatedEntity["entityType"]>`
				CASE
					WHEN ${schema.entityTypes.type} = 'organisational_units'
					THEN ${schema.organisationalUnitTypes.type}
					ELSE ${schema.entityTypes.type}
				END
			`.as("entity_type"),
			label: sql<string>`
				COALESCE(
					${schema.news.title},
					${schema.events.title},
					${schema.pages.title},
					${schema.impactCaseStudies.title},
					${schema.spotlightArticles.title},
					${schema.documentsPolicies.title},
					${schema.externalLinks.title},
					${schema.persons.name},
					${schema.organisationalUnits.name},
					${schema.projects.name}
				)
			`.as("label"),
		})
		.from(schema.entitiesToEntities)
		.innerJoin(schema.entities, eq(schema.entitiesToEntities.relatedEntityId, schema.entities.id))
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.innerJoin(publishedEntityVersions, eq(schema.entities.id, publishedEntityVersions.entityId))
		.innerJoin(
			publishedEntityStatus,
			and(
				eq(publishedEntityVersions.statusId, publishedEntityStatus.id),
				eq(publishedEntityStatus.type, "published"),
			),
		)
		.leftJoin(schema.news, eq(publishedEntityVersions.id, schema.news.id))
		.leftJoin(schema.events, eq(publishedEntityVersions.id, schema.events.id))
		.leftJoin(schema.pages, eq(publishedEntityVersions.id, schema.pages.id))
		.leftJoin(schema.impactCaseStudies, eq(publishedEntityVersions.id, schema.impactCaseStudies.id))
		.leftJoin(schema.spotlightArticles, eq(publishedEntityVersions.id, schema.spotlightArticles.id))
		.leftJoin(schema.documentsPolicies, eq(publishedEntityVersions.id, schema.documentsPolicies.id))
		.leftJoin(schema.externalLinks, eq(publishedEntityVersions.id, schema.externalLinks.id))
		.leftJoin(schema.persons, eq(publishedEntityVersions.id, schema.persons.id))
		.leftJoin(
			schema.organisationalUnits,
			eq(publishedEntityVersions.id, schema.organisationalUnits.id),
		)
		.leftJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.leftJoin(schema.projects, eq(publishedEntityVersions.id, schema.projects.id))
		.where(
			and(
				eq(schema.entitiesToEntities.entityId, documentId),
				notInArray(schema.entityTypes.type, [
					"documentation_pages",
					"external_links",
					"internal_pages",
				]),
			),
		);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getRelatedResources(db: Database | Transaction, entityId: string) {
	const documentId = await resolveDocumentId(db, entityId);
	const rows = await db
		.select({ resourceId: schema.entitiesToResources.resourceId })
		.from(schema.entitiesToResources)
		.where(eq(schema.entitiesToResources.entityId, documentId));

	if (rows.length === 0) {
		return [];
	}

	const ids = rows.map((r) => r.resourceId);

	const result = await search.collections.resources.search({
		query: "*",
		queryBy: ["label"],
		filterBy: `id:[${ids.join(",")}]`,
		perPage: ids.length,
	});

	if (result.isErr()) {
		throw result.error;
	}

	return result.value.items.map((hit) => {
		return {
			id: hit.document.id,
			label: hit.document.label,
			type: hit.document.type,
			links: hit.document.links,
		};
	});
}

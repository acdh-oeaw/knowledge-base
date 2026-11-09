import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { resolveLocaleContext } from "@/lib/locales";
import type { EntityRef, PublicRelatedEntityType } from "@/lib/schemas";
import { getConsortiumMemberDocumentIds, getWebsiteHref } from "@/lib/website-routes";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, asc, eq, inArray, notInArray, sql } from "@/services/db/sql";
import { search } from "@/services/search";

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

/**
 * As {@link resolveDocumentId}, plus the locale of the version, which is the locale a reader of that
 * version reads in. `localeId` is undefined when `id` is already a document id.
 */
export async function resolveDocumentLocale(
	db: Database | Transaction,
	id: string,
): Promise<{ documentId: string; localeId: string | undefined }> {
	const entityVersion = await db.query.entityVersions.findFirst({
		where: { id },
		columns: { entityId: true, localeId: true },
	});
	return { documentId: entityVersion?.entityId ?? id, localeId: entityVersion?.localeId };
}

interface GetEntityRefsOptions {
	/**
	 * The locale to resolve each entity in, usually the locale of the version linking to it. An
	 * entity with no published version in it falls back to the default locale. Without it, the
	 * default.
	 */
	localeId?: string;
}

/**
 * The public entities with the given document ids, keyed by document id, each with the website href
 * it is reachable at (null when its type has no page of its own).
 *
 * Shared by relation lists and by rich-text entity links, so both agree on which entities are
 * linkable and where they live. Only published entities are returned; documentation and internal
 * pages are never public. An id with no row simply has no entry — callers decide what to do with a
 * reference that no longer resolves.
 *
 * Each entity is resolved in one locale (see {@link GetEntityRefsOptions}), which the slug, label
 * and href all come from, and which is returned as `locale`: the slug differs per locale, so a href
 * without the locale it belongs to can only be prefixed with the wrong one.
 */
export async function getEntityRefsByDocumentId(
	db: Database | Transaction,
	documentIds: Array<string>,
	options: GetEntityRefsOptions = {},
): Promise<Map<string, EntityRef>> {
	if (documentIds.length === 0) {
		return new Map();
	}

	const [{ localeId, defaultLocaleId }, publishedStatus] = await Promise.all([
		resolveLocaleContext(db, options.localeId),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(publishedStatus, "No published entity status in database.");

	const preferredVersions = alias(schema.entityVersions, "preferred_entity_versions");
	const defaultVersions = alias(schema.entityVersions, "default_entity_versions");
	const publishedEntityVersions = alias(schema.entityVersions, "published_entity_versions");

	const rows = await db
		.select({
			id: schema.entities.id,
			slug: schema.slugs.value,
			type: sql<PublicRelatedEntityType>`
				CASE
					WHEN ${schema.entityTypes.type} = 'organisational_units'
					THEN ${schema.organisationalUnitTypes.type}
					ELSE ${schema.entityTypes.type}
				END
			`.as("entity_type"),
			locale: sql<string>`
				CASE
					WHEN ${schema.locales.regionCode} IS NULL THEN ${schema.locales.languageCode}
					ELSE ${schema.locales.languageCode} || '-' || ${schema.locales.regionCode}
				END
			`.as("locale"),
			label: sql<string>`
				COALESCE(
					${schema.news.title},
					${schema.events.title},
					${schema.pages.title},
					${schema.opportunities.title},
					${schema.fundingCalls.title},
					${schema.impactCaseStudies.title},
					${schema.spotlightArticles.title},
					${schema.documentsPolicies.title},
					${schema.persons.name},
					${schema.organisationalUnits.name},
					${schema.projects.name},
					${schema.entities.label},
					${schema.slugs.value}
				)
			`.as("label"),
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		// The published version in the preferred locale, else the default locale's: one per entity.
		.leftJoin(
			preferredVersions,
			and(
				eq(preferredVersions.entityId, schema.entities.id),
				eq(preferredVersions.localeId, localeId),
				eq(preferredVersions.statusId, publishedStatus.id),
			),
		)
		.leftJoin(
			defaultVersions,
			and(
				eq(defaultVersions.entityId, schema.entities.id),
				eq(defaultVersions.localeId, defaultLocaleId),
				eq(defaultVersions.statusId, publishedStatus.id),
			),
		)
		.innerJoin(
			publishedEntityVersions,
			sql`${publishedEntityVersions.id} = COALESCE(${preferredVersions.id}, ${defaultVersions.id})`,
		)
		.innerJoin(schema.locales, eq(schema.locales.id, publishedEntityVersions.localeId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, publishedEntityVersions.id))
		.leftJoin(schema.news, eq(publishedEntityVersions.id, schema.news.id))
		.leftJoin(schema.events, eq(publishedEntityVersions.id, schema.events.id))
		.leftJoin(schema.pages, eq(publishedEntityVersions.id, schema.pages.id))
		.leftJoin(schema.opportunities, eq(publishedEntityVersions.id, schema.opportunities.id))
		.leftJoin(schema.fundingCalls, eq(publishedEntityVersions.id, schema.fundingCalls.id))
		.leftJoin(schema.impactCaseStudies, eq(publishedEntityVersions.id, schema.impactCaseStudies.id))
		.leftJoin(schema.spotlightArticles, eq(publishedEntityVersions.id, schema.spotlightArticles.id))
		.leftJoin(schema.documentsPolicies, eq(publishedEntityVersions.id, schema.documentsPolicies.id))
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
				inArray(schema.entities.id, documentIds),
				notInArray(schema.entityTypes.type, ["documentation_pages", "internal_pages"]),
			),
		);

	const consortiumMemberIds = await getConsortiumMemberDocumentIds(
		db,
		rows.filter((row) => row.type === "institution").map((row) => row.id),
	);

	return new Map(
		rows.map((row) => [
			row.id,
			{
				...row,
				href: getWebsiteHref(row.type, {
					slug: row.slug,
					isConsortiumMember: consortiumMemberIds.has(row.id),
				}),
			},
		]),
	);
}

/** The entities related to `entityId`, in the order an editor arranged them. */
export async function getRelatedEntities(
	db: Database | Transaction,
	entityId: string,
): Promise<Array<EntityRef>> {
	const { documentId, localeId } = await resolveDocumentLocale(db, entityId);

	const related = await db
		.select({ relatedEntityId: schema.entitiesToEntities.relatedEntityId })
		.from(schema.entitiesToEntities)
		.where(eq(schema.entitiesToEntities.entityId, documentId))
		.orderBy(
			asc(schema.entitiesToEntities.position),
			asc(schema.entitiesToEntities.relatedEntityId),
		);

	const refs = await getEntityRefsByDocumentId(
		db,
		related.map((row) => row.relatedEntityId),
		{ localeId },
	);

	// A relation whose target is unpublished or non-public resolves to nothing and drops out, exactly
	// as it did when the filter lived in the join.
	return related.map((row) => refs.get(row.relatedEntityId)).filter((ref) => ref != null);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getRelatedResources(db: Database | Transaction, entityId: string) {
	const documentId = await resolveDocumentId(db, entityId);
	const rows = await db
		.select({ resourceId: schema.entitiesToResources.resourceId })
		.from(schema.entitiesToResources)
		.where(eq(schema.entitiesToResources.entityId, documentId))
		.orderBy(asc(schema.entitiesToResources.position), asc(schema.entitiesToResources.resourceId));

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

	const resourcesById = new Map(
		result.value.items.map(
			(hit) =>
				[
					hit.document.id,
					{
						id: hit.document.id,
						label: hit.document.label,
						type: hit.document.type,
						sourceUrl: hit.document.source_url ?? null,
						links: hit.document.links,
					},
				] as const,
		),
	);

	return ids.flatMap((id) => {
		const resource = resourcesById.get(id);
		return resource == null ? [] : [resource];
	});
}

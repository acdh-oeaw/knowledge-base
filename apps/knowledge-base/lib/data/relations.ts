/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { relationOptionsPageSize } from "@/lib/constants/relations";
import {
	defaultLocaleEntityVersionWhere,
	publishedEntityVersionWhere,
} from "@/lib/data/current-entity-version";
import { type Database, type Transaction, db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { and, eq, inArray, or, sql } from "@/lib/db/sql";
import {
	getEntityTypeLabel,
	getEntityTypeTokensMatchingLabel,
	getResourceTypeLabel,
} from "@/lib/entity-type-label";
import { search } from "@/lib/search";

export interface RelationOptionItem {
	id: string;
	/** Display label: the published title/name (including an acronym), falling back to the slug. */
	name: string;
	/** Human-readable type label (e.g. "Event", "Working group"). */
	description?: string;
	/** Raw entity-type token — used by the merge tool to enforce same-type selection. */
	entityType?: string;
	/** Raw organisational-unit-type token (only set for organisational units). */
	unitType?: string | null;
	/** The entity's current slug — used by the maintenance slug editor to prefill the field. */
	slug?: string;
}

interface GetRelationOptionsParams {
	limit?: number;
	offset?: number;
	q?: string;
}

export async function getEntityRelationOptions(
	params: GetRelationOptionsParams = {},
	executor: Database | Transaction = db,
): Promise<{ items: Array<RelationOptionItem>; total: number }> {
	const { limit = relationOptionsPageSize, offset = 0, q } = params;
	const query = q?.trim();
	// Search the document slug and its denormalized published title/name (`entities.label`, including
	// a project or organisational-unit acronym when present), plus the human-readable type labels:
	// typing "working group" or "event" is reverse-mapped to the matching `entity_types` /
	// `organisational_unit_types` tokens so it matches what the list actually shows, not just the raw
	// stored token.
	const { entityTypes: matchedEntityTypes, unitTypes: matchedUnitTypes } =
		getEntityTypeTokensMatchingLabel(query ?? "");
	// Require every query term to match the slug or label (AND across terms, OR across the two
	// columns). Normalization treats punctuation (commas, hyphens, slashes) and "&"/"and" as
	// interchangeable on both sides, so "clarin eric" finds the "clarin-eric" slug, "Culture,
	// Innovation" matches a stored "Culture Innovation", and "R and D" matches "R&D". Term order is
	// irrelevant. The type-label match keeps using the whole query, so a multi-word type like
	// "working group" still resolves.
	const allTermsMatchSlugOrLabel = matchesAllTerms(
		query,
		schema.slugs.value,
		schema.entities.label,
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
	const searchWhere =
		query != null && query !== "" ? or(allTermsMatchSlugOrLabel, matchesType) : undefined;
	const where = and(publishedEntityVersionWhere(), searchWhere);

	const [rows, aggregate] = await Promise.all([
		executor
			.selectDistinct({
				entityType: schema.entityTypes.type,
				id: schema.entities.id,
				slug: schema.slugs.value,
				label: schema.entities.label,
				unitType: schema.organisationalUnitTypes.type,
			})
			.from(schema.entities)
			.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
			.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, schema.entityVersions.id),
			)
			.leftJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(where)
			.orderBy(schema.slugs.value)
			.limit(limit)
			.offset(offset),
		executor
			.select({ total: sql<number>`COUNT(DISTINCT ${schema.entities.id})` })
			.from(schema.entities)
			.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
			.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, schema.entityVersions.id),
			)
			.leftJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
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
			};
		}),
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getEntityRelationOptionsByIds(ids: ReadonlyArray<string>) {
	if (ids.length === 0) {
		return [];
	}

	const rows = await db
		.selectDistinct({
			entityType: schema.entityTypes.type,
			id: schema.entities.id,
			slug: schema.slugs.value,
			label: schema.entities.label,
			unitType: schema.organisationalUnitTypes.type,
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.leftJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, schema.entityVersions.id),
		)
		.leftJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			and(
				publishedEntityVersionWhere(),
				defaultLocaleEntityVersionWhere(),
				inArray(schema.entities.id, [...ids]),
			),
		)
		.orderBy(schema.slugs.value);

	const itemById = new Map(
		rows.map(
			(row) =>
				[
					row.id,
					{
						id: row.id,
						name: row.label ?? row.slug,
						description: getEntityTypeLabel({
							entityType: row.entityType,
							unitType: row.unitType,
						}),
						slug: row.slug,
						entityType: row.entityType,
						unitType: row.unitType,
					},
				] as const,
		),
	);

	return ids.flatMap((id) => {
		const item = itemById.get(id);
		return item != null ? [item] : [];
	});
}

export async function getAvailableEntities() {
	const { items } = await getEntityRelationOptions({ limit: 250 });
	return items;
}

export async function getResourceRelationOptions(
	params: GetRelationOptionsParams = {},
): Promise<{ items: Array<RelationOptionItem>; total: number }> {
	const { limit = relationOptionsPageSize, offset = 0, q } = params;
	const query = q?.trim();

	try {
		const page = Math.floor(offset / limit) + 1;
		const result = await search.collections.resources.search({
			page,
			perPage: limit,
			query: query != null && query !== "" ? query : "*",
			queryBy: ["label", "type"],
			sortBy: [{ field: "label", direction: "asc" }],
		});

		if (result.isErr()) {
			throw result.error;
		}

		return {
			items: result.value.items.map((hit) => {
				return {
					description: getResourceTypeLabel(hit.document.type),
					id: hit.document.id,
					name: hit.document.label,
				};
			}),
			total: result.value.pagination.total,
		};
	} catch {
		return { items: [], total: 0 };
	}
}

export async function getResourceRelationOptionsByIds(ids: ReadonlyArray<string>) {
	if (ids.length === 0) {
		return [];
	}

	try {
		const result = await search.collections.resources.search({
			filterBy: `id:[${ids.join(",")}]`,
			perPage: ids.length,
			query: "*",
			queryBy: ["label"],
			sortBy: [{ field: "label", direction: "asc" }],
		});

		if (result.isErr()) {
			throw result.error;
		}

		const itemById = new Map(
			result.value.items.map(
				(hit) =>
					[
						hit.document.id,
						{
							description: getResourceTypeLabel(hit.document.type),
							id: hit.document.id,
							name: hit.document.label,
						},
					] as const,
			),
		);

		return ids.flatMap((id) => {
			const item = itemById.get(id);
			return item != null ? [item] : [];
		});
	} catch {
		return [];
	}
}

export async function getAvailableResources() {
	const { items } = await getResourceRelationOptions({ limit: 250 });

	return items.map((item) => {
		return { id: item.id, label: item.name };
	});
}

/**
 * Filter the given document ids down to those that have at least one published version. Used as a
 * server-side backstop before persisting any document-level relation — the picker already restricts
 * choices to published entities, but stale or tampered submissions are silently dropped rather than
 * written through. The result preserves the input order so callers can derive a stable `position`.
 */
export async function filterToPublishedDocumentIds(
	tx: Transaction,
	documentIds: ReadonlyArray<string>,
): Promise<Array<string>> {
	if (documentIds.length === 0) {
		return [];
	}

	const rows = await tx
		.selectDistinct({ id: schema.entities.id })
		.from(schema.entities)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.where(
			and(
				publishedEntityVersionWhere(),
				defaultLocaleEntityVersionWhere(),
				inArray(schema.entities.id, [...documentIds]),
			),
		);

	const publishedIds = new Set(rows.map((row) => row.id));

	return documentIds.filter((id) => publishedIds.has(id));
}

/**
 * Reconcile a document's entity/resource relations. The submitted id arrays are already in display
 * order, so each row's `position` is its index in that order — enabling user-defined sort order to
 * round-trip through {@link getEntityRelations}. Existing rows are diffed (rather than deleted and
 * reinserted) to preserve `created_at`; surviving rows whose index changed get a `position`
 * update.
 */
export async function syncEntityRelations(
	tx: Transaction,
	documentId: string,
	relatedDocumentIds: Array<string>,
	relatedResourceIds: Array<string>,
) {
	const [existingEntityRows, existingResourceRows] = await Promise.all([
		tx
			.select({
				position: schema.entitiesToEntities.position,
				relatedEntityId: schema.entitiesToEntities.relatedEntityId,
			})
			.from(schema.entitiesToEntities)
			.where(eq(schema.entitiesToEntities.entityId, documentId)),
		tx
			.select({
				position: schema.entitiesToResources.position,
				resourceId: schema.entitiesToResources.resourceId,
			})
			.from(schema.entitiesToResources)
			.where(eq(schema.entitiesToResources.entityId, documentId)),
	]);

	const existingDocumentPositions = new Map(
		existingEntityRows.map((r) => [r.relatedEntityId, r.position] as const),
	);
	const existingResourcePositions = new Map(
		existingResourceRows.map((r) => [r.resourceId, r.position] as const),
	);

	const documentIdsToDelete = [...existingDocumentPositions.keys()].filter(
		(x) => !relatedDocumentIds.includes(x),
	);
	const newlyPublishedDocumentIds = new Set(
		await filterToPublishedDocumentIds(
			tx,
			relatedDocumentIds.filter((x) => !existingDocumentPositions.has(x)),
		),
	);

	// Final ordered lists: submitted order, dropping additions that failed the published-only
	// backstop. `position` is the index in this compacted list.
	const orderedDocumentIds = relatedDocumentIds.filter(
		(x) => existingDocumentPositions.has(x) || newlyPublishedDocumentIds.has(x),
	);
	const orderedResourceIds = relatedResourceIds;

	const resourceIdsToDelete = [...existingResourcePositions.keys()].filter(
		(x) => !relatedResourceIds.includes(x),
	);

	const documentRowsToInsert = orderedDocumentIds.flatMap((relatedEntityId, position) =>
		existingDocumentPositions.has(relatedEntityId)
			? []
			: [{ entityId: documentId, position, relatedEntityId }],
	);
	const resourceRowsToInsert = orderedResourceIds.flatMap((resourceId, position) =>
		existingResourcePositions.has(resourceId)
			? []
			: [{ entityId: documentId, position, resourceId }],
	);

	const documentPositionUpdates = orderedDocumentIds.flatMap((relatedEntityId, position) =>
		existingDocumentPositions.has(relatedEntityId) &&
		existingDocumentPositions.get(relatedEntityId) !== position
			? [{ position, relatedEntityId }]
			: [],
	);
	const resourcePositionUpdates = orderedResourceIds.flatMap((resourceId, position) =>
		existingResourcePositions.has(resourceId) &&
		existingResourcePositions.get(resourceId) !== position
			? [{ position, resourceId }]
			: [],
	);

	await Promise.all([
		documentIdsToDelete.length > 0
			? tx
					.delete(schema.entitiesToEntities)
					.where(
						and(
							eq(schema.entitiesToEntities.entityId, documentId),
							inArray(schema.entitiesToEntities.relatedEntityId, documentIdsToDelete),
						),
					)
			: Promise.resolve(),
		documentRowsToInsert.length > 0
			? tx.insert(schema.entitiesToEntities).values(documentRowsToInsert)
			: Promise.resolve(),
		resourceIdsToDelete.length > 0
			? tx
					.delete(schema.entitiesToResources)
					.where(
						and(
							eq(schema.entitiesToResources.entityId, documentId),
							inArray(schema.entitiesToResources.resourceId, resourceIdsToDelete),
						),
					)
			: Promise.resolve(),
		resourceRowsToInsert.length > 0
			? tx.insert(schema.entitiesToResources).values(resourceRowsToInsert)
			: Promise.resolve(),
		...documentPositionUpdates.map((update) =>
			tx
				.update(schema.entitiesToEntities)
				.set({ position: update.position })
				.where(
					and(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, update.relatedEntityId),
					),
				),
		),
		...resourcePositionUpdates.map((update) =>
			tx
				.update(schema.entitiesToResources)
				.set({ position: update.position })
				.where(
					and(
						eq(schema.entitiesToResources.entityId, documentId),
						eq(schema.entitiesToResources.resourceId, update.resourceId),
					),
				),
		),
	]);
}

export async function getEntityRelations(documentId: string) {
	const [entityRelations, resourceRelations] = await Promise.all([
		db
			.select({ relatedEntityId: schema.entitiesToEntities.relatedEntityId })
			.from(schema.entitiesToEntities)
			.where(eq(schema.entitiesToEntities.entityId, documentId))
			.orderBy(schema.entitiesToEntities.position, schema.entitiesToEntities.createdAt),
		db
			.select({ resourceId: schema.entitiesToResources.resourceId })
			.from(schema.entitiesToResources)
			.where(eq(schema.entitiesToResources.entityId, documentId))
			.orderBy(schema.entitiesToResources.position, schema.entitiesToResources.createdAt),
	]);

	return {
		relatedEntityIds: entityRelations.map((r) => r.relatedEntityId),
		relatedResourceIds: resourceRelations.map((r) => r.resourceId),
	};
}

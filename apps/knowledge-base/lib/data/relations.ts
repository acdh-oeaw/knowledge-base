/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { relationOptionsPageSize } from "@/lib/constants/relations";
import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import { type Transaction, db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { and, eq, inArray, or, sql } from "@/lib/db/sql";
import { search } from "@/lib/search";

export interface RelationOptionItem {
	id: string;
	name: string;
	description?: string;
}

interface GetRelationOptionsParams {
	limit?: number;
	offset?: number;
	q?: string;
}

export async function getEntityRelationOptions(
	params: GetRelationOptionsParams = {},
): Promise<{ items: Array<RelationOptionItem>; total: number }> {
	const { limit = relationOptionsPageSize, offset = 0, q } = params;
	const query = q?.trim();
	const searchWhere =
		query != null && query !== ""
			? or(
					unaccentIlike(schema.entities.slug, `%${query}%`),
					unaccentIlike(schema.entityTypes.type, `%${query}%`),
				)
			: undefined;
	const where = and(publishedEntityVersionWhere(), searchWhere);

	const [rows, aggregate] = await Promise.all([
		db
			.selectDistinct({
				entityType: schema.entityTypes.type,
				id: schema.entities.id,
				slug: schema.entities.slug,
			})
			.from(schema.entities)
			.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
			.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where)
			.orderBy(schema.entities.slug)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: sql<number>`COUNT(DISTINCT ${schema.entities.id})` })
			.from(schema.entities)
			.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
			.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where),
	]);

	return {
		items: rows.map((row) => {
			return { id: row.id, name: row.slug, description: row.entityType };
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
			slug: schema.entities.slug,
			unitType: schema.organisationalUnitTypes.type,
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.leftJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, schema.entityVersions.id),
		)
		.leftJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(and(publishedEntityVersionWhere(), inArray(schema.entities.id, [...ids])))
		.orderBy(schema.entities.slug);

	const itemById = new Map(
		rows.map(
			(row) =>
				[
					row.id,
					{
						id: row.id,
						name: row.slug,
						description: row.entityType,
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
			queryBy: ["label"],
			sortBy: [{ field: "label", direction: "asc" }],
		});

		if (result.isErr()) {
			throw result.error;
		}

		return {
			items: result.value.items.map((hit) => {
				return {
					description: hit.document.type,
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
							description: hit.document.type,
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
 * written through.
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
		.where(and(publishedEntityVersionWhere(), inArray(schema.entities.id, [...documentIds])));

	return rows.map((row) => row.id);
}

export async function syncEntityRelations(
	tx: Transaction,
	documentId: string,
	relatedDocumentIds: Array<string>,
	relatedResourceIds: Array<string>,
) {
	const [existingEntityRows, existingResourceRows] = await Promise.all([
		tx
			.select({ relatedEntityId: schema.entitiesToEntities.relatedEntityId })
			.from(schema.entitiesToEntities)
			.where(eq(schema.entitiesToEntities.entityId, documentId)),
		tx
			.select({ resourceId: schema.entitiesToResources.resourceId })
			.from(schema.entitiesToResources)
			.where(eq(schema.entitiesToResources.entityId, documentId)),
	]);

	const existingDocumentIds = new Set(existingEntityRows.map((r) => r.relatedEntityId));
	const existingResourceIds = new Set(existingResourceRows.map((r) => r.resourceId));

	const documentIdsToDelete = [...existingDocumentIds].filter(
		(x) => !relatedDocumentIds.includes(x),
	);
	const documentIdsToAdd = await filterToPublishedDocumentIds(
		tx,
		relatedDocumentIds.filter((x) => !existingDocumentIds.has(x)),
	);

	const resourceIdsToDelete = [...existingResourceIds].filter(
		(x) => !relatedResourceIds.includes(x),
	);
	const resourceIdsToAdd = relatedResourceIds.filter((x) => !existingResourceIds.has(x));

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
		documentIdsToAdd.length > 0
			? tx.insert(schema.entitiesToEntities).values(
					documentIdsToAdd.map((relatedEntityId) => {
						return { entityId: documentId, relatedEntityId };
					}),
				)
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
		resourceIdsToAdd.length > 0
			? tx.insert(schema.entitiesToResources).values(
					resourceIdsToAdd.map((resourceId) => {
						return { entityId: documentId, resourceId };
					}),
				)
			: Promise.resolve(),
	]);
}

export async function getEntityRelations(documentId: string) {
	const [entityRelations, resourceRelations] = await Promise.all([
		db
			.select({ relatedEntityId: schema.entitiesToEntities.relatedEntityId })
			.from(schema.entitiesToEntities)
			.where(eq(schema.entitiesToEntities.entityId, documentId)),
		db
			.select({ resourceId: schema.entitiesToResources.resourceId })
			.from(schema.entitiesToResources)
			.where(eq(schema.entitiesToResources.entityId, documentId)),
	]);

	return {
		relatedEntityIds: entityRelations.map((r) => r.relatedEntityId),
		relatedResourceIds: resourceRelations.map((r) => r.resourceId),
	};
}

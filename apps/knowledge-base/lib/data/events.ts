/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { imageAssetWidth } from "@/config/assets.config";
import { relationOptionsPageSize } from "@/lib/constants/relations";
import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { and, count, desc, eq, inArray, sql } from "@/lib/db/sql";
import { getEntityTypeLabel } from "@/lib/entity-type-label";
import { images } from "@/lib/images";

export type EventsSort = "duration" | "title";

interface GetEventsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	q?: string;
	sort?: EventsSort;
	dir?: "asc" | "desc";
}

export async function getEvents(params: GetEventsParams) {
	const { limit = 10, offset = 0, q, sort = "duration", dir = "desc" } = params;
	const query = q?.trim();
	const where = matchesAllTerms(query, schema.events.title);
	const orderBy =
		sort === "title"
			? dir === "asc"
				? schema.events.title
				: desc(schema.events.title)
			: dir === "asc"
				? sql<Date>`lower(${schema.events.duration})`
				: desc(sql<Date>`lower(${schema.events.duration})`);

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				duration: schema.events.duration,
				isFullDay: schema.events.isFullDay,
				id: schema.events.id,
				documentId: schema.entities.id,
				location: schema.events.location,
				slug: schema.slugs.value,
				summary: schema.events.summary,
				title: schema.events.title,
				website: schema.events.website,
				isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
				hasDraft: schema.documentLifecycle.hasDraftChanges,
				status: schema.entityStatus.type,
			})
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entities.id),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, where))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, where)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		return {
			duration: item.duration,
			isFullDay: item.isFullDay,
			id: item.id,
			documentId: item.documentId,
			location: item.location,
			entity: { slug: item.slug },
			hasDraft: item.hasDraft,
			summary: item.summary,
			title: item.title,
			isPublished: item.isPublished,
			website: item.website,
		};
	});

	return { data, limit, offset, total };
}

interface GetEventByIdParams {
	id: schema.Event["id"];
}

export async function getEventById(params: GetEventByIdParams) {
	const { id } = params;

	const item = await db.query.events.findFirst({
		where: {
			id,
		},
		with: {
			entityVersion: {
				columns: {},
				with: {
					slug: {
						columns: {
							value: true,
						},
					},
				},
			},
			image: {
				columns: {
					key: true,
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const image = images.generateSignedImageUrl({
		key: item.image.key,
		options: { width: imageAssetWidth.featured },
	});

	const { entityVersion, ...rest } = item;
	assert(entityVersion.slug, `Event "${id}" has no slug.`);
	const data = { ...rest, entity: { slug: entityVersion.slug.value }, image };

	return data;
}

export interface EventOption {
	description: string;
	id: string;
	name: string;
}

interface GetEventOptionsParams {
	limit?: number;
	offset?: number;
	q?: string;
}

export async function getEventOptions(
	params: GetEventOptionsParams = {},
): Promise<{ items: Array<EventOption>; total: number }> {
	const { limit = relationOptionsPageSize, offset = 0, q } = params;
	const query = q?.trim();
	const searchWhere = matchesAllTerms(query, schema.events.title);
	const where = and(publishedEntityVersionWhere(), searchWhere);

	const [rows, aggregate] = await Promise.all([
		db
			.select({ id: schema.events.id, name: schema.events.title })
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where)
			.orderBy(desc(sql<Date>`lower(${schema.events.duration})`), schema.events.id)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where),
	]);

	const description = getEntityTypeLabel({ entityType: "events" });
	const items = rows.map((item) => {
		return { ...item, description };
	});

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

export async function getEventOptionsByIds(ids: ReadonlyArray<string>) {
	if (ids.length === 0) {
		return [];
	}

	const rows = await db
		.select({ id: schema.events.id, name: schema.events.title })
		.from(schema.events)
		.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.where(and(publishedEntityVersionWhere(), inArray(schema.events.id, [...ids])))
		.orderBy(schema.events.title);

	const itemById = new Map(rows.map((row) => [row.id, row] as const));
	const description = getEntityTypeLabel({ entityType: "events" });

	return ids.flatMap((id) => {
		const item = itemById.get(id);
		return item != null ? [{ ...item, description }] : [];
	});
}

export type EventsWithEntities = Awaited<ReturnType<typeof getEvents>>;
export type EventWithEntities = Awaited<ReturnType<typeof getEventById>>;

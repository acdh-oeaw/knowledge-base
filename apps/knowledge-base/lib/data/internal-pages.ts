/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { and, count, desc, eq, sql } from "@/lib/db/sql";

export type InternalPagesSort = "title" | "updatedAt";

interface GetInternalPagesParams {
	limit?: number;
	offset?: number;
	q?: string;
	sort?: InternalPagesSort;
	dir?: "asc" | "desc";
}

export async function getInternalPages(params: GetInternalPagesParams) {
	const { limit = 10, offset = 0, q, sort = "updatedAt", dir = "desc" } = params;
	const query = q?.trim();
	const searchWhere =
		query != null && query !== ""
			? unaccentIlike(schema.internalPages.title, `%${query}%`)
			: undefined;
	const orderBy =
		sort === "title"
			? dir === "asc"
				? schema.internalPages.title
				: desc(schema.internalPages.title)
			: dir === "asc"
				? schema.entityVersions.updatedAt
				: desc(schema.entityVersions.updatedAt);

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.internalPages.id,
				slug: schema.entities.slug,
				hasDraft: schema.documentLifecycle.hasDraftChanges,
				isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
				title: schema.internalPages.title,
				updatedAt: schema.entityVersions.updatedAt,
			})
			.from(schema.internalPages)
			.innerJoin(schema.entityVersions, eq(schema.internalPages.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entities.id),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, searchWhere))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.internalPages)
			.innerJoin(schema.entityVersions, eq(schema.internalPages.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, searchWhere)),
	]);

	return {
		data: items.map((item) => {
			return {
				id: item.id,
				entity: { slug: item.slug },
				hasDraft: item.hasDraft,
				isPublished: item.isPublished,
				title: item.title,
				updatedAt: item.updatedAt,
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

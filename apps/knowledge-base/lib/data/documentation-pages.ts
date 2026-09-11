/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { and, count, desc, eq, sql } from "@/lib/db/sql";

export type DocumentationPagesSort = "title" | "updatedAt";

interface GetDocumentationPagesParams {
	limit?: number;
	offset?: number;
	q?: string;
	sort?: DocumentationPagesSort;
	dir?: "asc" | "desc";
}

export async function getDocumentationPages(params: GetDocumentationPagesParams) {
	const { limit = 10, offset = 0, q, sort = "updatedAt", dir = "desc" } = params;
	const query = q?.trim();
	const searchWhere = matchesAllTerms(query, schema.documentationPages.title);
	const orderBy =
		sort === "title"
			? dir === "asc"
				? schema.documentationPages.title
				: desc(schema.documentationPages.title)
			: dir === "asc"
				? schema.entityVersions.updatedAt
				: desc(schema.entityVersions.updatedAt);

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				// `id` is the picked *version* id (documentation_pages is keyed by entity_versions.id);
				// the document id is what mutations operate on.
				documentId: schema.entityVersions.entityId,
				id: schema.documentationPages.id,
				slug: schema.slugs.value,
				hasDraft: schema.documentLifecycle.hasDraftChanges,
				isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
				title: schema.documentationPages.title,
				updatedAt: schema.entityVersions.updatedAt,
			})
			.from(schema.documentationPages)
			.innerJoin(schema.entityVersions, eq(schema.documentationPages.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, searchWhere))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.documentationPages)
			.innerJoin(schema.entityVersions, eq(schema.documentationPages.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, searchWhere)),
	]);

	return {
		data: items.map((item) => {
			return {
				documentId: item.documentId,
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

interface GetDocumentationPageByIdParams {
	id: schema.DocumentationPage["id"];
}

export async function getDocumentationPageById(params: GetDocumentationPageByIdParams) {
	const { id } = params;

	const item = await db.query.documentationPages.findFirst({
		where: {
			id,
		},
		with: {
			entityVersion: {
				columns: { id: true },
				with: {
					entity: {
						columns: {
							id: true,
						},
					},
					slug: {
						columns: {
							value: true,
						},
					},
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const { entityVersion, ...rest } = item;
	return { ...rest, entity: { slug: entityVersion.slug?.value ?? "" } };
}

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { and, count, desc, eq, sql } from "@/lib/db/sql";

export type OpportunitiesSort = "duration" | "source" | "title";

interface GetOpportunitiesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	q?: string;
	sort?: OpportunitiesSort;
	dir?: "asc" | "desc";
}

export async function getOpportunities(params: GetOpportunitiesParams) {
	const { limit = 10, offset = 0, q, sort = "duration", dir = "desc" } = params;
	const query = q?.trim();
	const where =
		query != null && query !== "" ? matchesAllTerms(query, schema.opportunities.title) : undefined;
	const orderBy =
		sort === "title"
			? dir === "asc"
				? schema.opportunities.title
				: desc(schema.opportunities.title)
			: sort === "source"
				? dir === "asc"
					? schema.opportunitySources.source
					: desc(schema.opportunitySources.source)
				: dir === "asc"
					? sql<Date>`lower(${schema.opportunities.duration})`
					: desc(sql<Date>`lower(${schema.opportunities.duration})`);

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				documentId: schema.entities.id,
				duration: schema.opportunities.duration,
				id: schema.opportunities.id,
				source: schema.opportunitySources.source,
				sourceId: schema.opportunities.sourceId,
				slug: schema.slugs.value,
				summary: schema.opportunities.summary,
				title: schema.opportunities.title,
				website: schema.opportunities.website,
				isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
				hasDraft: schema.documentLifecycle.hasDraftChanges,
				status: schema.entityStatus.type,
			})
			.from(schema.opportunities)
			.innerJoin(schema.entityVersions, eq(schema.opportunities.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(
				schema.opportunitySources,
				eq(schema.opportunities.sourceId, schema.opportunitySources.id),
			)
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, where))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.opportunities)
			.innerJoin(schema.entityVersions, eq(schema.opportunities.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, where)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		return {
			documentId: item.documentId,
			duration: item.duration,
			id: item.id,
			sourceId: item.sourceId,
			source: {
				id: item.sourceId,
				source: item.source,
			},
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

interface GetOpportunityByIdParams {
	id: schema.Opportunity["id"];
}

export async function getOpportunityById(params: GetOpportunityByIdParams) {
	const { id } = params;

	const item = await db.query.opportunities.findFirst({
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
		},
	});

	if (item == null) {
		return null;
	}

	const { entityVersion, ...rest } = item;
	const data = { ...rest, entity: { slug: entityVersion.slug?.value ?? "" } };

	return data;
}

export type OpportunitiesWithEntities = Awaited<ReturnType<typeof getOpportunities>>;
export type OpportunityWithEntities = Awaited<ReturnType<typeof getOpportunityById>>;

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import type { Database, Transaction } from "@/middlewares/db";
import type { OpportunitySource, OpportunityStatus } from "@/routes/opportunities/schemas";
import {
	type SQL,
	type SQLWrapper,
	and,
	count,
	desc,
	eq,
	inArray,
	or,
	sql,
} from "@/services/db/sql";

interface GetOpportunitiesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: OpportunityStatus | Array<OpportunityStatus>;
	source?: OpportunitySource | Array<OpportunitySource>;
}

function buildStatusFilter(duration: SQLWrapper, statuses: Array<OpportunityStatus>): SQL {
	const lower = sql`LOWER(${duration})`;
	const upper = sql`UPPER(${duration})`;

	return or(
		...statuses.map((status) => {
			switch (status) {
				case "upcoming": {
					return sql`${lower} > NOW()::TIMESTAMPTZ`;
				}
				case "open": {
					return sql`${duration} @> NOW()::TIMESTAMPTZ`;
				}
				case "closed": {
					return sql`${upper} <= NOW()::TIMESTAMPTZ`;
				}
			}
		}),
	)!;
}

export async function getOpportunities(db: Database | Transaction, params: GetOpportunitiesParams) {
	const { limit = 10, offset = 0, source, status } = params;
	const statuses = status == null ? [] : Array.isArray(status) ? status : [status];
	const sources = source == null ? [] : Array.isArray(source) ? source : [source];
	const aggregateStatusFilter =
		statuses.length > 0 ? buildStatusFilter(schema.opportunities.duration, statuses) : undefined;
	const aggregateSourceFilter =
		sources.length > 0 ? inArray(schema.opportunitySources.source, sources) : undefined;

	const [items, aggregate] = await Promise.all([
		db.query.opportunities.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
				RAW: statuses.length > 0 ? (t) => buildStatusFilter(t.duration, statuses) : undefined,
				source:
					sources.length > 0
						? {
								source: {
									in: sources,
								},
							}
						: undefined,
			},
			columns: {
				id: true,
				title: true,
				summary: true,
				website: true,
				duration: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
						},
					},
				},
				source: {
					columns: {
						id: true,
						source: true,
					},
				},
			},
			orderBy(t) {
				return [desc(sql`LOWER(${t.duration})`), desc(t.id)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.opportunities)
			.innerJoin(schema.entityVersions, eq(schema.opportunities.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.innerJoin(
				schema.opportunitySources,
				eq(schema.opportunities.sourceId, schema.opportunitySources.id),
			)
			.where(and(aggregateStatusFilter, aggregateSourceFilter)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const duration = serializeDateRange(item.duration);

		return { ...flattenEntityVersion(item), duration };
	});

	return { data, limit, offset, total };
}

//

interface GetOpportunityByIdParams {
	id: schema.Opportunity["id"];
}

export async function getOpportunityById(
	db: Database | Transaction,
	params: GetOpportunityByIdParams,
) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.opportunities.findFirst({
			where: {
				id,
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
				title: true,
				summary: true,
				website: true,
				duration: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
						},
					},
				},
				source: {
					columns: {
						id: true,
						source: true,
					},
				},
			},
		}),
		getContentBlocks(db, id),
	]);

	if (item == null) {
		return null;
	}

	const [relatedEntities, relatedResources] = await Promise.all([
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	const duration = serializeDateRange(item.duration);

	return {
		...flattenEntityVersion(item),
		duration,
		...fields,
		relatedEntities,
		relatedResources,
	};
}

//

interface GetOpportunitySlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getOpportunitySlugs(
	db: Database | Transaction,
	params: GetOpportunitySlugsParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.opportunities.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
						},
					},
				},
			},
			orderBy(t, { desc, sql }) {
				return [desc(sql`"entityVersion"."r" ->> 'updatedAt'`)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.opportunities)
			.innerJoin(schema.entityVersions, eq(schema.opportunities.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map(({ id, entityVersion }) => {
		return { id, entity: { slug: entityVersion.entity.slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetOpportunityBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getOpportunityBySlug(
	db: Database | Transaction,
	params: GetOpportunityBySlugParams,
) {
	const { slug } = params;

	const item = await db.query.opportunities.findFirst({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
				entity: {
					slug,
				},
			},
		},
		columns: {
			id: true,
			title: true,
			summary: true,
			website: true,
			duration: true,
		},
		with: {
			entityVersion: {
				columns: { updatedAt: true },
				with: {
					entity: {
						columns: { slug: true },
					},
				},
			},
			source: {
				columns: {
					id: true,
					source: true,
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const [fields, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	const duration = serializeDateRange(item.duration);

	return {
		...flattenEntityVersion(item),
		duration,
		...fields,
		relatedEntities,
		relatedResources,
	};
}

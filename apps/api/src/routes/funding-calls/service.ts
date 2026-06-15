/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import type { Database, Transaction } from "@/middlewares/db";
import type { FundingCallStatus } from "@/routes/funding-calls/schemas";
import { type SQL, type SQLWrapper, count, desc, eq, or, sql } from "@/services/db/sql";

interface GetFundingCallsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: FundingCallStatus | Array<FundingCallStatus>;
}

function buildStatusFilter(duration: SQLWrapper, statuses: Array<FundingCallStatus>): SQL {
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

export async function getFundingCalls(db: Database | Transaction, params: GetFundingCallsParams) {
	const { limit = 10, offset = 0, status } = params;
	const statuses = status == null ? [] : Array.isArray(status) ? status : [status];
	const aggregateStatusFilter =
		statuses.length > 0 ? buildStatusFilter(schema.fundingCalls.duration, statuses) : undefined;

	const [items, aggregate] = await Promise.all([
		db.query.fundingCalls.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
				RAW: statuses.length > 0 ? (t) => buildStatusFilter(t.duration, statuses) : undefined,
			},
			columns: {
				id: true,
				title: true,
				summary: true,
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
			},
			orderBy(t) {
				return [desc(sql`LOWER(${t.duration})`), desc(t.id)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.fundingCalls)
			.innerJoin(schema.entityVersions, eq(schema.fundingCalls.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(aggregateStatusFilter),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const duration = serializeDateRange(item.duration);

		return { ...flattenEntityVersion(item), duration };
	});

	return { data, limit, offset, total };
}

//

interface GetFundingCallByIdParams {
	id: schema.FundingCall["id"];
}

export async function getFundingCallById(
	db: Database | Transaction,
	params: GetFundingCallByIdParams,
) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.fundingCalls.findFirst({
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

interface GetFundingCallSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getFundingCallSlugs(
	db: Database | Transaction,
	params: GetFundingCallSlugsParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.fundingCalls.findMany({
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
			.from(schema.fundingCalls)
			.innerJoin(schema.entityVersions, eq(schema.fundingCalls.id, schema.entityVersions.id))
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

interface GetFundingCallBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getFundingCallBySlug(
	db: Database | Transaction,
	params: GetFundingCallBySlugParams,
) {
	const { slug } = params;

	const item = await db.query.fundingCalls.findFirst({
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

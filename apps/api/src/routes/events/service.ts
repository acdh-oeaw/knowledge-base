/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl, toImageAsset } from "@/lib/images";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import type { Database, Transaction } from "@/middlewares/db";
import type { EventOrder } from "@/routes/events/schemas";
import { type SQL, and, asc, count, desc, eq, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface GetEventsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	/**
	 * ISO date string (YYYY-MM-DD). Only events whose duration overlaps on or after this date are
	 * returned.
	 */
	from?: string;
	/**
	 * ISO date string (YYYY-MM-DD). Only events whose duration overlaps on or before this date are
	 * returned.
	 */
	until?: string;
	/** Sort order by event start date. Defaults to "asc" when `from` is set, "desc" otherwise. */
	order?: EventOrder;
}

// Overlap condition: event overlaps [from, until] when
//   upper IS NULL OR upper >= from  (event ends on or after the window start, or is open-ended)
//   AND lower < start-of-next-day(until)  (event starts before the window end day is over)
//
// `until` is treated as inclusive of the full day: an event starting on `until` at any time is included.
// To achieve this we use `lower < until + 1 day` rather than `lower <= until` (which would only match midnight).

function durationOverlapsFrom(upper: SQL, from: string): SQL {
	return sql`
		(
			${upper} IS NULL
			OR ${upper} >= ${new Date(from)}
		)
	`;
}

function durationOverlapsUntil(lower: SQL, until: string): SQL {
	const exclusive = new Date(until);
	exclusive.setUTCDate(exclusive.getUTCDate() + 1);
	return sql`${lower} < ${exclusive}`;
}

export async function getEvents(db: Database | Transaction, params: GetEventsParams) {
	const { limit = 10, offset = 0, from, until, order = from != null ? "asc" : "desc" } = params;

	const lower = sql`LOWER(${schema.events.duration})`;
	const upper = sql`UPPER(${schema.events.duration})`;

	const rangeFilter = and(
		from != null ? durationOverlapsFrom(upper, from) : undefined,
		until != null ? durationOverlapsUntil(lower, until) : undefined,
	);

	const orderBy = order === "asc" ? asc(lower) : desc(lower);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.events.id,
				title: schema.events.title,
				summary: schema.events.summary,
				location: schema.events.location,
				duration: schema.events.duration,
				isFullDay: schema.events.isFullDay,
				entity: {
					slug: schema.entities.slug,
				},
				entityVersion: {
					updatedAt: schema.entityVersions.updatedAt,
				},
				image: {
					key: schema.assets.key,
					alt: schema.assets.alt,
					caption: schema.assets.caption,
					licenseName: schema.licenses.name,
					licenseUrl: schema.licenses.url,
				},
			})
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.leftJoin(schema.assets, eq(schema.assets.id, schema.events.imageId))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(rangeFilter)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(rangeFilter),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const image = generateImageUrl(toImageAsset(item.image), imageWidth.preview);
		const duration = serializeDateRange(item.duration);

		const { entityVersion, ...rest } = item;
		return { ...rest, duration, image, publishedAt: entityVersion.updatedAt.toISOString() };
	});

	return { data, limit, offset, total };
}

//

interface GetAdjacentEventsParams {
	id: schema.Event["id"];
	startDate: Date;
}

async function getAdjacentEvents(db: Database | Transaction, params: GetAdjacentEventsParams) {
	const { id, startDate } = params;

	const lower = sql`LOWER(${schema.events.duration})`;

	// Use a (lower, id) tuple cursor so that events sharing the same start timestamp
	// are ordered stably and each correctly identifies the other as prev/next.
	const cursor = sql`
		(
			${lower},
			${schema.events.id}::TEXT
		)
	`;
	const currentCursor = sql`
		(
			${startDate}::TIMESTAMPTZ,
			${id}::TEXT
		)
	`;

	const adjacentColumns = {
		id: schema.events.id,
		title: schema.events.title,
		location: schema.events.location,
		isFullDay: schema.events.isFullDay,
		duration: schema.events.duration,
		entity: {
			slug: schema.entities.slug,
		},
	} as const;

	// oxlint-disable-next-line unicorn/consistent-function-scoping
	function serializeAdjacentEvent(item: {
		id: schema.Event["id"];
		title: schema.Event["title"];
		location: schema.Event["location"];
		isFullDay: schema.Event["isFullDay"];
		duration: schema.Event["duration"];
		entity: {
			slug: schema.Entity["slug"];
		};
	}) {
		return { ...item, duration: serializeDateRange(item.duration) };
	}

	const [prevRows, nextRows] = await Promise.all([
		db
			.select(adjacentColumns)
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(sql`${cursor} < ${currentCursor}`)
			.orderBy(desc(lower), desc(schema.events.id))
			.limit(1),
		db
			.select(adjacentColumns)
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(sql`${cursor} > ${currentCursor}`)
			.orderBy(asc(lower), asc(schema.events.id))
			.limit(1),
	]);

	const prev = prevRows.at(0);
	const next = nextRows.at(0);

	return {
		prev: prev ? serializeAdjacentEvent(prev) : null,
		next: next ? serializeAdjacentEvent(next) : null,
	};
}

//

interface GetEventByIdParams {
	id: schema.Event["id"];
}

export async function getEventById(db: Database | Transaction, params: GetEventByIdParams) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.events.findFirst({
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
				location: true,
				duration: true,
				isFullDay: true,
				website: true,
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
				image: {
					columns: {
						key: true,
						alt: true,
						caption: true,
					},
					with: {
						license: {
							columns: {
								name: true,
								url: true,
							},
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

	const image = generateImageUrl(item.image, imageWidth.featured);
	const duration = serializeDateRange(item.duration);

	const [links, relatedEntities, relatedResources] = await Promise.all([
		getAdjacentEvents(db, { id, startDate: item.duration.start }),
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	return {
		...flattenEntityVersion(item),
		duration,
		image,
		...fields,
		links,
		relatedEntities,
		relatedResources,
	};
}

//

interface GetEventSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getEventSlugs(db: Database | Transaction, params: GetEventSlugsParams) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.events.findMany({
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
				image: {
					columns: {
						key: true,
						alt: true,
						caption: true,
					},
					with: {
						license: {
							columns: {
								name: true,
								url: true,
							},
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
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
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

interface GetEventBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getEventBySlug(db: Database | Transaction, params: GetEventBySlugParams) {
	const { slug } = params;

	const item = await db.query.events.findFirst({
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
			location: true,
			duration: true,
			isFullDay: true,
			website: true,
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
			image: {
				columns: {
					key: true,
					alt: true,
					caption: true,
				},
				with: {
					license: {
						columns: {
							name: true,
							url: true,
						},
					},
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const image = generateImageUrl(item.image, imageWidth.featured);
	const duration = serializeDateRange(item.duration);

	const [fields, links, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getAdjacentEvents(db, { id: item.id, startDate: item.duration.start }),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	return {
		...flattenEntityVersion(item),
		duration,
		image,
		...fields,
		links,
		relatedEntities,
		relatedResources,
	};
}

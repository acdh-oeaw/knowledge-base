/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import {
	generateImageUrl,
	imageAssetColumns,
	toImageAsset,
	withResolvedCaption,
} from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import type { Database, Transaction } from "@/middlewares/db";
import type { EventOrder } from "@/routes/events/schemas";
import { type SQL, alias, and, asc, count, desc, eq, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

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

/**
 * Resolve, per event document, the published version to prefer: the requested/default locale's
 * published version, falling back to the default locale's when the document has no version in the
 * preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still works
 * correctly here — both joins target the same locale and `COALESCE` just picks the (identical)
 * match.
 */
async function resolvePublishedEventsLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, type, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({ where: { type: "events" }, columns: { id: true } }),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(type, "No events entity type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "events_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "events_default_version");

	return {
		localeId,
		defaultLocaleId,
		typeId: type.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

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
	localeId?: string;
}

export async function getEvents(db: Database | Transaction, params: GetEventsParams) {
	const {
		limit = 10,
		offset = 0,
		from,
		until,
		order = from != null ? "asc" : "desc",
		localeId: requestedLocaleId,
	} = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedEventsLookup(db, requestedLocaleId);

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
					slug: schema.slugs.value,
				},
				entityVersion: {
					updatedAt: schema.entityVersions.updatedAt,
				},
				image: {
					key: schema.assets.key,
					alt: schema.assets.alt,
					caption: schema.assets.caption,
					width: schema.assets.width,
					height: schema.assets.height,
					licenseName: schema.licenses.name,
					licenseUrl: schema.licenses.url,
				},
			})
			.from(schema.entities)
			.leftJoin(
				preferredVersion,
				and(
					eq(preferredVersion.entityId, schema.entities.id),
					eq(preferredVersion.localeId, localeId),
					eq(preferredVersion.statusId, statusId),
				),
			)
			.leftJoin(
				defaultVersion,
				and(
					eq(defaultVersion.entityId, schema.entities.id),
					eq(defaultVersion.localeId, defaultLocaleId),
					eq(defaultVersion.statusId, statusId),
				),
			)
			.innerJoin(
				schema.entityVersions,
				sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
			)
			.innerJoin(schema.events, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(schema.assets, eq(schema.assets.id, schema.events.imageId))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(and(eq(schema.entities.typeId, typeId), rangeFilter))
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
	localeId?: string;
}

async function getAdjacentEvents(db: Database | Transaction, params: GetAdjacentEventsParams) {
	const { id, startDate, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedEventsLookup(db, requestedLocaleId);

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
			slug: schema.slugs.value,
		},
	} as const;

	function serializeAdjacentEvent(item: {
		id: schema.Event["id"];
		title: schema.Event["title"];
		location: schema.Event["location"];
		isFullDay: schema.Event["isFullDay"];
		duration: schema.Event["duration"];
		entity: {
			slug: schema.Slug["value"];
		};
	}) {
		return { ...item, duration: serializeDateRange(item.duration) };
	}

	function fromResolvedEvents() {
		return db
			.select(adjacentColumns)
			.from(schema.entities)
			.leftJoin(
				preferredVersion,
				and(
					eq(preferredVersion.entityId, schema.entities.id),
					eq(preferredVersion.localeId, localeId),
					eq(preferredVersion.statusId, statusId),
				),
			)
			.leftJoin(
				defaultVersion,
				and(
					eq(defaultVersion.entityId, schema.entities.id),
					eq(defaultVersion.localeId, defaultLocaleId),
					eq(defaultVersion.statusId, statusId),
				),
			)
			.innerJoin(
				schema.entityVersions,
				sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
			)
			.innerJoin(schema.events, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id));
	}

	const [prevRows, nextRows] = await Promise.all([
		fromResolvedEvents()
			.where(and(eq(schema.entities.typeId, typeId), sql`${cursor} < ${currentCursor}`))
			.orderBy(desc(lower), desc(schema.events.id))
			.limit(1),
		fromResolvedEvents()
			.where(and(eq(schema.entities.typeId, typeId), sql`${cursor} > ${currentCursor}`))
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
				imageCaption: true,
				imageCaptionMode: true,
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
						slug: {
							columns: { value: true },
						},
					},
				},
				image: imageAssetColumns,
			},
		}),
		getContentBlocks(db, id),
	]);

	if (item == null) {
		return null;
	}

	const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.featured);
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
	localeId?: string;
}

export async function getEventSlugs(db: Database | Transaction, params: GetEventSlugsParams) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedEventsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.events.id,
				slug: schema.slugs.value,
			})
			.from(schema.entities)
			.leftJoin(
				preferredVersion,
				and(
					eq(preferredVersion.entityId, schema.entities.id),
					eq(preferredVersion.localeId, localeId),
					eq(preferredVersion.statusId, statusId),
				),
			)
			.leftJoin(
				defaultVersion,
				and(
					eq(defaultVersion.entityId, schema.entities.id),
					eq(defaultVersion.localeId, defaultLocaleId),
					eq(defaultVersion.statusId, statusId),
				),
			)
			.innerJoin(
				schema.entityVersions,
				sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
			)
			.innerJoin(schema.events, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
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

	const data = items.map(({ id, slug }) => {
		return { id, entity: { slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetEventBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getEventBySlug(db: Database | Transaction, params: GetEventBySlugParams) {
	const { slug, localeId } = params;

	const item = await db.query.events.findFirst({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
				slug: {
					value: slug,
					...(localeId != null ? { localeId } : {}),
				},
			},
		},
		columns: {
			imageCaption: true,
			imageCaptionMode: true,
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
					slug: {
						columns: { value: true },
					},
				},
			},
			image: imageAssetColumns,
		},
	});

	if (item == null) {
		return null;
	}

	const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.featured);
	const duration = serializeDateRange(item.duration);

	const [fields, links, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getAdjacentEvents(db, { id: item.id, startDate: item.duration.start, localeId }),
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

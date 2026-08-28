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
import type { FundingCallStatus } from "@/routes/funding-calls/schemas";
import { type SQL, type SQLWrapper, alias, and, count, desc, eq, or, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

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

/**
 * Resolve, per funding call document, the published version to prefer: the requested/default
 * locale's published version, falling back to the default locale's when the document has no version
 * in the preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still
 * works correctly here — both joins target the same locale and `COALESCE` just picks the
 * (identical) match.
 */
async function resolvePublishedFundingCallsLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, type, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({ where: { type: "funding_calls" }, columns: { id: true } }),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(type, "No funding_calls entity type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "funding_calls_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "funding_calls_default_version");

	return {
		localeId,
		defaultLocaleId,
		typeId: type.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

interface GetFundingCallsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: FundingCallStatus | Array<FundingCallStatus>;
	localeId?: string;
}

export async function getFundingCalls(db: Database | Transaction, params: GetFundingCallsParams) {
	const { limit = 10, offset = 0, status, localeId: requestedLocaleId } = params;
	const statuses = status == null ? [] : Array.isArray(status) ? status : [status];
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedFundingCallsLookup(db, requestedLocaleId);
	const statusFilter =
		statuses.length > 0 ? buildStatusFilter(schema.fundingCalls.duration, statuses) : undefined;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.fundingCalls.id,
				title: schema.fundingCalls.title,
				summary: schema.fundingCalls.summary,
				duration: schema.fundingCalls.duration,
				updatedAt: schema.entityVersions.updatedAt,
				slug: schema.slugs.value,
				imageCaption: schema.fundingCalls.imageCaption,
				imageCaptionMode: schema.fundingCalls.imageCaptionMode,
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
			.innerJoin(schema.fundingCalls, eq(schema.fundingCalls.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(schema.assets, eq(schema.assets.id, schema.fundingCalls.imageId))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(and(eq(schema.entities.typeId, typeId), statusFilter))
			.orderBy(desc(sql`LOWER(${schema.fundingCalls.duration})`), desc(schema.fundingCalls.id))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.fundingCalls)
			.innerJoin(schema.entityVersions, eq(schema.fundingCalls.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(statusFilter),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const duration = serializeDateRange(item.duration);

		const image = generateImageUrl(
			withResolvedCaption(toImageAsset(item.image), item),
			imageWidth.preview,
		);

		return {
			id: item.id,
			title: item.title,
			summary: item.summary,
			duration,
			entity: { slug: item.slug },
			publishedAt: item.updatedAt.toISOString(),
			image,
		};
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
				imageCaption: true,
				imageCaptionMode: true,
				id: true,
				title: true,
				summary: true,
				duration: true,
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

	const [relatedEntities, relatedResources] = await Promise.all([
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	const duration = serializeDateRange(item.duration);
	const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		duration,
		image,
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
	localeId?: string;
}

export async function getFundingCallSlugs(
	db: Database | Transaction,
	params: GetFundingCallSlugsParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedFundingCallsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.fundingCalls.id,
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
			.innerJoin(schema.fundingCalls, eq(schema.fundingCalls.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
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

	const data = items.map(({ id, slug }) => {
		return { id, entity: { slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetFundingCallBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getFundingCallBySlug(
	db: Database | Transaction,
	params: GetFundingCallBySlugParams,
) {
	const { slug, localeId } = params;

	const item = await db.query.fundingCalls.findFirst({
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
			duration: true,
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

	const [fields, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	const duration = serializeDateRange(item.duration);
	const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		duration,
		image,
		...fields,
		relatedEntities,
		relatedResources,
	};
}

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
import type { OpportunitySource, OpportunityStatus } from "@/routes/opportunities/schemas";
import {
	type SQL,
	type SQLWrapper,
	alias,
	and,
	count,
	desc,
	eq,
	inArray,
	or,
	sql,
} from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

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

/**
 * Resolve, per opportunity document, the published version to prefer: the requested/default
 * locale's published version, falling back to the default locale's when the document has no version
 * in the preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still
 * works correctly here — both joins target the same locale and `COALESCE` just picks the
 * (identical) match.
 */
async function resolvePublishedOpportunitiesLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, type, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({ where: { type: "opportunities" }, columns: { id: true } }),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(type, "No opportunities entity type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "opportunities_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "opportunities_default_version");

	return {
		localeId,
		defaultLocaleId,
		typeId: type.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

interface GetOpportunitiesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: OpportunityStatus | Array<OpportunityStatus>;
	source?: OpportunitySource | Array<OpportunitySource>;
	localeId?: string;
}

export async function getOpportunities(db: Database | Transaction, params: GetOpportunitiesParams) {
	const { limit = 10, offset = 0, source, status, localeId: requestedLocaleId } = params;
	const statuses = status == null ? [] : Array.isArray(status) ? status : [status];
	const sources = source == null ? [] : Array.isArray(source) ? source : [source];
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedOpportunitiesLookup(db, requestedLocaleId);

	const statusFilter =
		statuses.length > 0 ? buildStatusFilter(schema.opportunities.duration, statuses) : undefined;
	const sourceFilter =
		sources.length > 0 ? inArray(schema.opportunitySources.source, sources) : undefined;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.opportunities.id,
				title: schema.opportunities.title,
				summary: schema.opportunities.summary,
				website: schema.opportunities.website,
				duration: schema.opportunities.duration,
				updatedAt: schema.entityVersions.updatedAt,
				slug: schema.slugs.value,
				sourceId: schema.opportunitySources.id,
				source: schema.opportunitySources.source,
				imageKey: schema.assets.key,
				imageAlt: schema.assets.alt,
				imageWidth: schema.assets.width,
				imageHeight: schema.assets.height,
				assetCaption: schema.assets.caption,
				imageCaption: schema.opportunities.imageCaption,
				imageCaptionMode: schema.opportunities.imageCaptionMode,
				licenseName: schema.licenses.name,
				licenseUrl: schema.licenses.url,
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
			.innerJoin(schema.opportunities, eq(schema.opportunities.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.innerJoin(
				schema.opportunitySources,
				eq(schema.opportunities.sourceId, schema.opportunitySources.id),
			)
			.leftJoin(schema.assets, eq(schema.opportunities.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(and(eq(schema.entities.typeId, typeId), statusFilter, sourceFilter))
			.orderBy(desc(sql`LOWER(${schema.opportunities.duration})`), desc(schema.opportunities.id))
			.limit(limit)
			.offset(offset),
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
			.where(and(statusFilter, sourceFilter)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const duration = serializeDateRange(item.duration);
		const image = generateImageUrl(
			withResolvedCaption(
				toImageAsset({
					key: item.imageKey,
					alt: item.imageAlt,
					caption: item.assetCaption,
					width: item.imageWidth,
					height: item.imageHeight,
					licenseName: item.licenseName,
					licenseUrl: item.licenseUrl,
				}),
				{ imageCaption: item.imageCaption, imageCaptionMode: item.imageCaptionMode },
			),
			imageWidth.preview,
		);

		return {
			id: item.id,
			title: item.title,
			summary: item.summary,
			website: item.website,
			duration,
			entity: { slug: item.slug },
			publishedAt: item.updatedAt.toISOString(),
			source: { id: item.sourceId, source: item.source },
			image,
		};
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
				imageCaption: true,
				imageCaptionMode: true,
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
						slug: {
							columns: { value: true },
						},
					},
				},
				image: imageAssetColumns,
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

interface GetOpportunitySlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getOpportunitySlugs(
	db: Database | Transaction,
	params: GetOpportunitySlugsParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedOpportunitiesLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.opportunities.id,
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
			.innerJoin(schema.opportunities, eq(schema.opportunities.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
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

	const data = items.map(({ id, slug }) => {
		return { id, entity: { slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetOpportunityBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getOpportunityBySlug(
	db: Database | Transaction,
	params: GetOpportunityBySlugParams,
) {
	const { slug, localeId } = params;

	const item = await db.query.opportunities.findFirst({
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
			website: true,
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

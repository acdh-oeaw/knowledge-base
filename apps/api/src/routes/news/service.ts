/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl, toImageAsset } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, count, desc, eq, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

/**
 * Resolve, per news document, the published version to prefer: the requested/default locale's
 * published version, falling back to the default locale's when the document has no version in the
 * preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still works
 * correctly here — both joins target the same locale and `COALESCE` just picks the (identical)
 * match.
 */
async function resolvePublishedNewsLookup(db: Database | Transaction, requestedLocaleId?: string) {
	const [{ localeId, defaultLocaleId }, type, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({ where: { type: "news" }, columns: { id: true } }),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(type, "No news entity type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "news_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "news_default_version");

	return {
		localeId,
		defaultLocaleId,
		typeId: type.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

interface GetNewsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getNews(db: Database | Transaction, params: GetNewsParams) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedNewsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.news.id,
				title: schema.news.title,
				summary: schema.news.summary,
				updatedAt: schema.entityVersions.updatedAt,
				slug: schema.slugs.value,
				imageKey: schema.assets.key,
				imageAlt: schema.assets.alt,
				imageCaption: schema.assets.caption,
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
			.innerJoin(schema.news, eq(schema.news.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(schema.assets, eq(schema.news.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.news)
			.innerJoin(schema.entityVersions, eq(schema.news.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const image = generateImageUrl(
			toImageAsset({
				key: item.imageKey,
				alt: item.imageAlt,
				caption: item.imageCaption,
				licenseName: item.licenseName,
				licenseUrl: item.licenseUrl,
			}),
			imageWidth.preview,
		);

		return {
			id: item.id,
			title: item.title,
			summary: item.summary,
			entity: { slug: item.slug },
			publishedAt: item.updatedAt.toISOString(),
			image,
		};
	});

	return { data, limit, offset, total };
}

//

interface GetNewsItemByIdParams {
	id: schema.NewsItem["id"];
}

export async function getNewsItemById(db: Database | Transaction, params: GetNewsItemByIdParams) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.news.findFirst({
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

	const [relatedEntities, relatedResources] = await Promise.all([
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	const image = generateImageUrl(item.image, imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		image,
		...fields,
		relatedEntities,
		relatedResources,
	};
}

//

interface GetNewsItemSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getNewsItemSlugs(db: Database | Transaction, params: GetNewsItemSlugsParams) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedNewsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.news.id,
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
			.innerJoin(schema.news, eq(schema.news.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.news)
			.innerJoin(schema.entityVersions, eq(schema.news.id, schema.entityVersions.id))
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

interface GetNewsItemBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getNewsItemBySlug(
	db: Database | Transaction,
	params: GetNewsItemBySlugParams,
) {
	const { slug, localeId } = params;

	const item = await db.query.news.findFirst({
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
			id: true,
			title: true,
			summary: true,
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

	const [fields, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	return {
		...flattenEntityVersion(item),
		image,
		...fields,
		relatedEntities,
		relatedResources,
	};
}

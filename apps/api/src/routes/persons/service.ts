/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import {
	generateImageUrl,
	imageAssetColumns,
	toImageAsset,
	withResolvedCaption,
} from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import {
	getPersonArticles,
	getPersonPositions,
	mapPersonSocialMedia,
	personSocialMediaQuery,
} from "@/lib/persons";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, count, desc, eq, inArray, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

/**
 * Resolve, per person document, the published version to prefer: the requested/default locale's
 * published version, falling back to the default locale's when the document has no version in the
 * preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still works
 * correctly here — both joins target the same locale and `COALESCE` just picks the (identical)
 * match.
 */
async function resolvePublishedPersonsLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, type, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({ where: { type: "persons" }, columns: { id: true } }),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(type, "No persons entity type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "persons_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "persons_default_version");

	return {
		localeId,
		defaultLocaleId,
		typeId: type.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

/**
 * Batched, per-person-version social media lookup — persons are a to-many relation, so this can't
 * be folded into the flat row select above without fanning it out.
 */
async function getPersonSocialMediaByPersonIds(
	db: Database | Transaction,
	personIds: Array<string>,
) {
	const map = new Map<
		string,
		Array<{ type: { type: string }; url: string; label: string | null }>
	>();

	if (personIds.length === 0) {
		return map;
	}

	const rows = await db
		.select({
			personId: schema.personSocialMedia.personId,
			url: schema.personSocialMedia.url,
			label: schema.personSocialMedia.label,
			type: schema.personSocialMediaTypes.type,
		})
		.from(schema.personSocialMedia)
		.innerJoin(
			schema.personSocialMediaTypes,
			eq(schema.personSocialMediaTypes.id, schema.personSocialMedia.typeId),
		)
		.where(inArray(schema.personSocialMedia.personId, personIds))
		.orderBy(schema.personSocialMedia.position);

	for (const row of rows) {
		const items = map.get(row.personId) ?? [];
		items.push({ type: { type: row.type }, url: row.url, label: row.label });
		map.set(row.personId, items);
	}

	return map;
}

interface GetPersonsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getPersons(db: Database | Transaction, params: GetPersonsParams) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedPersonsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.persons.id,
				name: schema.persons.name,
				sortName: schema.persons.sortName,
				email: schema.persons.email,
				orcid: schema.persons.orcid,
				updatedAt: schema.entityVersions.updatedAt,
				slug: schema.slugs.value,
				imageKey: schema.assets.key,
				imageAlt: schema.assets.alt,
				imageWidth: schema.assets.width,
				imageHeight: schema.assets.height,
				assetCaption: schema.assets.caption,
				imageCaption: schema.persons.imageCaption,
				imageCaptionMode: schema.persons.imageCaptionMode,
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
			.innerJoin(schema.persons, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(schema.assets, eq(schema.persons.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;
	const [positions, socialMediaMap] = await Promise.all([
		getPersonPositions(
			db,
			items.map((item) => item.id),
		),
		getPersonSocialMediaByPersonIds(
			db,
			items.map((item) => item.id),
		),
	]);

	const data = items.map((item) => {
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
			imageWidth.avatar,
		);

		return {
			id: item.id,
			name: item.name,
			sortName: item.sortName,
			email: item.email,
			orcid: item.orcid,
			entity: { slug: item.slug },
			publishedAt: item.updatedAt.toISOString(),
			positions: positions.get(item.id) ?? null,
			image,
			socialMedia: mapPersonSocialMedia(socialMediaMap.get(item.id) ?? []),
		};
	});

	return { data, limit, offset, total };
}

//

interface GetPersonByIdParams {
	id: schema.Person["id"];
}

export async function getPersonById(db: Database | Transaction, params: GetPersonByIdParams) {
	const { id } = params;

	const [item, fields, articles] = await Promise.all([
		db.query.persons.findFirst({
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
				name: true,
				sortName: true,
				email: true,
				orcid: true,
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
				socialMedia: personSocialMediaQuery,
			},
		}),
		getContentBlocks(db, id),
		getPersonArticles(db, id),
	]);

	if (item == null) {
		return null;
	}

	const [positions, formerPositions] = await Promise.all([
		getPersonPositions(db, [item.id]),
		getPersonPositions(db, [item.id], { when: "former" }),
	]);

	const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		positions: positions.get(item.id) ?? null,
		formerPositions: formerPositions.get(item.id) ?? null,
		image,
		socialMedia: mapPersonSocialMedia(item.socialMedia),
		...fields,
		articles,
	};
}

//

interface GetPersonSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getPersonSlugs(db: Database | Transaction, params: GetPersonSlugsParams) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedPersonsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.persons.id,
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
			.innerJoin(schema.persons, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
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

interface GetPersonBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getPersonBySlug(db: Database | Transaction, params: GetPersonBySlugParams) {
	const { slug, localeId } = params;

	const item = await db.query.persons.findFirst({
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
			name: true,
			sortName: true,
			email: true,
			orcid: true,
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
			socialMedia: personSocialMediaQuery,
		},
	});

	if (item == null) {
		return null;
	}

	const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.featured);

	const [positions, formerPositions, fields, articles] = await Promise.all([
		getPersonPositions(db, [item.id]),
		getPersonPositions(db, [item.id], { when: "former" }),
		getContentBlocks(db, item.id),
		getPersonArticles(db, item.id),
	]);

	return {
		...flattenEntityVersion(item),
		positions: positions.get(item.id) ?? null,
		formerPositions: formerPositions.get(item.id) ?? null,
		image,
		socialMedia: mapPersonSocialMedia(item.socialMedia),
		...fields,
		articles,
	};
}

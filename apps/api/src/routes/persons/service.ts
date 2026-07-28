/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl, toImageAsset } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import { getPersonPositions } from "@/lib/persons";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, count, desc, eq, sql } from "@/services/db/sql";
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
	const positions = await getPersonPositions(
		db,
		items.map((item) => item.id),
	);

	const data = items.map((item) => {
		const image = generateImageUrl(
			toImageAsset({
				key: item.imageKey,
				alt: item.imageAlt,
				caption: item.imageCaption,
				licenseName: item.licenseName,
				licenseUrl: item.licenseUrl,
			}),
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
			position: positions.get(item.id) ?? null,
			image,
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

	const [item, fields] = await Promise.all([
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

	const positions = await getPersonPositions(db, [item.id]);

	const image = generateImageUrl(item.image, imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		position: positions.get(item.id) ?? null,
		image,
		...fields,
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

	const positions = await getPersonPositions(db, [item.id]);

	const image = generateImageUrl(item.image, imageWidth.featured);

	const fields = await getContentBlocks(db, item.id);

	return {
		...flattenEntityVersion(item),
		position: positions.get(item.id) ?? null,
		image,
		...fields,
	};
}

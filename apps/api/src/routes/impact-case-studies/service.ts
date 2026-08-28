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
import { getPersonPositions } from "@/lib/persons";
import { getRelatedEntities, getRelatedResources, resolveDocumentId } from "@/lib/relations";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, count, desc, eq, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

/**
 * Resolve, per impact case study document, the published version to prefer: the requested/default
 * locale's published version, falling back to the default locale's when the document has no version
 * in the preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still
 * works correctly here — both joins target the same locale and `COALESCE` just picks the
 * (identical) match.
 */
async function resolvePublishedImpactCaseStudiesLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, type, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({
			where: { type: "impact_case_studies" },
			columns: { id: true },
		}),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(type, "No impact_case_studies entity type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "impact_case_studies_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "impact_case_studies_default_version");

	return {
		localeId,
		defaultLocaleId,
		typeId: type.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

interface GetImpactCaseStudiesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getImpactCaseStudies(
	db: Database | Transaction,
	params: GetImpactCaseStudiesParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedImpactCaseStudiesLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.impactCaseStudies.id,
				title: schema.impactCaseStudies.title,
				summary: schema.impactCaseStudies.summary,
				publicationDate: schema.impactCaseStudies.publicationDate,
				slug: schema.slugs.value,
				imageCaption: schema.impactCaseStudies.imageCaption,
				imageCaptionMode: schema.impactCaseStudies.imageCaptionMode,
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
			.innerJoin(
				schema.impactCaseStudies,
				eq(schema.impactCaseStudies.id, schema.entityVersions.id),
			)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(schema.assets, eq(schema.impactCaseStudies.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.impactCaseStudies)
			.innerJoin(schema.entityVersions, eq(schema.impactCaseStudies.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const image = generateImageUrl(
			withResolvedCaption(toImageAsset(item.image), item),
			imageWidth.preview,
		);

		return {
			id: item.id,
			title: item.title,
			summary: item.summary,
			entity: { slug: item.slug },
			publishedAt: item.publicationDate.toISOString(),
			image,
		};
	});

	return { data, limit, offset, total };
}

//

interface GetImpactCaseStudyByIdParams {
	id: schema.ImpactCaseStudy["id"];
}

async function getContributors(db: Database | Transaction, impactCaseStudyId: string) {
	// Contributors are document-level. Resolve the person endpoint (a document id) to its published
	// version for its name/slug/image, and match the case study by document (impactCaseStudyId is a
	// published case study version id, resolved to its document id once here).
	const impactCaseStudyDocumentId = await resolveDocumentId(db, impactCaseStudyId);
	const rows = await db
		.select({
			id: schema.persons.id,
			name: schema.persons.name,
			slug: schema.slugs.value,
			imageKey: schema.assets.key,
			imageWidth: schema.assets.width,
			imageHeight: schema.assets.height,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			personImageCaption: schema.persons.imageCaption,
			personImageCaptionMode: schema.persons.imageCaptionMode,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
			role: schema.impactCaseStudiesToPersons.role,
		})
		.from(schema.impactCaseStudiesToPersons)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.impactCaseStudiesToPersons.personDocumentId),
		)
		.innerJoin(schema.persons, eq(schema.persons.id, schema.documentLifecycle.publishedId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.documentLifecycle.publishedId))
		.leftJoin(schema.assets, eq(schema.persons.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.where(
			eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, impactCaseStudyDocumentId),
		);

	const positions = await getPersonPositions(
		db,
		rows.map((row) => row.id),
	);

	return rows.map(
		({
			imageKey,
			imageAlt,
			imageCaption,
			imageWidth: imageSourceWidth,
			imageHeight: imageSourceHeight,
			personImageCaption,
			personImageCaptionMode,
			licenseName,
			licenseUrl,
			...row
		}) => {
			return {
				...row,
				positions: positions.get(row.id) ?? null,
				image: generateImageUrl(
					withResolvedCaption(
						toImageAsset({
							key: imageKey,
							alt: imageAlt,
							caption: imageCaption,
							width: imageSourceWidth,
							height: imageSourceHeight,
							licenseName,
							licenseUrl,
						}),
						{ imageCaption: personImageCaption, imageCaptionMode: personImageCaptionMode },
					),
					imageWidth.avatar,
				),
			};
		},
	);
}

//

export async function getImpactCaseStudyById(
	db: Database | Transaction,
	params: GetImpactCaseStudyByIdParams,
) {
	const { id } = params;

	const [item, fields, contributors] = await Promise.all([
		db.query.impactCaseStudies.findFirst({
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
				publicationDate: true,
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
				image: imageAssetColumns,
			},
		}),
		getContentBlocks(db, id),
		getContributors(db, id),
	]);

	if (item == null) {
		return null;
	}

	const [relatedEntities, relatedResources] = await Promise.all([
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.featured);
	const { publicationDate, ...data } = flattenEntityVersion(item);

	return {
		...data,
		contributors,
		image,
		publishedAt: publicationDate.toISOString(),
		...fields,
		relatedEntities,
		relatedResources,
	};
}

//

interface GetImpactCaseStudySlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getImpactCaseStudySlugs(
	db: Database | Transaction,
	params: GetImpactCaseStudySlugsParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedImpactCaseStudiesLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.impactCaseStudies.id,
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
			.innerJoin(
				schema.impactCaseStudies,
				eq(schema.impactCaseStudies.id, schema.entityVersions.id),
			)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.impactCaseStudies)
			.innerJoin(schema.entityVersions, eq(schema.impactCaseStudies.id, schema.entityVersions.id))
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

interface GetImpactCaseStudyBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getImpactCaseStudyBySlug(
	db: Database | Transaction,
	params: GetImpactCaseStudyBySlugParams,
) {
	const { slug, localeId } = params;

	const item = await db.query.impactCaseStudies.findFirst({
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
			publicationDate: true,
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
			image: imageAssetColumns,
		},
	});

	if (item == null) {
		return null;
	}

	const contributors = await getContributors(db, item.id);

	const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.featured);
	const { publicationDate, ...data } = flattenEntityVersion(item);

	const [fields, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	return {
		...data,
		contributors,
		image,
		publishedAt: publicationDate.toISOString(),
		...fields,
		relatedEntities,
		relatedResources,
	};
}

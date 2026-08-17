/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl, toImageAsset } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import { getPersonPositions } from "@/lib/persons";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import { mapSocialMedia } from "@/lib/social-media";
import type { Database, Transaction } from "@/middlewares/db";
import {
	type SQLWrapper,
	alias,
	and,
	count,
	desc,
	eq,
	exists,
	inArray,
	not,
	sql,
} from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

function buildStatusFilter(
	db: Database | Transaction,
	idRef: SQLWrapper,
	status: "active" | "inactive",
) {
	const durationContainsNow = sql`
		${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ
	`;
	const durationCondition = status === "active" ? durationContainsNow : not(durationContainsNow);

	// Unit↔unit relations are document-level; idRef is the working group's version id, resolved to
	// its document id, and the related eric is reached through any of its versions.
	const relatedUnitVersion = alias(schema.entityVersions, "wg_status_related_version");
	const relatedSlug = alias(schema.slugs, "wg_status_related_slug");

	return exists(
		db
			.select({ one: sql<number>`1` })
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitsRelations.status, schema.organisationalUnitStatus.id),
			)
			.innerJoin(
				relatedUnitVersion,
				eq(relatedUnitVersion.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
			)
			.innerJoin(relatedSlug, eq(relatedSlug.entityVersionId, relatedUnitVersion.id))
			.innerJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, relatedUnitVersion.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnitsRelations.unitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${idRef})`,
					eq(schema.organisationalUnitStatus.status, "is_part_of"),
					eq(schema.organisationalUnitTypes.type, "eric"),
					eq(relatedSlug.value, "dariah-eu"),
					durationCondition,
				),
			),
	);
}

/**
 * Resolve, per working-group document, the published version to prefer: the requested/default
 * locale's published version, falling back to the default locale's when the document has no version
 * in the preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still
 * works correctly here — both joins target the same locale and `COALESCE` just picks the
 * (identical) match.
 */
async function resolvePublishedWorkingGroupsLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, entityType, workingGroupType, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({
			where: { type: "organisational_units" },
			columns: { id: true },
		}),
		db.query.organisationalUnitTypes.findFirst({
			where: { type: "working_group" },
			columns: { id: true },
		}),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(entityType, "No organisational_units entity type in database.");
	assert(workingGroupType, "No working_group type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "working_groups_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "working_groups_default_version");

	return {
		localeId,
		defaultLocaleId,
		entityTypeId: entityType.id,
		workingGroupTypeId: workingGroupType.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

async function getSocialMediaByUnitVersionId(
	db: Database | Transaction,
	unitVersionIds: Array<string>,
) {
	const socialMediaByUnitId = new Map<
		string,
		Array<{
			id: string;
			name: string | null;
			url: string;
			duration: { start: Date; end?: Date | null } | null;
			type: { type: string };
		}>
	>();

	if (unitVersionIds.length === 0) {
		return socialMediaByUnitId;
	}

	const rows = await db
		.select({
			unitId: schema.organisationalUnitsToSocialMedia.organisationalUnitId,
			id: schema.socialMedia.id,
			name: schema.socialMedia.name,
			url: schema.socialMedia.url,
			duration: schema.socialMedia.duration,
			type: schema.socialMediaTypes.type,
		})
		.from(schema.organisationalUnitsToSocialMedia)
		.innerJoin(
			schema.socialMedia,
			eq(schema.socialMedia.id, schema.organisationalUnitsToSocialMedia.socialMediaId),
		)
		.innerJoin(schema.socialMediaTypes, eq(schema.socialMediaTypes.id, schema.socialMedia.typeId))
		.where(inArray(schema.organisationalUnitsToSocialMedia.organisationalUnitId, unitVersionIds));

	for (const row of rows) {
		const list = socialMediaByUnitId.get(row.unitId) ?? [];
		list.push({
			id: row.id,
			name: row.name,
			url: row.url,
			duration: row.duration,
			type: { type: row.type },
		});
		socialMediaByUnitId.set(row.unitId, list);
	}

	return socialMediaByUnitId;
}

interface GetWorkingGroupsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: "active" | "inactive";
	localeId?: string;
}

export async function getWorkingGroups(db: Database | Transaction, params: GetWorkingGroupsParams) {
	const { limit = 10, offset = 0, status, localeId: requestedLocaleId } = params;
	const {
		localeId,
		defaultLocaleId,
		entityTypeId,
		workingGroupTypeId,
		statusId,
		preferredVersion,
		defaultVersion,
	} = await resolvePublishedWorkingGroupsLookup(db, requestedLocaleId);

	// `buildStatusFilter` embeds `idRef` inside its own `FROM entity_versions WHERE entity_versions.id
	// = idRef` scalar subquery — passing the bare (unaliased) `schema.entityVersions.id` here would
	// shadow itself inside that subquery (the inner `FROM entity_versions` wins), turning the
	// correlation into a self-referential tautology that matches every row and makes the scalar
	// subquery blow up with "more than one row returned". Alias each query's resolved version to keep
	// it a distinct identifier so it correlates correctly instead. The items and aggregate queries
	// each need their own alias since they're separate query builders with their own joins.
	const itemsResolvedVersion = alias(schema.entityVersions, "wg_items_resolved_version");
	const aggregateResolvedVersion = alias(schema.entityVersions, "wg_aggregate_resolved_version");

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.organisationalUnits.id,
				acronym: schema.organisationalUnits.acronym,
				metadata: schema.organisationalUnits.metadata,
				name: schema.organisationalUnits.name,
				summary: schema.organisationalUnits.summary,
				sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
				updatedAt: itemsResolvedVersion.updatedAt,
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
				itemsResolvedVersion,
				sql`${itemsResolvedVersion.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
			)
			.innerJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, itemsResolvedVersion.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, itemsResolvedVersion.id))
			.leftJoin(schema.assets, eq(schema.organisationalUnits.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(
				and(
					eq(schema.entities.typeId, entityTypeId),
					eq(schema.organisationalUnits.typeId, workingGroupTypeId),
					status != null ? buildStatusFilter(db, itemsResolvedVersion.id, status) : undefined,
				),
			)
			.orderBy(desc(itemsResolvedVersion.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.organisationalUnits)
			.innerJoin(
				aggregateResolvedVersion,
				eq(schema.organisationalUnits.id, aggregateResolvedVersion.id),
			)
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, aggregateResolvedVersion.id),
			)
			.where(
				and(
					eq(schema.organisationalUnits.typeId, workingGroupTypeId),
					status != null ? buildStatusFilter(db, aggregateResolvedVersion.id, status) : undefined,
				),
			),
	]);

	const socialMediaByUnitId = await getSocialMediaByUnitVersionId(
		db,
		items.map((item) => item.id),
	);

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
		const socialMedia = mapSocialMedia(socialMediaByUnitId.get(item.id) ?? []);

		return {
			id: item.id,
			acronym: item.acronym,
			metadata: item.metadata,
			name: item.name,
			summary: item.summary,
			sshocMarketplaceActorId: item.sshocMarketplaceActorId,
			entity: { slug: item.slug },
			publishedAt: item.updatedAt.toISOString(),
			image,
			socialMedia,
		};
	});

	return { data, limit, offset, total };
}

//

interface GetWorkingGroupByIdParams {
	id: schema.OrganisationalUnit["id"];
}

async function getChairs(db: Database | Transaction, workingGroupId: string) {
	const rows = await db
		.select({
			id: schema.persons.id,
			name: schema.persons.name,
			slug: schema.slugs.value,
			imageKey: schema.assets.key,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
			roleType: schema.personRoleTypes.type,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personsToOrganisationalUnits.roleTypeId, schema.personRoleTypes.id),
		)
		// person↔org relations are document-level; resolve the person to its published version and
		// match the working group by its document id (workingGroupId is a published org version id).
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(schema.persons, eq(schema.persons.id, schema.documentLifecycle.publishedId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.documentLifecycle.publishedId))
		.leftJoin(schema.assets, eq(schema.persons.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.where(
			and(
				sql`${schema.personsToOrganisationalUnits.organisationalUnitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${workingGroupId})`,
				eq(schema.personRoleTypes.type, "is_chair_of"),
				sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
			),
		);

	const positions = await getPersonPositions(
		db,
		rows.map((row) => row.id),
	);

	return rows.map(
		({ imageKey, imageAlt, imageCaption, licenseName, licenseUrl, roleType, ...row }) => {
			return {
				...row,
				position: positions.get(row.id) ?? null,
				role: roleType,
				image: generateImageUrl(
					toImageAsset({
						key: imageKey,
						alt: imageAlt,
						caption: imageCaption,
						licenseName,
						licenseUrl,
					}),
					imageWidth.avatar,
				),
			};
		},
	);
}

//

export async function getWorkingGroupById(
	db: Database | Transaction,
	params: GetWorkingGroupByIdParams,
) {
	const { id } = params;

	const [item, fields, chairs] = await Promise.all([
		db.query.workingGroups.findFirst({
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
				acronym: true,
				metadata: true,
				name: true,
				summary: true,
				sshocMarketplaceActorId: true,
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
				socialMedia: {
					columns: {
						id: true,
						name: true,
						url: true,
						duration: true,
					},
					with: {
						type: {
							columns: {
								type: true,
							},
						},
					},
				},
			},
		}),
		getContentBlocks(db, id),
		getChairs(db, id),
	]);

	if (item == null) {
		return null;
	}

	const image = generateImageUrl(item.image, imageWidth.featured);
	const socialMedia = mapSocialMedia(item.socialMedia);

	const [relatedEntities, relatedResources] = await Promise.all([
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	return {
		...flattenEntityVersion(item),
		image,
		socialMedia,
		...fields,
		chairs,
		relatedEntities,
		relatedResources,
	};
}

//

interface GetWorkingGroupSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getWorkingGroupSlugs(
	db: Database | Transaction,
	params: GetWorkingGroupSlugsParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const {
		localeId,
		defaultLocaleId,
		entityTypeId,
		workingGroupTypeId,
		statusId,
		preferredVersion,
		defaultVersion,
	} = await resolvePublishedWorkingGroupsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.organisationalUnits.id,
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
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, schema.entityVersions.id),
			)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(
				and(
					eq(schema.entities.typeId, entityTypeId),
					eq(schema.organisationalUnits.typeId, workingGroupTypeId),
				),
			)
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(eq(schema.organisationalUnits.typeId, workingGroupTypeId)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map(({ id, slug }) => {
		return { id, entity: { slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetWorkingGroupBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getWorkingGroupBySlug(
	db: Database | Transaction,
	params: GetWorkingGroupBySlugParams,
) {
	const { slug, localeId } = params;

	const entityVersionRow = await db.query.entityVersions.findFirst({
		where: {
			status: {
				type: "published",
			},
			slug: {
				value: slug,
				...(localeId != null ? { localeId } : {}),
			},
		},
		columns: { id: true },
	});

	if (entityVersionRow == null) {
		return null;
	}

	return getWorkingGroupById(db, { id: entityVersionRow.id });
}

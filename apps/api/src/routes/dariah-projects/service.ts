/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import { type ImageAsset, generateImageUrl, imageAssetColumns, toImageAsset } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import {
	getPublishedProjectPartners,
	getPublishedProjectPartnersByDocuments,
} from "@/lib/project-partners";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import { socialMediaByPosition } from "@/lib/social-media";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, count, desc, eq, inArray, not, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

function mapItem<
	T extends {
		image: ImageAsset | null;
		socialMedia: Array<{
			id: string;
			url: string;
			type: { type: string };
		}>;
		entityVersion: { updatedAt: Date; slug: { value: string } | null };
		duration: { start: Date; end?: Date };
	},
>(item: T, width: number) {
	const image = generateImageUrl(item.image, width);
	const duration = serializeDateRange(item.duration);

	const socialMedia = item.socialMedia.map((sm) => {
		return {
			...sm,
			type: sm.type.type,
		};
	});

	return {
		...flattenEntityVersion(item),
		duration,
		image,
		socialMedia,
	};
}

/**
 * Resolve, per DARIAH project document, the published version to prefer: the requested/default
 * locale's published version, falling back to the default locale's when the document has no version
 * in the preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still
 * works correctly here — both joins target the same locale and `COALESCE` just picks the
 * (identical) match.
 */
async function resolvePublishedDariahProjectsLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, type, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({ where: { type: "projects" }, columns: { id: true } }),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(type, "No projects entity type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "dariah_projects_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "dariah_projects_default_version");

	return {
		localeId,
		defaultLocaleId,
		typeId: type.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

async function getSocialMediaByProjectVersionId(
	db: Database | Transaction,
	projectVersionIds: Array<string>,
) {
	const socialMediaByProjectId = new Map<
		string,
		Array<{ id: string; url: string; type: { type: string } }>
	>();

	if (projectVersionIds.length === 0) {
		return socialMediaByProjectId;
	}

	const rows = await db
		.select({
			projectId: schema.projectsToSocialMedia.projectId,
			id: schema.socialMedia.id,
			url: schema.socialMedia.url,
			type: schema.socialMediaTypes.type,
		})
		.from(schema.projectsToSocialMedia)
		.innerJoin(
			schema.socialMedia,
			eq(schema.socialMedia.id, schema.projectsToSocialMedia.socialMediaId),
		)
		.innerJoin(schema.socialMediaTypes, eq(schema.socialMediaTypes.id, schema.socialMedia.typeId))
		.where(inArray(schema.projectsToSocialMedia.projectId, projectVersionIds));

	for (const row of rows) {
		const list = socialMediaByProjectId.get(row.projectId) ?? [];
		list.push({ id: row.id, url: row.url, type: { type: row.type } });
		socialMediaByProjectId.set(row.projectId, list);
	}

	return socialMediaByProjectId;
}

//

interface GetDariahProjectsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: "active" | "inactive";
	localeId?: string;
}

export async function getDariahProjects(
	db: Database | Transaction,
	params: GetDariahProjectsParams,
) {
	const { limit = 10, offset = 0, status, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedDariahProjectsLookup(db, requestedLocaleId);

	const statusFilter =
		status != null
			? status === "active"
				? sql`${schema.dariahProjects.duration} @> NOW()::TIMESTAMPTZ`
				: not(sql`${schema.dariahProjects.duration} @> NOW()::TIMESTAMPTZ`)
			: undefined;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.dariahProjects.id,
				documentId: schema.entities.id,
				name: schema.dariahProjects.name,
				acronym: schema.dariahProjects.acronym,
				summary: schema.dariahProjects.summary,
				duration: schema.dariahProjects.duration,
				call: schema.projectCalls.call,
				topic: schema.dariahProjects.topic,
				funding: schema.dariahProjects.funding,
				updatedAt: schema.entityVersions.updatedAt,
				slug: schema.slugs.value,
				scope: schema.projectScopes.scope,
				imageKey: schema.assets.key,
				imageWidth: schema.assets.width,
				imageHeight: schema.assets.height,
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
			.innerJoin(schema.dariahProjects, eq(schema.dariahProjects.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.innerJoin(schema.projectScopes, eq(schema.projectScopes.id, schema.dariahProjects.scopeId))
			.leftJoin(schema.projectCalls, eq(schema.projectCalls.id, schema.dariahProjects.callId))
			.leftJoin(schema.assets, eq(schema.dariahProjects.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(and(eq(schema.entities.typeId, typeId), statusFilter))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.dariahProjects)
			.innerJoin(schema.entityVersions, eq(schema.dariahProjects.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(statusFilter),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const [partnersByDocument, socialMediaByProjectId] = await Promise.all([
		getPublishedProjectPartnersByDocuments(
			db,
			items.map((item) => item.documentId),
		),
		getSocialMediaByProjectVersionId(
			db,
			items.map((item) => item.id),
		),
	]);

	const data = items.map((item) => {
		const partners = partnersByDocument.get(item.documentId) ?? [];
		const role =
			partners.find((r) => r.unit.type === "eric" && r.unit.slug === "dariah-eu")?.role.role ??
			null;

		const image = generateImageUrl(
			toImageAsset({
				key: item.imageKey,
				alt: item.imageAlt,
				caption: item.imageCaption,
				width: item.imageWidth,
				height: item.imageHeight,
				licenseName: item.licenseName,
				licenseUrl: item.licenseUrl,
			}),
			imageWidth.preview,
		);

		const socialMedia = (socialMediaByProjectId.get(item.id) ?? []).map((sm) => {
			return { ...sm, type: sm.type.type };
		});

		const duration = serializeDateRange(item.duration);

		return {
			id: item.id,
			name: item.name,
			acronym: item.acronym,
			summary: item.summary,
			call: item.call != null ? { call: item.call } : null,
			topic: item.topic,
			funding: item.funding,
			duration,
			entity: { slug: item.slug },
			scope: { scope: item.scope },
			socialMedia,
			publishedAt: item.updatedAt.toISOString(),
			image,
			role,
		};
	});

	return { data, limit, offset, total };
}

//

interface GetDariahProjectByIdParams {
	id: schema.Project["id"];
}

export async function getDariahProjectById(
	db: Database | Transaction,
	params: GetDariahProjectByIdParams,
) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.dariahProjects.findFirst({
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
				acronym: true,
				summary: true,
				duration: true,
				topic: true,
				funding: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { id: true },
						},
						slug: {
							columns: { value: true },
						},
					},
				},
				image: imageAssetColumns,
				scope: {
					columns: {
						scope: true,
					},
				},
				call: {
					columns: {
						call: true,
					},
				},
				socialMedia: {
					...socialMediaByPosition,
					columns: {
						id: true,
						url: true,
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
	]);

	if (item == null) {
		return null;
	}

	const [relatedEntities, relatedResources] = await Promise.all([
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	const projectPartners = await getPublishedProjectPartners(db, item.entityVersion.entity.id);
	const rest = item;

	const participants = projectPartners
		.filter((r) => r.role.role === "participant")
		.map((r) => r.unit);

	const coordinators = projectPartners
		.filter((r) => r.role.role === "coordinator")
		.map((r) => r.unit);

	return {
		...mapItem(rest, imageWidth.featured),
		...fields,
		participants,
		coordinators,
		relatedEntities,
		relatedResources,
	};
}

//

interface GetDariahProjectSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getDariahProjectSlugs(
	db: Database | Transaction,
	params: GetDariahProjectSlugsParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedDariahProjectsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.dariahProjects.id,
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
			.innerJoin(schema.dariahProjects, eq(schema.dariahProjects.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.dariahProjects)
			.innerJoin(schema.entityVersions, eq(schema.dariahProjects.id, schema.entityVersions.id))
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

interface GetDariahProjectBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getDariahProjectBySlug(
	db: Database | Transaction,
	params: GetDariahProjectBySlugParams,
) {
	const { slug, localeId } = params;

	const item = await db.query.dariahProjects.findFirst({
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
			acronym: true,
			summary: true,
			duration: true,
			topic: true,
			funding: true,
		},
		with: {
			entityVersion: {
				columns: { updatedAt: true },
				with: {
					entity: {
						columns: { id: true },
					},
					slug: {
						columns: { value: true },
					},
				},
			},
			image: imageAssetColumns,
			scope: {
				columns: {
					scope: true,
				},
			},
			call: {
				columns: {
					call: true,
				},
			},
			socialMedia: {
				...socialMediaByPosition,
				columns: {
					id: true,
					url: true,
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
	});

	if (item == null) {
		return null;
	}

	const [fields, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	const projectPartners = await getPublishedProjectPartners(db, item.entityVersion.entity.id);
	const rest = item;

	const participants = projectPartners
		.filter((r) => r.role.role === "participant")
		.map((r) => r.unit);

	const coordinators = projectPartners
		.filter((r) => r.role.role === "coordinator")
		.map((r) => r.unit);

	return {
		...mapItem(rest, imageWidth.featured),
		...fields,
		participants,
		coordinators,
		relatedEntities,
		relatedResources,
	};
}

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl, imageAssetColumns, toImageAsset } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import { getPublishedProjectPartners } from "@/lib/project-partners";
import { socialMediaByPosition } from "@/lib/social-media";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, count, desc, eq, inArray, not, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

/**
 * Resolve, per project document, the published version to prefer: the requested/default locale's
 * published version, falling back to the default locale's when the document has no version in the
 * preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still works
 * correctly here — both joins target the same locale and `COALESCE` just picks the (identical)
 * match.
 */
async function resolvePublishedProjectsLookup(
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

	const preferredVersion = alias(schema.entityVersions, "projects_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "projects_default_version");

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
		Array<{ id: string; url: string; type: string }>
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
		.where(inArray(schema.projectsToSocialMedia.projectId, projectVersionIds))
		.orderBy(schema.projectsToSocialMedia.position, schema.socialMedia.id);

	for (const row of rows) {
		const list = socialMediaByProjectId.get(row.projectId) ?? [];
		list.push({ id: row.id, url: row.url, type: row.type });
		socialMediaByProjectId.set(row.projectId, list);
	}

	return socialMediaByProjectId;
}

interface GetProjectsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: "active" | "inactive";
	localeId?: string;
}

export async function getProjects(db: Database | Transaction, params: GetProjectsParams) {
	const { limit = 10, offset = 0, status, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedProjectsLookup(db, requestedLocaleId);

	const statusFilter =
		status != null
			? status === "active"
				? sql`${schema.projects.duration} @> NOW()::TIMESTAMPTZ`
				: not(sql`${schema.projects.duration} @> NOW()::TIMESTAMPTZ`)
			: undefined;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				acronym: schema.projects.acronym,
				summary: schema.projects.summary,
				duration: schema.projects.duration,
				call: schema.projectCalls.call,
				topic: schema.projects.topic,
				funding: schema.projects.funding,
				updatedAt: schema.entityVersions.updatedAt,
				slug: schema.slugs.value,
				scope: schema.projectScopes.scope,
				imageKey: schema.assets.key,
				imageAlt: schema.assets.alt,
				imageWidth: schema.assets.width,
				imageHeight: schema.assets.height,
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
			.innerJoin(schema.projects, eq(schema.projects.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.innerJoin(schema.projectScopes, eq(schema.projectScopes.id, schema.projects.scopeId))
			.leftJoin(schema.projectCalls, eq(schema.projectCalls.id, schema.projects.callId))
			.leftJoin(schema.assets, eq(schema.projects.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
			.where(and(eq(schema.entities.typeId, typeId), statusFilter))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(statusFilter),
	]);

	const socialMediaByProjectId = await getSocialMediaByProjectVersionId(
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
				width: item.imageWidth,
				height: item.imageHeight,
				licenseName: item.licenseName,
				licenseUrl: item.licenseUrl,
			}),
			imageWidth.preview,
		);

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
			socialMedia: socialMediaByProjectId.get(item.id) ?? [],
			publishedAt: item.updatedAt.toISOString(),
			image,
		};
	});

	return { data, limit, offset, total };
}

//

interface GetProjectByIdParams {
	id: schema.Project["id"];
}

export async function getProjectById(db: Database | Transaction, params: GetProjectByIdParams) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.projects.findFirst({
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

	const image = generateImageUrl(item.image, imageWidth.featured);

	const duration = serializeDateRange(item.duration);

	const socialMedia = item.socialMedia.map((sm) => {
		return {
			...sm,
			type: sm.type.type,
		};
	});

	const projectPartners = await getPublishedProjectPartners(db, item.entityVersion.entity.id);
	const rest = flattenEntityVersion(item);

	const funders = projectPartners
		.filter((r) => r.role.role === "funder")
		.map((r) => {
			return { ...r.unit, role: r.role.role };
		});
	const partners = projectPartners
		.filter((r) => r.role.role !== "funder")
		.map((r) => {
			return { ...r.unit, role: r.role.role };
		});

	return {
		...rest,
		duration,
		image,
		socialMedia,
		funders,
		partners,
		...fields,
	};
}

//

interface GetProjectSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getProjectSlugs(db: Database | Transaction, params: GetProjectSlugsParams) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedProjectsLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.projects.id,
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
			.innerJoin(schema.projects, eq(schema.projects.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
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

interface GetProjectBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getProjectBySlug(db: Database | Transaction, params: GetProjectBySlugParams) {
	const { slug, localeId } = params;

	const item = await db.query.projects.findFirst({
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

	const image = generateImageUrl(item.image, imageWidth.featured);

	const socialMedia = item.socialMedia.map((sm) => {
		return {
			...sm,
			type: sm.type.type,
		};
	});

	const duration = serializeDateRange(item.duration);

	const fields = await getContentBlocks(db, item.id);

	const projectPartners = await getPublishedProjectPartners(db, item.entityVersion.entity.id);
	const rest = flattenEntityVersion(item);

	const funders = projectPartners
		.filter((r) => r.role.role === "funder")
		.map((r) => {
			return { ...r.unit, role: r.role.role };
		});
	const partners = projectPartners
		.filter((r) => r.role.role !== "funder")
		.map((r) => {
			return { ...r.unit, role: r.role.role };
		});

	return {
		...rest,
		duration,
		image,
		socialMedia,
		funders,
		partners,
		...fields,
	};
}

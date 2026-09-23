/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl, imageAssetColumns, withResolvedCaption } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import type { Database, Transaction } from "@/middlewares/db";
import type { Announcement } from "@/routes/announcements/schemas";
import { alias, and, eq, inArray, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

const entityVersionColumns = {
	columns: { updatedAt: true },
	with: {
		slug: {
			columns: { value: true },
		},
	},
} as const;

interface LocaleContext {
	localeId: string;
	defaultLocaleId: string;
}

/**
 * Admins pick featured items once, in the default locale, so the ids stored in
 * `site_metadata.featured_item_ids` are always default-locale entity-version ids. The public API is
 * read in every locale, so each stored id needs resolving to "that same entity's published version
 * in the requested locale, or the default locale if it has no translation" — the same
 * preferred/default fallback every other list endpoint applies (see
 * `resolvePublishedProjectsLookup` and siblings), just anchored on a fixed set of entities instead
 * of an entity type. Missing a translation is expected and fine (falls back to the default-locale
 * content); an id whose entity doesn't resolve to any published version at all is dropped, exactly
 * like the previous non-locale-aware lookup dropped unknown ids.
 */
async function resolveFeaturedVersionIds(
	db: Database | Transaction,
	ids: Array<string>,
	localeContext: LocaleContext,
	statusId: string,
): Promise<Map<string, string>> {
	const resolvedVersionIdByStoredId = new Map<string, string>();

	if (ids.length === 0) {
		return resolvedVersionIdByStoredId;
	}

	const storedVersions = await db.query.entityVersions.findMany({
		where: { id: { in: ids } },
		columns: { id: true, entityId: true },
	});

	const entityIdByStoredId = new Map(storedVersions.map((row) => [row.id, row.entityId]));
	const entityIds = [...new Set(entityIdByStoredId.values())];

	if (entityIds.length === 0) {
		return resolvedVersionIdByStoredId;
	}

	const preferredVersion = alias(schema.entityVersions, "featured_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "featured_default_version");

	const rows = await db
		.select({
			entityId: schema.entities.id,
			versionId: sql<string | null>`COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
		})
		.from(schema.entities)
		.leftJoin(
			preferredVersion,
			and(
				eq(preferredVersion.entityId, schema.entities.id),
				eq(preferredVersion.localeId, localeContext.localeId),
				eq(preferredVersion.statusId, statusId),
			),
		)
		.leftJoin(
			defaultVersion,
			and(
				eq(defaultVersion.entityId, schema.entities.id),
				eq(defaultVersion.localeId, localeContext.defaultLocaleId),
				eq(defaultVersion.statusId, statusId),
			),
		)
		.where(inArray(schema.entities.id, entityIds));

	const resolvedVersionIdByEntityId = new Map(
		rows.flatMap((row) => (row.versionId != null ? [[row.entityId, row.versionId] as const] : [])),
	);

	for (const [storedId, entityId] of entityIdByStoredId) {
		const resolvedVersionId = resolvedVersionIdByEntityId.get(entityId);
		if (resolvedVersionId != null) {
			resolvedVersionIdByStoredId.set(storedId, resolvedVersionId);
		}
	}

	return resolvedVersionIdByStoredId;
}

export interface GetFeaturedEntitiesParams {
	localeId?: string;
}

export async function getFeaturedEntities(
	db: Database | Transaction,
	params: GetFeaturedEntitiesParams = {},
) {
	const [metadata, localeContext, status] = await Promise.all([
		db.query.siteMetadata.findFirst({
			columns: {
				featuredItemIds: true,
			},
		}),
		resolveLocaleContext(db, params.localeId),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(status, "No published entity status in database.");

	const featuredNewsIds = metadata?.featuredItemIds?.news ?? [];
	const featuredEventIds = metadata?.featuredItemIds?.events ?? [];
	const featuredProjectIds = metadata?.featuredItemIds?.projects ?? [];

	const [news, events, projects] = await Promise.all([
		getFeaturedAnnouncements(db, featuredNewsIds, localeContext, status.id),
		getFeaturedEvents(db, featuredEventIds, localeContext, status.id),
		getFeaturedProjects(db, featuredProjectIds, localeContext, status.id),
	]);

	return { data: { news, events, projects } };
}

async function getFeaturedAnnouncements(
	db: Database | Transaction,
	ids: Array<string>,
	localeContext: LocaleContext,
	statusId: string,
) {
	if (ids.length === 0) {
		return [];
	}

	const resolvedVersionIdByStoredId = await resolveFeaturedVersionIds(
		db,
		ids,
		localeContext,
		statusId,
	);
	const resolvedIds = [...new Set(resolvedVersionIdByStoredId.values())];

	if (resolvedIds.length === 0) {
		return [];
	}

	const [news, opportunities, fundingCalls] = await Promise.all([
		db.query.news.findMany({
			where: {
				id: {
					in: resolvedIds,
				},
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
				publicationDate: true,
				imageCaption: true,
				imageCaptionMode: true,
			},
			with: {
				entityVersion: entityVersionColumns,
				image: imageAssetColumns,
			},
		}),
		db.query.opportunities.findMany({
			where: {
				id: {
					in: resolvedIds,
				},
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
				duration: true,
				website: true,
				imageCaption: true,
				imageCaptionMode: true,
			},
			with: {
				entityVersion: entityVersionColumns,
				image: imageAssetColumns,
				source: { columns: { source: true } },
			},
		}),
		db.query.fundingCalls.findMany({
			where: {
				id: {
					in: resolvedIds,
				},
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
				duration: true,
				imageCaption: true,
				imageCaptionMode: true,
			},
			with: {
				entityVersion: entityVersionColumns,
				image: imageAssetColumns,
			},
		}),
	]);

	const announcementsById = new Map<string, Announcement>();

	for (const item of news) {
		if (item.entityVersion.slug == null) {
			continue;
		}

		announcementsById.set(item.id, {
			type: "news",
			id: item.id,
			title: item.title,
			summary: item.summary,
			image: generateImageUrl(withResolvedCaption(item.image, item), imageWidth.preview),
			entity: { slug: item.entityVersion.slug.value },
			publishedAt: item.publicationDate.toISOString(),
		});
	}

	for (const item of opportunities) {
		if (item.entityVersion.slug == null) {
			continue;
		}

		announcementsById.set(item.id, {
			type: "opportunities",
			id: item.id,
			title: item.title,
			summary: item.summary,
			image: generateImageUrl(withResolvedCaption(item.image, item), imageWidth.preview),
			entity: { slug: item.entityVersion.slug.value },
			publishedAt: item.duration.start.toISOString(),
			duration: serializeDateRange(item.duration),
			source: item.source.source,
			website: item.website,
		});
	}

	for (const item of fundingCalls) {
		if (item.entityVersion.slug == null) {
			continue;
		}

		announcementsById.set(item.id, {
			type: "funding_calls",
			id: item.id,
			title: item.title,
			summary: item.summary,
			image: generateImageUrl(withResolvedCaption(item.image, item), imageWidth.preview),
			entity: { slug: item.entityVersion.slug.value },
			publishedAt: item.duration.start.toISOString(),
			duration: serializeDateRange(item.duration),
		});
	}

	return ids.flatMap((id) => {
		const resolvedVersionId = resolvedVersionIdByStoredId.get(id);
		const item = resolvedVersionId != null ? announcementsById.get(resolvedVersionId) : undefined;
		return item != null ? [item] : [];
	});
}

async function getFeaturedEvents(
	db: Database | Transaction,
	ids: Array<string>,
	localeContext: LocaleContext,
	statusId: string,
) {
	if (ids.length === 0) {
		return [];
	}

	const resolvedVersionIdByStoredId = await resolveFeaturedVersionIds(
		db,
		ids,
		localeContext,
		statusId,
	);
	const resolvedIds = [...new Set(resolvedVersionIdByStoredId.values())];

	if (resolvedIds.length === 0) {
		return [];
	}

	const items = await db.query.events.findMany({
		where: {
			id: {
				in: resolvedIds,
			},
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
			location: true,
			isFullDay: true,
			duration: true,
			imageCaption: true,
			imageCaptionMode: true,
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

	const itemsById = new Map(items.map((item) => [item.id, item]));

	return ids
		.map((id) => {
			const resolvedVersionId = resolvedVersionIdByStoredId.get(id);
			return resolvedVersionId != null ? itemsById.get(resolvedVersionId) : undefined;
		})
		.filter((item): item is NonNullable<typeof item> => item != null)
		.map((item) => {
			const image = generateImageUrl(withResolvedCaption(item.image, item), imageWidth.preview);
			const duration = serializeDateRange(item.duration);

			return { type: "events" as const, ...flattenEntityVersion(item), image, duration };
		});
}

/**
 * Junction-table lookup, not a relational `with`: `projectsToSocialMedia.position` orders each
 * project's social-media links, and drizzle's relational query API doesn't expose a "through" row's
 * own columns to order by. Mirrors `getSocialMediaByProjectVersionId` in
 * `routes/projects/service.ts` (not imported — route services in this app are self-contained; every
 * other route here queries its own tables directly rather than reaching into a sibling route's
 * service).
 */
async function getFeaturedProjectSocialMedia(
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

async function getFeaturedProjects(
	db: Database | Transaction,
	ids: Array<string>,
	localeContext: LocaleContext,
	statusId: string,
) {
	if (ids.length === 0) {
		return [];
	}

	const resolvedVersionIdByStoredId = await resolveFeaturedVersionIds(
		db,
		ids,
		localeContext,
		statusId,
	);
	const resolvedIds = [...new Set(resolvedVersionIdByStoredId.values())];

	if (resolvedIds.length === 0) {
		return [];
	}

	const [items, socialMediaByProjectId] = await Promise.all([
		db.query.projects.findMany({
			where: {
				id: {
					in: resolvedIds,
				},
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
				topic: true,
				funding: true,
				duration: true,
			},
			with: {
				entityVersion: entityVersionColumns,
				image: imageAssetColumns,
				scope: { columns: { scope: true } },
				call: { columns: { call: true } },
			},
		}),
		getFeaturedProjectSocialMedia(db, resolvedIds),
	]);

	const itemsById = new Map(items.map((item) => [item.id, item]));

	return ids
		.map((id) => {
			const resolvedVersionId = resolvedVersionIdByStoredId.get(id);
			return resolvedVersionId != null ? itemsById.get(resolvedVersionId) : undefined;
		})
		.filter((item): item is NonNullable<typeof item> => item != null)
		.map((item) => {
			// Projects have no per-entity caption override columns, unlike events/news — the asset's
			// own caption (already in `item.image`) is used as-is.
			const image = generateImageUrl(item.image, imageWidth.preview);
			const duration = serializeDateRange(item.duration);
			const socialMedia = socialMediaByProjectId.get(item.id) ?? [];

			return {
				type: "projects" as const,
				...flattenEntityVersion(item),
				image,
				duration,
				socialMedia,
			};
		});
}
